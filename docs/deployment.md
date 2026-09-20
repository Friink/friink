# Friink deployment guide

This document owns the active deployment and database-release workflow. The
Alembic migration chain in `api/alembic/versions/` is the source of truth for
the repository schema; this guide intentionally does not duplicate a specific
migration revision.

## Environments and branches

- `development` is for local implementation and isolated database rehearsals.
- `staging` is for deployed acceptance testing.
- `main` is the production release branch.

Staging and production use separate databases. Never use production credentials
or a production database for local or destructive development work.

## API migration gate

The API deployment runs `api/scripts/migrate_before_deploy.py` through
`api/vercel.json`. The gate:

1. Runs `alembic upgrade head`.
2. Runs `alembic check`.
3. Blocks the deployment if either command fails or schema drift remains.

Run the same gate locally from `api/`:

```powershell
python scripts/migrate_before_deploy.py
```

To inspect the repository and database revisions directly:

```powershell
python -m alembic heads
python -m alembic current
python -m alembic check
```

Do not maintain a manually copied migration-head number in general README,
agent, testing, or stack documentation. Historical migration numbers belong in
the changelog and agent log entries that record the work performed.

## Release flow

1. Develop and verify against an isolated development database.
2. Apply the migration gate and deploy to staging.
3. Run targeted API, web, browser, and acceptance checks on staging.
4. Confirm environment-specific configuration, database connectivity, storage,
   email, and feature flags when relevant.
5. Promote the verified release to `main` and production.
6. Apply the same migration gate and complete the production release checks.

Production rollout is a separate release gate from staging acceptance.

## Configuration boundaries

- The web project receives only its environment-specific
  `NEXT_PUBLIC_API_BASE_URL`.
- The API project owns `DATABASE_URL`, authentication secrets, environment
  flags, email settings, and storage credentials.
- Both projects use matching `.env`, `.env.staging`, and `.env.development`
  files for production, staging, and development respectively.
- Local web development loads `web/.env.development` through Next.js. Local
  API development must pass `--env-file .env.development` to Uvicorn; a bare
  API launch loads `.env`, the production configuration.
- `OTP_ENABLED` is off for development and on for staging and production.
- Never commit environment files or secrets.

## Related documents

- [Testing](testing.md) — verification and release criteria
- [Stack](stack.md) — technologies and environments
- [Architecture](architecture.md) — runtime boundaries
- [R2 setup](../R2.md) — object-storage deployment configuration
