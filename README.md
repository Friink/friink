# Friink

A place for humans.

Friink is a social microblogging and professional discovery platform for the
Pakistani mental wellness space, with regional and global ambitions. It combines a
community/feed layer with a professional directory. There is no in-platform booking,
calendar, or service marketplace — that is permanently out of scope.

## Stack

- **Web client:** Next.js 14, React 18, TypeScript, Font Awesome — hosted on Vercel
- **Mobile client:** TBD
- **API:** FastAPI with Uvicorn — hosted on Vercel as a separate project
- **Database:** PostgreSQL via Neon
- **ORM / migrations:** SQLAlchemy with synchronous `Session`/psycopg3 connections, Alembic
- **Object storage:** Cloudflare R2 for profile pictures and submit-time post-image uploads. Post images use the `post-media/{user_id}/{random}.jpg` namespace and the existing `post_media` association table. See `R2.md` for environment setup.
- **Authentication and session:** FastAPI routes, PyJWT access tokens, HTTP-only refresh-token cookie, bcrypt password hashing
- **Validation and settings:** Pydantic, pydantic-settings, email-validator
- **Notifications:** In-app notification records and API endpoints are implemented; email delivery provider remains TBD
- **Payments:** TBD
- **Search and indexing:** PostgreSQL for now
- **Push notifications:** TBD
- **Hosting:** Two Vercel projects, one deployed from `web/` and one from `api/` (`api/api/index.py`)
- **Local development:** `localhost/localhost.ps1`, Next.js on port 3000, FastAPI on port 8000
- **Testing:** pytest and pytest-asyncio for the API; Next.js production build and TypeScript checks for the web client

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

## Current Web-App Architecture

- `web/theme.config.ts` is the canonical source for design-token values.
- `web/app/globals.css` owns generated CSS variables and all logged-in app visual/layout rules.
- Logged-in TSX components contain structure, semantic class names, state, behavior, and accessibility only; they do not define visual design.
- The logged-in web app has no page-specific CSS, CSS Modules, route-only stylesheets, or JSX inline styles. The public landing stylesheet `web/app/landing.module.css` is separate and outside this rule.
- The shared visible app content column and contextual floating composer use `--space-content-col` at a `720px` tablet/desktop cap. The shared inline gutter is outside that visible cap: `16px` on desktop and `8px` on mobile.
- The floating composer is available on feed and supported contextual surfaces, but is intentionally hidden on profile pages.
- Other-user profiles expose a functional Message action that opens `/{username}/chat`; chat access still requires mutual accepted follows.
- The signed-in account's Connections surface always exposes Requests; pending incoming requests provide Accept and Reject actions from the authenticated API.
- Current post media uses a fixed `3:5` crop tool, submit-time R2 upload, a `3:4` frame for multi-image galleries, and natural-ratio display for single images. Final crop dimensions/aspect ratio are not currently persisted.
- Chat uses REST-backed conversations and messages with a 4-second adaptive polling transport. A chat is available only between users who follow each other and have accepted relationships in both directions; the composer is unavailable for policy reasons only when the API confirms that relationship is missing. The UI is transport-neutral so a future WebSocket transport can replace polling.
- Notifications use a 4-second adaptive unread-count polling transport with visibility/focus recovery; the full list refreshes while Notifications is open.
- Usernames are case-insensitive identities: signup and Settings check availability before submission, the API remains authoritative, and accepted values are canonicalized to lowercase.
- The web production build and TypeScript checks are the current automated web verification. Browser end-to-end coverage, deployed Vercel configuration, and R2 health still require release verification.

## Project Documentation

This repo is governed by a small set of living documents rather than a static PRD.
**The Product Requirements Document is not the source of truth for what's built —
these files, and the live implementation, are:**

- **`RULES.md`** — active product/business logic rules, organized by feature area.
  Read before changing behavior.
- **`packages/design/design.md`** — binding design tokens and component contracts.
  Read before any visual/UI/layout change.
- **`CHANGELOG.md`** — dated change history plus a maintained "Current State" summary
  at the top. Read first for project history and current state.
- **`AGENTLOG.md`** — detailed per-change entries (agent, model, prompt summary,
  files touched, reasoning). Updated alongside every `CHANGELOG.md` entry.

When these were prepared, this set was considered sufficient to fully rebuild Friink
from scratch.

## For AI Agents — Keep Documentation Current

### Always do this

- Read `CHANGELOG.md` and `AGENTLOG.md` before starting any task.
- Read `RULES.md` before changing product or business behavior.
- Read `packages/design/design.md` before making any visual, layout, or styling change.
- Keep reusable behavior and layout fixes at the shared component or documented
  contract level. Do not use inline styles, route-only patches, or page-specific
  quick fixes for global UI behavior.
- Web app styling belongs in `web/app/globals.css` and the shared tokens generated
  from `web/theme.config.ts`. Components must use semantic classes; runtime-only
  geometry may update documented CSS custom properties through refs, but JSX
  `style` props are not permitted. This rule applies to `web/` only; the public
  site remains outside this cleanup scope.

### After finishing a task

- Every task or prompt processed must update the project documentation before the task
  is considered complete — no change is too minor to log. Append a dated entry to
  `CHANGELOG.md` and a corresponding detailed entry to `AGENTLOG.md` for every task.
- New documentation log timestamps must use UTC ISO 8601 format with seconds and a
  `Z` suffix: `YYYY-MM-DDTHH:mm:ssZ` (for example, `2026-08-30T08:32:16Z`). If an
  older entry has no known time, preserve its date-only value rather than inventing one.

- Update `packages/design/design.md` as needed whenever a change adds, removes, or
  alters a visual token, component contract, or shared UI pattern that future agents
  need to know in order to build consistent UI. Changes that do not alter a visual
  contract do not require a design entry; do not add noise entries for non-visual work.

- Update `RULES.md` as needed whenever a change adds, removes, or alters product,
  business, or platform behavior, such as monetization rules, verification requirements,
  or privacy constraints. Pure implementation details, refactors, and bug fixes that do
  not change platform behavior do not require a rules entry. Never delete old rules;
  mark superseded rules as Deprecated instead.

- Read `README.md` once at the start of each work session. For any task involving the
  stack, infrastructure, environment setup, or deployment configuration, check this
  README first because its Stack section is the authoritative source. A full README
  re-read is not required before every task.

- Commit before switching agents or handing off work. Do not run a full build or
  test suite automatically as a matter of course — verification is done manually.
  Only run a targeted check (for example, a single affected test or a type-check on
  changed files) if the task specifically requires it or you are uncertain a change
  compiles.

- New or changed API endpoints must be verified with a real request/response
  check before the task is considered complete — confirm the endpoint returns
  the expected status and response shape, not just that the code compiles or
  imports cleanly. This is required regardless of confidence level; "the code
  looks correct" is not sufficient evidence for an endpoint. This is a
  targeted check (one real call), not a full test suite run, and does not
  conflict with the manual-verification-by-default rule above.
