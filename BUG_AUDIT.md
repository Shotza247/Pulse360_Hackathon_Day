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

## 2026-09-10 12:26 - Supabase Pooler and Blueprint Cutover Verified

- Status: passed
- Goal: Confirm that the deployed service can complete migrations, seed Supabase, and start after removing the retired Render database mapping.
- Scope: Render Blueprint environment configuration, Supabase pooler connectivity, Prisma startup, and database seeding.
- Evidence:
  - Prisma connected to `aws-1-eu-west-1.pooler.supabase.com:5432`.
  - Prisma found four migrations and reported `No pending migrations to apply.`
  - `Database seed completed.`
  - Next.js reported `Ready` on port `10000`.
  - Render reported `Your service is live` at `https://pulse360-gkt8.onrender.com`.
- Changes:
  - Render `DATABASE_URL` and `DIRECT_URL` now use Supabase pooler connectivity.
  - The Blueprint no longer injects the retired Render database URL or declares `pulse360-db` as a managed dependency.
- Verification:
  - Build, migration check, seed, application startup, and Render availability all passed.
  - The earlier `P1001` direct-host failure and `ENOTFOUND` retired Render-host failure are resolved.
- Follow-up:
  - Perform the application smoke test: login, dashboard reads, approval/review counter refresh, one safe write, audit-event creation, report generation, and downloads.

## 2026-09-23 - Landing Page Root Route Deployed

- Status: passed
- Goal: Make the Pulse360 landing page the public application entry point without requiring `/landing.html`.
- Scope: Next.js root route, landing-page integration, login navigation, Render deployment, and `main` branch delivery.
- Evidence:
  - Homepage integration was committed in `7846ff1`.
  - Landing-page and login navigation changes were merged through PR #61 in `14af410`.
  - The final root homepage update was committed as `ca84ce0` (`HomePage url update`).
  - `origin/main` points to `ca84ce0`.
  - Render deployment completed successfully.
  - The production root URL is available at `https://pulse360-gkt8.onrender.com/`.
- Changes:
  - The Next.js root page renders the landing experience.
  - Removed the public dependency on `/landing.html` routing.
  - Retained the landing HTML asset as an internal implementation detail of the root page.
  - Kept `/login` as the authentication entry point with navigation back to the homepage.
- Verification:
  - Root production URL displays the landing page.
  - `/landing.html` is not required for public navigation.
  - Render is serving the deployed `main` branch version.
- Decision:
  - Treat the landing-page integration as complete and begin the next implementation gate: Supabase `pgvector` schema, FAQ ingestion, and the Vercel `/ask` service.

## 2026-09-25 - Supabase pgvector Foundation Created

- Status: in progress
- Goal: Prepare the Supabase vector database for the Pulse360 FAQ Assistant.
- Scope: Supabase extension, private RAG schema, FAQ collection metadata, document/chunk storage, and similarity retrieval.
- Evidence:
  - Supabase `pgvector` extension is enabled at version `0.8.2`.
  - The private `rag` schema was created successfully.
  - `rag.collections`, `rag.documents`, and `rag.document_chunks` were created successfully.
  - The initial `pulse360_faq` collection was registered.
  - The `rag.match_document_chunks` function was created for cosine-similarity retrieval over committed 384-dimensional embeddings.
- Decisions:
  - Keep FAQ data isolated from Pulse360 employee, review, and audit tables.
  - Search only documents with `status = 'COMMITTED'`.
  - Use category metadata for topics such as pricing, privacy, security, onboarding, and analytics.
- Not yet completed:
  - The approved FAQ document has not yet been uploaded to Supabase Storage or registered in `rag.documents`.
  - FAQ text has not yet been chunked or embedded.
  - No rows have yet been inserted into `rag.document_chunks`.
  - The Vercel `/ask` endpoint has not yet been connected to pgvector.
- Next step:
  - Import the approved FAQ document, generate embeddings using the configured 384-dimensional embedding model, insert the chunks, mark the document `COMMITTED`, and verify retrieval by category.

## 2026-09-25 - pgvector Retrieval Function and Reranker Decision

- Status: passed
- Goal: Confirm the purpose and boundary of the Supabase vector retrieval function before importing FAQ content.
- Scope: `rag.match_document_chunks`, pgvector similarity search, FAQ category filtering, and retrieval ranking strategy.
- Evidence:
  - The function accepts a `extensions.vector(384)` question embedding.
  - It searches the requested collection and only returns documents with `status = 'COMMITTED'`.
  - It supports optional category filtering, a `0.35` minimum similarity threshold, and a default top-six result limit.
  - It returns chunk content and source metadata required for answer citations.
