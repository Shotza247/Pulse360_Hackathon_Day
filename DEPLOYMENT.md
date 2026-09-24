# Pulse360 Deployment

This repository deploys the `pulse360` Next.js app on Render with Supabase PostgreSQL, Prisma migrations, and GitHub Actions CI.

## Render

The Blueprint starts on Render's free plans. Free web services do not support Render pre-deploy commands, so database migration and seed run in `render:start`. Upgrade the web service plan and move `npm run db:migrate` back to `preDeployCommand` when you need a stricter production deployment flow.

1. Commit and push changes to a protected branch, then merge them into `main` after CI passes.
2. Render deploys the `pulse360` Node web service from the `main` branch.
3. Supabase PostgreSQL is the production database. Render is the application host only.
4. On deploy, Render runs:
   - `npm ci && npx prisma generate && npm run build`
   - `npm run db:migrate` when the service starts
   - `npm run db:seed` when the service starts
5. Fill `NEXTAUTH_URL` with the app's public Render URL, for example `https://your-service.onrender.com`.
6. Fill `OPENAI_API_KEY` when Render prompts for it. Leave it blank only if you do not need the AI routes yet.

## GitHub Actions

The CI workflow runs on pull requests, pushes to `main`, and manual dispatch. It starts a PostgreSQL service container, applies Prisma migrations, then type-checks, lints, and builds the app.

For safer production deploys, enable branch protection on `main` and require the `CI / build` check before merging. Render is configured with `autoDeployTrigger: checksPass`, so deploys from `main` wait for CI to pass.

## Monitoring

Render is configured to call `/api/health`. The endpoint verifies both the app and database connection.

## Verified Production Deployment

The current production deployment was verified after the homepage integration and root-route update:

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
