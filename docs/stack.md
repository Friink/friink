# Friink technology stack

This document records the technologies, runtime services, environments, and
development commands used by Friink. It describes the current implementation;
planned or undecided items are marked explicitly.

**Last edited:** 2026-09-12T22:10:13Z

## Clients

- **Web:** Next.js 16.3.4, React 19.3.0, TypeScript, and Font Awesome; hosted on Vercel.
- **Mobile:** TBD. Mobile authentication and session requirements remain deferred until a mobile client exists.

## API and data

- **API:** FastAPI 0.141.1 with Uvicorn; hosted on Vercel as a separate project.
- **Database:** PostgreSQL via Neon, with separate databases for deployed environments. Staging remains on the existing Neon database; production temporarily uses the separate `ep-restless-paper-b3szoet` Neon database, with a planned future move to the Droplet.
- **Database connections:** SQLAlchemy pooling is configurable. Neon Free uses conservative limits, while a future Ubuntu-hosted PostgreSQL deployment can use a larger pool without application-code changes. Pooling can be disabled with `DB_POOLING_ENABLED=false` when short-lived connections are required.
- **ORM and migrations:** SQLAlchemy with synchronous `Session`/psycopg3 connections, and Alembic.
- **Object storage:** Cloudflare R2 for profile pictures and submit-time post-image uploads. Post images use the `post-media/{user_id}/{random}.jpg` namespace and the existing `post_media` association table. See `R2.md` for environment setup.
- **Search and indexing:** PostgreSQL for now.

## Authentication and platform services

- **Authentication and sessions:** FastAPI routes, PyJWT access tokens, an HTTP-only refresh-token cookie, and bcrypt password hashing.
- **Validation and settings:** Pydantic, pydantic-settings, and email-validator.
- **Notifications:** In-app notification records and API endpoints are implemented; an email delivery provider is TBD.
- **Payments:** TBD.
- **Push notifications:** TBD.

## Hosting and environments

- Two separate Vercel projects are used: `web/` for the Next.js client and `api/` for the API entrypoint at `api/api/index.py`.
- The web deployment receives `NEXT_PUBLIC_API_BASE_URL`; it does not receive `DATABASE_URL`.
- The API deployment requires `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`, and the other variables listed in `api/.env.example`.
- There is no root `vercel.json`; each project is configured independently in the Vercel dashboard.
- Staging uses `staging.friink.com` and `staging-api.friink.com`.
- Production uses `friink.com`.

## Local development

```text
# Web (Next.js) — runs on :3000
npm --prefix web run dev

# API (FastAPI) — runs on :8000
# See api/.env.example for required environment variables.
```

The `development` branch is the local-work branch below `staging`. Its ignored
`api/.env.development` file may copy staging variable names, but must point to
an isolated development database and must never contain production credentials.
The current local API configuration uses the isolated development PostgreSQL
database on Neon through `DATABASE_URL`; the exact host and credentials remain
environment-local and are intentionally not documented here.
The development database must be migrated to the current Alembic head before
local auth/session rehearsals. See the [deployment guide](deployment.md) for
the migration gate and release workflow.

## Verification tools

- API tests use pytest and pytest-asyncio.
- Web verification uses the Next.js production build and TypeScript checks.
- Browser end-to-end coverage, deployed Vercel configuration, and R2 health still require release verification.

## Related documents

- [Architecture](architecture.md)
- [Rules](rules.md)
- [Testing](testing.md)
- [Account access unit](units/account-access.md)
- [Account lifecycle unit](units/account-lifecycle.md)
