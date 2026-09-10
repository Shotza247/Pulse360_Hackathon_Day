## 2026-09-03 09:02 - Postgres & Supabase Compatibility

- Status: monitoring
- Goal: Migrate the Pulse360 PostgreSQL database from Render to Supabase without losing application, audit, authentication, review, or AI-usage data.
- Scope: Render PostgreSQL 18 to Supabase PostgreSQL backup, restore, and verification workflow.
- Symptom: The first restore failed with `pg_restore: error: input file is too short (read 0, expected 5)`. Subsequent attempts exposed a PostgreSQL client/server version mismatch and a Docker environment-variable expansion issue.
- Suspected cause: The initial dump was empty because the backup step had not completed successfully. The later restore connection failure occurred because the Supabase URL was not passed into the container and `pg_restore` fell back to the local PostgreSQL socket.
- Evidence:
  - `Get-ChildItem` in the project root found no `*.dump` or backup file.
  - Recursive search under the Codex git workspace found no `pulse360-render-backup.dump`.
  - Docker `postgres:16-alpine` backup attempt failed with `server version: 18.4`; `pg_dump version: 16.15`.
  - After retrying, the shared repo root still had no `pulse360-render-backup.dump`, so the backup command did not write a dump file to the expected mounted directory.
  - Docker mount diagnostic passed with `pg_dump (PostgreSQL) 18.6` and wrote `/backup/docker-mount-test.txt`.
  - PostgreSQL 18 `pg_dump` successfully connected to Render and dumped all application tables, including `_prisma_migrations`, `employee`, `nomination`, `review`, `audit_log`, and the event tables.
  - Codex did not find `pulse360-render-backup.dump` in its project root after the user's successful dump output, suggesting the user's PowerShell current directory may differ from the shared repo root.
  - User verified the dump exists at `C:\Users\Jabulani Ndlovu\Downloads\Git_Clones\Pulse360_Hackathon_Day\pulse360-render-backup.dump` with length `117220` bytes.
  - Supabase restore attempt failed with `connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed`, which means `pg_restore` did not receive a usable database URL and fell back to the container's local PostgreSQL socket.
  - Docker env-var diagnostic using `sh -c 'if ... fi'` failed with `syntax error: unexpected end of file`, indicating shell quoting was parsed incorrectly before the variable could be tested.
  - PowerShell `SUPABASE_DATABASE_URL.Length` returned `109`, confirming the URL is now set locally without exposing the secret.
  - `pg_restore` connected to Supabase, dropped/recreated the `public` schema objects, processed all application tables, reset sequences, rebuilt indexes, and recreated foreign keys without a reported restore error.
  - Supabase table-count verification returned expected populated tables: `employee=59`, `department=11`, `review_cycle=3`, `nomination=75`, `review=21`, `audit_log=477`, `auth_event=111`, `ai_usage_event=25`.
- Decisions:
  - Use a PostgreSQL 18 client image for the Render PostgreSQL 18 source; the PostgreSQL client must not be older than the server major version for this workflow.
  - Treat the non-empty dump and successful Supabase row-count checks as a completed migration milestone, but do not retire the Render database until the deployed application has been verified against Supabase.
- Changes:
  - No application code changes. Recovery used `postgres:18-alpine`, verified the Docker volume mount, created a non-empty custom-format dump, and passed the Supabase URL through the Docker restore command.
- Comments:
  - The original `input file is too short` error was a backup artifact problem, not evidence that the application schema was incompatible with Supabase.
  - The PostgreSQL 18 dump completed for the Prisma migration table, employee and department data, review cycles, nominations, reviews, audit logs, authentication events, AI usage events, and related event tables.
  - PowerShell and nested `sh -c` quoting caused the restore URL diagnostic to be misleading. The successful restore confirms the database URL is now being passed correctly; the URL itself is intentionally not recorded here.
  - The restore is verified at the database level. Runtime compatibility still requires Render to use Supabase through its production `DATABASE_URL` and Prisma `DIRECT_URL` configuration.
- Verification:
  - Docker mount test passed. PostgreSQL 18 `pg_dump` output shows table dump completed. Dump file verified non-empty at `117220` bytes. Supabase restore output shows schema and data restore completed through foreign-key recreation. Supabase row counts confirm core application, audit, auth, and AI usage tables contain data.
- Follow-up:
  - Update Render `DATABASE_URL` and `DIRECT_URL` to the Supabase connection strings, redeploy, and verify the health endpoint, login, reads, writes, migrations, audit logging, and AI-usage logging before considering the cutover complete.

## 2026-09-08 20:06 - Supabase Production Cutover Verified

- Status: passed
- Goal: Verify that the Render web service can run against the restored Supabase database after the Render PostgreSQL database was suspended.
- Scope: Render `pulse360` web service startup, Prisma migrations, database seed, and production runtime.
- Evidence:
  - Prisma connected to Supabase at `aws-1-eu-west-1.pooler.supabase.com:5432`.
  - Prisma found `4 migrations` and reported `No pending migrations to apply.`
  - `Database seed completed.`
  - Next.js started successfully on Render and reported `Ready`.
  - Render reported `Your service is live` at `https://pulse360-gkt8.onrender.com`.
