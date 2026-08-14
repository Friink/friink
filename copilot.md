# Friink setup guide for Codex

This repo is a small monorepo with two active app folders:

- `api/` — NestJS backend
- `web/` — Next.js frontend
- `mobile/` — currently only brand assets, no runnable app yet

## Prerequisites

- Node.js 18+ or 20+
- npm
- PostgreSQL database running locally or remotely

## Environment variables

Create a `.env` file in `api/` with values like:

```bash
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/friink
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
SIGNUP_OTP_ENABLED=false
```

The frontend reads the backend at `http://localhost:3001/api` by default.

## Install dependencies

From the repo root:

```bash
cd api && npm install
cd ../web && npm install
```

If needed, install root dependencies too:

```bash
cd .. && npm install
```

## Run the app

Terminal 1 — backend:

```bash
cd api
npm run start:dev
```

Terminal 2 — frontend:

```bash
cd web
npm run dev:local
```

Then open:

- Frontend: http://localhost:3000
- API: http://localhost:3001/api

## Database setup

If the database schema is not yet migrated:

```bash
cd api
npm run db:generate
npm run db:migrate
```

## Current project status

- Auth is wired to the API in the web app.
- Signup/login flow works against the backend.
- The app stores the session in `localStorage`.
- The settings screen includes the requested cosmetic tabs: General, Account, and Privacy & Safety.
- Theme stays under General.
- Account includes an editable username and a read-only unique user ID.
- Privacy & Safety is currently a cosmetic UI placeholder.

## Known issue to watch for

If the web app shows missing chunk/cache errors or repeated 404s after edits, clear the Next dev artifacts and restart:

```bash
cd web
rm -rf .next
npm run dev:local
```

On Windows PowerShell, use:

```powershell
cd web
Remove-Item -Recurse -Force .next
npm run dev:local
```

## Important notes

- The `api` app uses CORS for `http://localhost:3000`.
- `SIGNUP_OTP_ENABLED=false` keeps signup simple for local testing.
- The app is not production-ready yet; this is a local development handoff file.
 - The `api` app uses CORS for `http://localhost:3000`.
 - `SIGNUP_OTP_ENABLED=false` keeps signup simple for local testing.
 - Recent UI updates (2026-08-14): removed the long login helper paragraph and the inline password rule hint from the signup UI. Client-side validation now runs earlier in the signup flow: email and password are validated before advancing to the profile step; username format is validated on step 2 and the client attempts a best-effort uniqueness check against `GET /api/auth/username-available?username=...` if the endpoint exists.
 - Password/confirm-password behavior: confirm-password has an independent visibility toggle and the password eye buttons are skipped in the Tab order so keyboard navigation focuses inputs first.
 - Date picker calendar icon: dark-mode visibility fixed by inverting the calendar indicator in CSS.
 - The app is not production-ready yet; this is a local development handoff file.