- Decision:
  - Use Supabase `pgvector` as the initial retrieval ranker.
  - Do not add a semantic reranker yet. Supabase/pgvector provides nearest-neighbor similarity ranking, not a separate cross-encoder reranker.
  - Revisit reranking after importing representative FAQ content and measuring retrieval quality.
- Verification:
  - The retrieval function was created successfully in Supabase.
  - Retrieval result testing is pending until committed FAQ embeddings exist.
- Follow-up:
  - Upload and register the approved FAQ document, generate 384-dimensional embeddings, insert committed chunks, then run category-specific retrieval tests.

## 2026-09-25 - System Admin FAQ Ingestion Workspace

- Status: in progress
- Goal: Provide a governed UI for System Admins to stage FAQ documents for the future Supabase pgvector ingestion pipeline.
- Implemented:
  - Added the protected `/system-admin/rag` page and `FAQ Sources` System Admin navigation item.
  - Added server-side authenticated proxy routes for document listing, upload preview, and approved commit.
  - Added PDF, TXT, and Markdown upload validation with a 10 MB limit.
  - Added an explicit preview gate showing extracted chunks, chunk count, embedding dimensions, expiry, and duplicate status before embedding.
  - Added collection, model, category, committed-source, success, and failure states to the UI.
  - Kept Google Drive folder synchronization visible as a future connector, without pretending that the connector exists yet.
- Important boundary:
  - The current companion RAG service still contains a Qdrant requirement in its ingestion storage path. The Pulse360 page is ready to front the workflow, but Supabase pgvector is not yet the live embedding write path.
  - Category selection is staged in the UI and must be accepted and persisted by the upgraded Supabase ingestion endpoint before it becomes searchable metadata.
- Configuration:
  - Set `RAG_API_URL` on the Pulse360 server. Use `http://127.0.0.1:8767` only when both services run locally; deployed Pulse360 must use a deployed RAG API URL.
- Verification:
  - Source inspection and `git diff --check` are pending final verification.
  - Typecheck/lint could not run because the local dependency install was blocked by the environment's npm registry/file-permission restrictions.
- Next recovery step:
  - Migrate the companion ingestion service from Qdrant/SQLite storage to Supabase `rag.documents` and `rag.document_chunks`, then run a real preview → approve → commit → retrieval smoke test.

## 2026-10-23 - GitHub Desktop Push Targeted Protected Main Instead of Feature Branch

- Status: fixed
- Symptom: GitHub rejected a push with `GH013` and `Changes must be made through a pull request`. Git output showed `git push origin main:main`, although GitHub Desktop displayed the current branch as `feature/assistant-ai-avatar`. The toolbar displayed `Push origin/main`, and the user could not see a `Publish branch` action.
- Scope: Local Git branch/upstream configuration, GitHub Desktop, and the repository ruleset protecting `main`.
- Root cause: The attempted push explicitly targeted `main` (`main:main`), which is protected by the repository ruleset. The local feature branch was not initially being pushed to its matching remote feature ref, so Desktop's push target was misleading. This was not a CI failure and did not require weakening the ruleset.
- Evidence:
  - GitHub Desktop showed current branch `feature/assistant-ai-avatar`, with commit `0cbfdc6` (`Add dedicated AI assistant avatar`) as one local commit awaiting publication.
  - The rejected command was `git push origin main:main` and GitHub identified `refs/heads/main` as the protected ref.
  - Follow-up `git branch -vv` showed `feature/assistant-ai-avatar` at `0cbfdc6` tracking `origin/feature/assistant-ai-avatar`; local `main` remained at `c3c7814` tracking `origin/main`.
- Recovery:
  - From the repository root, explicitly publish the feature branch and set its upstream with `git push -u origin feature/assistant-ai-avatar`.
  - If GitHub Desktop has no `Publish branch` button, use **Repository → Open in Terminal** and run the explicit command above; do not click a toolbar action that says `Push origin/main` while the current branch is the feature branch.
  - If authentication fails, sign in to GitHub Desktop and retry the same feature-branch command. Do not bypass or weaken the `main` ruleset.
- Verification:
  - `git branch -vv` reported `feature/assistant-ai-avatar 0cbfdc6 [origin/feature/assistant-ai-avatar] Add dedicated AI assistant avatar`.
  - The feature branch is published and configured to track its matching origin branch. Create the PR with base `main` and compare/head `feature/assistant-ai-avatar`; after checks pass, merge the PR to trigger the normal main-branch deployment workflow.
- Follow-up:
  - Confirm the pull request appears in GitHub with base `main` and head `feature/assistant-ai-avatar`, then follow its checks and merge status. No application code or repository ruleset changes are needed for this Git recovery.