- Changes:
  - Render service environment variables were updated to use the Supabase database URLs.
- Verification:
  - Build succeeded, database migration check passed, seed completed, and the web service became live.
  - The suspended Render PostgreSQL database did not prevent the application from starting because the service is now using Supabase.
- Follow-up:
  - Run production smoke tests for `/api/health`, login, dashboard reads, writes, audit events, AI usage events, report generation, and downloads before retiring the suspended Render database from the migration records.

## 2026-09-10 - Approval Counter Stale Until Refresh

- Status: fixed
- Symptom: After a line manager approved or rejected a nomination, the approvals list changed but the sidebar/dashboard approval count stayed stale until the page was manually refreshed.
- Scope: `pulse360/src/app/(app)/approvals/page.tsx`, server-rendered app layout, and workflow badge counts.
- Root cause: The approvals page updated its local `nominations` state, while the sidebar badge and dashboard count were calculated by the server-rendered layout through `getSidebarBadgeCounts`. No server-component refresh was requested after the mutation.
- Changes:
  - `pulse360/src/app/(app)/approvals/page.tsx`: added `router.refresh()` after successful single approve, single reject, employee bulk approve, and all-nominations bulk approve actions.
- Verification:
  - The approval list still updates immediately through local state.
  - The targeted App Router refresh now re-renders server-derived layout/dashboard counts without requiring a browser reload.
- Follow-up:
  - Verify in production with a line-manager account by approving one nomination and confirming the sidebar badge and dashboard card decrement immediately.

## 2026-09-10 - My Reviews Counter Stale After Submission

- Status: fixed
- Symptom: After an employee submitted feedback, the `My Reviews` count remained unchanged until the page was manually refreshed.
- Scope: `pulse360/src/app/(app)/reviews/[employeeId]/page.tsx`, server-rendered app layout, and `countPendingReviewsForReviewer`.
- Root cause: Review submission updated the database and navigated back to `/reviews`, but the shared server-rendered layout could retain the previous badge count during client navigation.
- Decision: Draft saves must remain counted as pending; only final `SUBMITTED` reviews decrement the count.
- Changes:
  - `pulse360/src/app/(app)/reviews/[employeeId]/page.tsx`: added `router.refresh()` on successful final submission before returning to `/reviews`.
- Verification:
  - TypeScript validation passed after the change.
- Follow-up:
  - Verify in production by submitting one review and confirming the `My Reviews` sidebar badge and dashboard card decrement without a browser refresh.

## 2026-09-10 11:08 - Render Cannot Reach Supabase Direct Host

- Status: blocked
- Symptom: Render build succeeded, but startup failed during `prisma migrate deploy` with `P1001: Can't reach database server at db.gqkthxeqrnppllajsxws.supabase.co:5432`.
- Scope: Render production startup and Prisma `DIRECT_URL` connectivity after the auto-refresh pull request was merged.
- Evidence:
  - Next.js production build completed successfully.
  - Render started `npm run render:start` and reached Prisma migration startup.
  - Prisma resolved the datasource to the Supabase direct database hostname on port `5432`.
  - The service exited before seeding or starting Next.js because the direct Supabase host was unreachable from Render.
  - The `npm audit` vulnerability summary is a warning and is not the cause of this failure.
- Suspected cause:
  - Render cannot reach the Supabase direct database hostname from its network path, commonly because the direct endpoint is IPv6-only or otherwise unavailable to the runtime. The previous successful deployment used a Supavisor session pooler hostname.
- Decision:
  - Keep `DATABASE_URL` on the Supabase pooled/session connection and change `DIRECT_URL` to the Supabase session pooler connection copied from Supabase **Connect**. Do not use the direct `db.<project-ref>.supabase.co` host for Render migrations when it is unreachable.
- Follow-up:
  - Update Render `DIRECT_URL` with the Supabase session pooler URL on port `5432`, save and redeploy, then verify `No pending migrations to apply`, seed completion, `Ready`, and `Your service is live`.

## 2026-09-10 11:32 - Seed Still Using Retired Render Database URL

- Status: investigating
- Symptom: After `DIRECT_URL` was changed to the Supabase pooler, Prisma migrations passed but `npm run db:seed` failed with `getaddrinfo ENOTFOUND dpg-d9qn1rrm8hqs738pir8g-a`.
- Scope: Render Blueprint environment configuration and `pulse360/scripts/seed-database.js`.
- Root cause: `DIRECT_URL` reached Supabase, but `DATABASE_URL` was still supplied by the legacy `fromDatabase` mapping in `render.yaml`. The seed script intentionally reads `DATABASE_URL`, so it attempted to connect to the suspended Render database.
- Changes:
  - `render.yaml`: changed `DATABASE_URL` to `sync: false` and removed the retired `pulse360-db` Blueprint database declaration.
- Follow-up:
  - Set both Render `DATABASE_URL` and `DIRECT_URL` to the Supabase session pooler connection string on port `5432`, apply the Blueprint change, and redeploy.
