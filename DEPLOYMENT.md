# Pulse360 Deployment

This repository is ready to deploy the `pulse360` Next.js app on Render with managed PostgreSQL, Prisma migrations, and GitHub Actions CI.

## Render

The Blueprint starts on Render's free plans. Upgrade the web service and database plans in `render.yaml` when you need always-on compute, more storage, or stronger production guarantees.

1. Commit and push `render.yaml` to `main`.
2. In Render, create a new Blueprint from this GitHub repo.
3. Render will create:
   - `pulse360`, a Node web service rooted at `pulse360`
   - `pulse360-db`, a managed PostgreSQL database
4. On deploy, Render runs:
   - `npm ci && npx prisma generate && npm run build`
   - `npm run db:migrate` before starting the app
   - `npm run db:seed` once after the first successful deploy
5. Fill `NEXTAUTH_URL` with the app's public Render URL, for example `https://your-service.onrender.com`.
6. Fill `OPENAI_API_KEY` when Render prompts for it. Leave it blank only if you do not need the AI routes yet.

## GitHub Actions

The CI workflow runs on pull requests, pushes to `main`, and manual dispatch. It starts a PostgreSQL service container, applies Prisma migrations, then type-checks, lints, and builds the app.

For safer production deploys, enable branch protection on `main` and require the `CI / build` check before merging. Render is configured with `autoDeployTrigger: checksPass`, so deploys from `main` wait for CI to pass.

## Monitoring

Render is configured to call `/api/health`. The endpoint verifies both the app and database connection.

After the first deploy:

1. In Render, enable failure notifications for deploy failures and unhealthy services.
2. Use Render Metrics for CPU, memory, latency, request volume, and PostgreSQL activity.
3. Use Render Logs while the app is young.
4. Add log streaming or Sentry/OpenTelemetry when you need longer retention and deeper alerting.
