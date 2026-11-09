# Pulse360 Deployment

This repository deploys the `pulse360` Next.js app on Render with Supabase PostgreSQL, Prisma migrations, and GitHub Actions CI.

## Render

The Blueprint starts on Render's free plans. Free web services do not support Render pre-deploy commands, so database migration and seed run in `render:start`. Upgrade the web service plan and move `npm run db:migrate` back to `preDeployCommand` when you need a stricter production deployment flow.

1. Commit and push changes to a protected branch, then merge them into `main` after CI passes.
2. Render deploys the `pulse360` Node web service from the `main` branch.
3. Supabase PostgreSQL is the production database. Render is the application host only.
4. On deploy, Render runs:
   - `npm ci --include=dev && npx prisma generate && npm run build && npm prune --omit=dev`
   - `npm run db:migrate` when the service starts
   - `npm run db:seed` when the service starts
5. Fill `NEXTAUTH_URL` with the app's public Render URL, for example `https://your-service.onrender.com`.
6. Fill `OPENAI_API_KEY` when Render prompts for it. Leave it blank only if you do not need the AI routes yet.
7. For the System Admin FAQ ingestion page and the landing-page FAQ assistant, set `RAG_API_URL` to the reachable companion RAG API base URL. A local value is `http://127.0.0.1:8767`; a deployed Render/Vercel app must use a deployed RAG API URL instead. The browser never calls the RAG service directly.
8. Set `RAG_ADMIN_API_KEY` (must equal `ADMIN_API_KEY` on the RAG API) and `RAG_QUERY_API_KEY` (must equal `QUERY_API_KEY` on the RAG API). Use two different secrets. Without them, ingestion fails with 401 and `/api/faq/ask` is rejected by the RAG API.
9. Leave `TRUSTED_PROXY_HOPS` at `1` on Render. Increase it by one if a CDN such as Cloudflare is placed in front.

## FAQ ingestion readiness

System Admins can open `/system-admin/rag` to upload a PDF, TXT, or Markdown FAQ source, inspect extracted chunks, choose a category, and explicitly approve the embedding request. The page calls authenticated Pulse360 proxy routes under `/api/system-admin/rag/*`. Treat the Supabase pgvector pipeline as unverified until the companion service successfully writes a document and chunks and `/ask` returns grounded results.

Integration status (see [RAG Integration Fix Plan](RAG_INTEGRATION_FIX_PLAN.md) for detail):

| Area | Status |
|---|---|
| API contract between Pulse360 and the RAG API | Reviewed and matching (upload, preview, commit, `/ask`) |
| Query authentication and collection allowlist (`QUERY_API_KEY`, `PUBLIC_COLLECTIONS`) | Implemented, offline tests pass, not yet deployed |
| Per-visitor rate limiting (RAG API and `/api/faq/ask`) | Implemented, offline tests pass, not yet deployed |
| Upload size limits vs Vercel body cap, request timeouts | Open (fixes 3 and 4) |
| Live smoke test against Supabase, Vercel and Render | Not yet run |

Deploy order: set the variables on both platforms, merge and deploy the RAG API first, then merge Pulse360. The RAG API fails closed (401) on `/ask` and `/search` when `APP_ENV` is not `local` and `QUERY_API_KEY` is missing.

Smoke test after deploying:

1. Confirm the `pulse360_faq` collection exists (`GET /collections` with the admin key).
2. Log in as System Admin, upload a document at `/system-admin/rag`, preview, then approve.
3. Ask a question on the landing page and confirm the answer cites the uploaded source.
4. Send more than 10 questions in a minute from one browser and confirm a 429 with `Retry-After`.
5. Log `X-Forwarded-For` once and confirm the visitor IP is the last entry. If it is not, adjust `TRUSTED_PROXY_HOPS`.

Google Drive synchronization is a future source connector. The upload UI alone does not prove that embeddings are committed or searchable.

## GitHub Actions

The CI workflow runs on pull requests, pushes to `main`, and manual dispatch. It starts a PostgreSQL service container, applies Prisma migrations, type-checks, runs lint as an advisory step, and builds the app.

For safer production deploys, enable branch protection on `main` and require the `CI / build` check before merging. Render is configured with `autoDeployTrigger: checksPass`, so deploys from `main` wait for CI to pass.

## Monitoring

Render is configured to call `/api/health`. The endpoint verifies both the app and database connection.

## Production Deployment Baseline

The production root route and Supabase cutover were verified in September 2026. This is a historical baseline, not a live health check; confirm the latest release in Render's deploy history.

```text
All migrations have been successfully applied.
Database seed completed.
Ready in 1503ms
Your service is live
Available at your primary URL https://pulse360-gkt8.onrender.com
```

The public homepage is:

```text
https://pulse360-gkt8.onrender.com/
```

The public `/landing.html` suffix is no longer required. The landing HTML asset may remain internal to the root route, but the supported user-facing entry point is the root URL. The login page is available at `/login`.

After the first deploy:

1. In Render, enable failure notifications for deploy failures and unhealthy services.
2. Use Render Metrics for CPU, memory, latency, request volume, and PostgreSQL activity.
3. Use Render Logs while the app is young.
4. Add log streaming or Sentry/OpenTelemetry when you need longer retention and deeper alerting.
