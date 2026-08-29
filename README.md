# Friink

A place for humans.

Friink is a social microblogging and verified-professional-discovery platform for the
Pakistani mental wellness space, with regional and global ambitions. It combines a
community/feed layer with a professional directory. There is no in-platform booking,
calendar, or service marketplace — that is permanently out of scope.

## Stack

- **Web:** Next.js 14, React 18, TypeScript, Font Awesome — hosted on Vercel
- **API:** FastAPI, Uvicorn — hosted on Vercel (separate project)
- **DB:** Postgres via Neon
- **ORM / Migrations:** SQLAlchemy (sync sessions via psycopg3), Alembic
- **Auth & Session:** PyJWT access tokens + httpOnly refresh cookie; bcrypt password hashing
- **Validation / Settings:** Pydantic, pydantic-settings, email-validator
- **Testing:** pytest, pytest-asyncio (API); Next.js build/type checks (web)
- **Search & Indexing:** Postgres, for now
- **Mobile client, object storage, payments, push notifications, notification provider:** TBD

See `stack.md` for the full, current source of truth on infrastructure.

## Local Development

```
# Web (Next.js) — runs on :3000
npm --prefix web run dev

# API (FastAPI) — runs on :8000
# see api/.env.example for required environment variables
```

`localhost/localhost.ps1` is available for local environment setup.

## Deployment

Two separate Vercel projects:

- **web** — deployed from `web/`, requires `NEXT_PUBLIC_API_BASE_URL` pointing at the
  deployed API project.
- **api** — deployed from `api/` (entrypoint `api/api/index.py`), requires
  `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL`, and the other variables listed in
  `api/.env.example`.

There is no root `vercel.json`; each project is configured independently in the Vercel
dashboard.

- Staging: `staging.friink.com` / `staging-api.friink.com`
- Production: `friink.com`

## Project Documentation

This repo is governed by a small set of living documents rather than a static PRD.
**The Product Requirements Document is not the source of truth for what's built —
these files, and the live implementation, are:**

- **`rules.md`** — active product/business logic rules, organized by feature area.
  Read before changing behavior.
- **`packages/design/design.md`** — binding design tokens and component contracts.
  Read before any visual/UI/layout change.
- **`CHANGELOG.md`** — dated change history plus a maintained "Current State" summary
  at the top. Read first for project history and current state.
- **`AGENTLOG.md`** — detailed per-change entries (agent, model, prompt summary,
  files touched, reasoning). Updated alongside every `CHANGELOG.md` entry.
- **`stack.md`** — current infrastructure and tooling stack.

When these were prepared, this set was considered sufficient to fully rebuild Friink
from scratch.

## Contributing (Agents & Humans)

1. Read `CHANGELOG.md` (current state) and `AGENTLOG.md` (recent detailed context)
   before starting any task.
2. Read `rules.md` before changing product/business behavior.
3. Read `packages/design/design.md` before any visual, layout, or styling change.
4. Keep reusable behavior and layout fixes at the shared component/contract level
   whenever the behavior appears in more than one place. Do not use inline styles,
   route-only spacing patches, or page-specific quick fixes for global UI behavior.
5. After completing a change, append a dated entry to `CHANGELOG.md` and a
   corresponding detailed entry to `AGENTLOG.md`. Do not remove old rule entries in
   `rules.md` — mark them Deprecated instead.
6. Test and commit before switching agents or handing off work.
