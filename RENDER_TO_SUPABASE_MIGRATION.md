# Render Postgres to Supabase Migration

This runbook moves Pulse360 from the temporary Render free PostgreSQL database to Supabase Postgres while keeping Render as the web host.

## Recommended Target Design

```text
Render Web Service
  DATABASE_URL -> Supabase pooled/session connection string for app traffic
  DIRECT_URL   -> Supabase direct or session connection string for Prisma migrations

Supabase Postgres
  Source of truth for Pulse360 app tables and event tables

BigQuery, later
  Analytics warehouse fed from Supabase event tables by scheduled ETL
```

Keep BigQuery out of the live application write path. Pulse360 should write transactions to Postgres first, then export analytics/events to BigQuery later.

## Connection Strings

In Supabase, open the project, click **Connect**, and collect:

| Variable | Use | Recommended Supabase URL |
|---|---|---|
| `DATABASE_URL` | Runtime app queries from Render | Supavisor session pooler, usually port `5432` |
| `DIRECT_URL` | Prisma migrations, seed, admin tooling | Direct database URL on port `5432`; if direct IPv6 is unreachable, use the Supavisor session pooler |

For Prisma with the `pg` adapter, avoid the transaction pooler on port `6543` for migrations. Prisma migration commands need a stable session.

## Safe Migration Path

### 1. Freeze production writes

Pick a short maintenance window.

In Render:

1. Open the `pulse360` web service.
2. Temporarily suspend or stop the service.
3. Do not run new deploys until the database copy is complete.

This prevents new nominations/reviews/audit events from being written to Render Postgres after the dump is taken.

### 2. Back up the current Render database

From a machine with PostgreSQL client tools installed, use Render's external database URL:

```powershell
$env:RENDER_DATABASE_URL = "postgresql://RENDER_USER:RENDER_PASSWORD@RENDER_HOST:5432/RENDER_DB?sslmode=require"
pg_dump --format=custom --no-owner --no-acl --file=pulse360-render-backup.dump $env:RENDER_DATABASE_URL
```

Do not commit the dump file. It contains HR and auth data.

### 3. Create an empty Supabase project/database

In Supabase:

1. Create or open the target project.
2. Save the database password securely.
3. Confirm the project is empty or dedicated to Pulse360.
4. Copy the connection strings from **Connect**.

### 4. Restore Render data into Supabase

Use the Supabase direct URL when possible:

```powershell
$env:SUPABASE_DIRECT_URL = "postgresql://postgres:SUPABASE_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
pg_restore --no-owner --no-acl --clean --if-exists --dbname=$env:SUPABASE_DIRECT_URL pulse360-render-backup.dump
```

If your local network cannot reach the direct IPv6 endpoint, use Supabase's session pooler URL instead.

### 5. Verify the Supabase database

```powershell
psql $env:SUPABASE_DIRECT_URL -c "select count(*) as employees from employee;"
psql $env:SUPABASE_DIRECT_URL -c "select count(*) as cycles from review_cycle;"
psql $env:SUPABASE_DIRECT_URL -c "select count(*) as nominations from nomination;"
psql $env:SUPABASE_DIRECT_URL -c "select count(*) as reviews from review;"
psql $env:SUPABASE_DIRECT_URL -c "select count(*) as audit_events from audit_log;"
```

Also confirm Prisma migration state:

```powershell
psql $env:SUPABASE_DIRECT_URL -c "select migration_name, finished_at from _prisma_migrations order by started_at;"
```

### 6. Point Render web service to Supabase

In Render web service environment variables, replace the existing Render-managed `DATABASE_URL`.

Set:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:SUPABASE_PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:SUPABASE_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

If the direct URL is unreachable from Render, set `DIRECT_URL` to the Supavisor session pooler URL as well.

Keep:

```env
NEXTAUTH_URL=https://pulse360-gkt8.onrender.com
NEXTAUTH_SECRET=existing-production-secret
OPENAI_API_KEY=existing-production-key
NODE_ENV=production
```

Do not rotate `NEXTAUTH_SECRET` during the database migration unless you intentionally want all sessions invalidated.

### 7. Update Render Blueprint

The Blueprint has been updated so the production service no longer receives `DATABASE_URL` from the retired Render-managed database. `DATABASE_URL` and `DIRECT_URL` are now manually supplied through Render environment values.

Recommended future `envVars` shape:

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    sync: false
  - key: DIRECT_URL
    sync: false
  - key: NEXTAUTH_SECRET
    sync: false
  - key: NEXTAUTH_URL
    sync: false
  - key: OPENAI_API_KEY
    sync: false
```

Then remove the `databases:` block from `render.yaml`.

The Blueprint change must be applied only after the Supabase database is restored and both Render environment values are populated.

### 8. Deploy and smoke test

In Render:

1. Resume the `pulse360` web service.
2. Trigger **Manual Deploy -> Deploy latest commit**.
3. Watch logs for:
   - `prisma migrate deploy`
   - `Database seed completed.`
   - `Ready`
   - `Your service is live`

Smoke test:

1. Log in.
2. Open HR dashboard.
3. Open System Admin dashboard.
4. Create/edit a test employee.
5. Create a test nomination if the cycle phase allows it.
6. Confirm event tables are receiving rows:

```sql
select count(*) from auth_event;
select count(*) from profile_event;
select count(*) from nomination_event;
select count(*) from ai_usage_event;
```

## Rollback

If Supabase connection fails:

1. Put the old Render `DATABASE_URL` back into Render env vars.
2. Remove or blank `DIRECT_URL`.
3. Redeploy.
4. Keep the Supabase dump/restore attempt for analysis.

If data was written to Supabase during the failed cutover, do not delete either database until you reconcile what changed.

## BigQuery Later

Once Supabase is stable, add a scheduled export from these event tables:

- `audit_log`
- `auth_event`
- `profile_event`
- `ai_usage_event`
- `ai_hitl_decision`
- `nomination_event`
- `review_event`

Start with a daily or hourly export before introducing Airflow. Airflow becomes useful once there are multiple DAGs, backfills, dependency chains, quality checks, and executive reporting schedules.
