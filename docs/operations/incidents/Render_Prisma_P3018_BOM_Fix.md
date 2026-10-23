# Render Prisma P3018 BOM Fix

## Error

Render failed while applying the initial Prisma migration:

```text
Error: P3018
Database error code: 42601
ERROR: syntax error at or near "﻿"
Position: 1 ﻿-- =============================================================================
```

## Cause

The SQL migration file started with a hidden UTF-8 byte order mark (BOM). PostgreSQL treated that hidden character as part of the SQL and failed before reading the first comment.

This was not caused by `NEXTAUTH_URL`, the OpenAI API key, or the Render build cache.

## Fix Applied

The following SQL files were rewritten as UTF-8 without BOM:

- `pulse360/prisma/migrations/000001_init/migration.sql`
- `pulse360/prisma/seed.sql`

## Recovery Steps

Because Prisma records the failed migration in the database, retrying the same database will keep failing until the failed migration state is cleared.

For this first deployment, use a clean database:

1. Commit and push this fix.
2. Delete the failed Render database.
3. Trigger Blueprint sync or recreate the Blueprint so Render provisions a fresh database.
4. Redeploy the `pulse360` web service.

If production data exists in the database, do not delete it. Instead, inspect `_prisma_migrations.logs` and use Prisma's `migrate resolve` recovery workflow.

## Final Verification

The BOM fix was verified in the successful Render deployment on 2026-08-07:

```text
Applying migration `000001_init`
All migrations have been successfully applied.
Database seed completed.
Your service is live
Available at your primary URL https://pulse360-gkt8.onrender.com
```
