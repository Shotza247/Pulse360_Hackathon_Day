# Render Prisma P3009 Recovery

## Error

Render reached deploy/startup, then Prisma failed with:

```text
Error: P3009
migrate found failed migrations in the target database
The `000001_init` migration ... failed
```

## What It Means

The build succeeded. The failure is in the Render PostgreSQL database migration state.

Prisma recorded that `000001_init` failed once in the target database. After that, `prisma migrate deploy` refuses to apply new migrations until the failed migration is resolved.

## Safest Fix For This First Deployment

Because this is a new first deployment and there should be no production data yet, use a clean database:

1. Commit and push the latest migration fix.
2. In Render, delete the current failed `pulse360-db` database.
3. Recreate the Blueprint or create a fresh database with the same Blueprint.
4. Retry the deploy.

This avoids carrying forward a partially applied migration state.

## If You Must Keep The Existing Database

Inspect the failed migration details from `_prisma_migrations`:

```sql
SELECT migration_name, started_at, logs
FROM _prisma_migrations
WHERE migration_name = '000001_init';
```

Then either roll it back or mark it applied using Prisma's production recovery flow:

```bash
npx prisma migrate resolve --rolled-back 000001_init
```

Only use `--applied` if you have confirmed the full schema already exists.

## Fix Applied In Code

The initial SQL migration is now more retry-safe:

- enum creation checks whether each enum type already exists
- the employee update trigger is dropped before being recreated
- the active-cycle unique index uses `IF NOT EXISTS`

This reduces failures when a first migration was partially applied before Render retried startup.

## Final Verification

The recovery path was verified by recreating a clean Render database and deploying the BOM-free migration on 2026-08-07:

```text
Datasource "db": PostgreSQL database "pulse360_2pr8"
Applying migration `000001_init`
All migrations have been successfully applied.
Database seed completed.
Your service is live
Available at your primary URL https://pulse360-gkt8.onrender.com
```
