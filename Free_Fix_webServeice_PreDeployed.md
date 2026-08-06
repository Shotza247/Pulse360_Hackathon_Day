# Free Fix: Web Service Pre-Deploy Command

## Context

Render free-tier web services do not support `preDeployCommand`. The first Blueprint version used `preDeployCommand` for Prisma migrations and `initialDeployHook` for seeding, which caused Render to reject the Blueprint.

## Fix Applied

The free-tier Render config now runs migration and seed work from the service start command instead.

In `render.yaml`:

```yaml
startCommand: npm run render:start
```

In `pulse360/package.json`:

```json
{
  "scripts": {
    "render:start": "npm run db:migrate && npm run db:seed && next start -H 0.0.0.0"
  }
}
```

## Why This Works

`prisma migrate deploy` is safe to rerun because it only applies pending migrations. The seed script is designed to be rerunnable using conflict-safe SQL inserts and updates.

## Production Note

For a paid Render web service, move migrations back to:

```yaml
preDeployCommand: npm run db:migrate
```

Then keep the start command focused on running the app:

```yaml
startCommand: npm start
```

This gives a cleaner production deploy flow because schema changes complete before the new service instance starts receiving traffic.
