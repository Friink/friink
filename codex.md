# Friink Codex Handoff

Last updated: 2026-08-14

This file is a working handoff for another Codex instance on the same project. Keep it factual, concise, and up to date as the implementation moves.

## Project Layout

- `api/` NestJS backend with Drizzle/Postgres.
- `web/` Next.js frontend and public Friink site shell.
- `mobile/` brand assets only, no runnable app yet.

## Team Practice

- Always read the root `CHANGELOG.md` first before making changes.
- Update the changelog as part of the work so the shared state stays current.
- Treat the changelog as the source of truth for what has changed and what is still left to do.
- Before handing off, go through the relevant changes once more and make sure nothing is left ambiguous or half-finished in the changelog.

## Current State

- Auth is wired for local demo use.
- Signup is a two-step flow:
  - step 1: email, password, confirm password
  - step 2: name, username, date of birth
- OTP is currently disabled for signup.
- Login and signup both go through the API.
- Auth success is stored in `localStorage` on the web client.
- The signed-in user is passed into the app shell, sidebar, profile, and composer.
- The root landing page is back at `/`.
- All `Early access` CTAs in the landing page should route to `/login`.
- `/login` is the auth entry point.

## Backend Details

- API listens on port `3001` in local dev.
- Frontend is on port `3000`.
- API base path is `/api`.
- JWT login requires `JWT_SECRET` and `JWT_EXPIRES_IN`.
- Local `api/.env` currently includes:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN=7d`
  - `SIGNUP_OTP_ENABLED=false`
- Database is Neon/Postgres, not local SQLite.

## Important Migrations

- `api/drizzle/0001_signup_otp.sql`
- `api/drizzle/0002_add_user_name.sql`

The `name` column migration is required for signup to work.

## Files of Interest

- `web/lib/auth.ts`
  - API fetch helpers for login/signup
  - localStorage session helpers
- `web/components/login-screen.tsx`
  - two-step signup UI and login UI
- `web/components/app-shell.tsx`
  - signed-in app shell
- `web/components/profile-screen.tsx`
- `web/components/side-drawer.tsx`
- `web/components/post-screen.tsx`
- `web/public/friink-site/index.html`
  - landing page CTAs
- `api/src/auth/auth.service.ts`
  - signup/login backend logic
- `api/src/database/schema.ts`
  - users and signup_requests schema

## What To Preserve

- Do not move signup/login fields around unless the UX is explicitly changing.
- Keep the landing page CTA behavior consistent:
  - `Early access` goes to `/login`
  - `Try now` goes to `/login`
- Do not stage secrets from `api/.env`.
- Avoid staging generated build artifacts unless there is a specific reason:
  - `web/tsconfig.tsbuildinfo`
  - `api/tsconfig.tsbuildinfo`
  - `web/.next`

## Known Intentional Gaps

- No OTP signup flow in the UI right now.
- No server-backed session refresh.
- No real backend data for feed/profile content yet.
- `mobile/` is not started beyond branding assets.

## Demo Status

The project was verified locally after:

- applying the missing `name` migration
- starting the API on `3001`
- starting the web app on `3000`

Always confirm both services are live before testing login or signup:

1. API must be running on `http://localhost:3001`
2. frontend must be running on `http://localhost:3000`
3. `JWT_SECRET` is present in `api/.env`
4. migrations have been applied to Neon
5. frontend `NEXT_PUBLIC_API_BASE_URL` is pointing at the API if staging uses a different host

If a route returns `404`, do not assume the frontend is broken; check whether the API process is actually running on the expected port first.

## Suggested Next Steps

- Decide whether staging should call a deployed API URL instead of `localhost`.
- Confirm whether auth should stay client-side with `localStorage` or move to a more durable session model later.
- Continue backend coverage for profile, feed, and post data after auth.
