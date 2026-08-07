# Render Build Dev Dependencies Fix

## Error

Render failed during `next build` with:

```text
Cannot find module '@tailwindcss/postcss'
```

## Cause

The Blueprint sets:

```yaml
NODE_ENV: production
```

When `NODE_ENV=production`, `npm ci` can omit packages from `devDependencies`. The Next.js build still needs build-time packages such as `@tailwindcss/postcss`, `tailwindcss`, and `typescript`.

This is not caused by `NEXTAUTH_URL`.

## Fix Applied

The Render build command now explicitly installs dev dependencies for the build, then removes them before runtime:

```yaml
buildCommand: npm ci --include=dev && npx prisma generate && npm run build && npm prune --omit=dev
```

## NEXTAUTH_URL

For this deployment, use the Render public URL:

```text
https://pulse360-gkt8.onrender.com
```

Do not include a trailing slash.

## Final Verification

The fix was verified in the successful Render deployment on 2026-08-07:

```text
Build successful
All migrations have been successfully applied.
Database seed completed.
Ready in 1503ms
Your service is live
Available at your primary URL https://pulse360-gkt8.onrender.com
```
