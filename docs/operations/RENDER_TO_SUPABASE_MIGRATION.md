# Render PostgreSQL to Supabase Migration Record and Recovery

> **Migration completed:** The production cutover to Supabase was verified on 2026-09-10. The former Render PostgreSQL database is suspended/expired and is not a valid rollback target. The steps below are retained as a historical procedure for a future migration; do not repeat them against the live Supabase database.

Render remains the web host. Supabase is the production PostgreSQL source of truth. The Render service has manually configured `DATABASE_URL` and `DIRECT_URL` values, and the Blueprint no longer provisions or references the retired Render database.

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
| `DIRECT_URL` | Prisma migrations, seed, admin tooling | Supavisor session pooler on port `5432` for the verified Render network path |

The direct Supabase host was unreachable from Render (`P1001`); both production URLs were switched to the Supavisor session pooler on port `5432`. Avoid the transaction pooler on port `6543` for Prisma migrations, which need a stable session.

## Original Cutover Procedure (Historical)

The steps below document the completed 2026 migration. The Render source database has expired; do not run the source-backup steps against it now.

### 1. Freeze production writes

Pick a short maintenance window.

In Render:

1. Open the `pulse360` web service.
2. Temporarily suspend or stop the service.
3. Do not run new deploys until the database copy is complete.

This prevents new nominations/reviews/audit events from being written to Render Postgres after the dump is taken.

### 2. Back up the source Render database (before retirement)

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

### 7. Update Render Blueprint (completed)

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
    generateValue: true
  - key: NEXTAUTH_URL
    sync: false
  - key: OPENAI_API_KEY
    sync: false
```

The `databases:` block has already been removed from the current `render.yaml`.

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

The former Render database is not available for rollback. If Supabase becomes unavailable:

1. Do not point Render back at the expired Render database.
2. Diagnose Supabase connectivity and configuration first; do not run `pg_restore --clean` against the production database as a connectivity fix.
3. If recovery from data loss is required, restore a verified backup to a separate recovery database, validate it, then plan a controlled cutover.
4. Reconcile writes made after the backup timestamp before switching traffic.

Keep the verified backup and its timestamp documented. Never delete or overwrite the only known-good production copy during recovery.

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
