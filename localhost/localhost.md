Localhost Setup — Friink (web + api)

This document describes how to set up and run the Friink monorepo locally for the first time (web + api). It assumes a Windows developer environment (PowerShell or CMD).

Prerequisites
- Node.js (v18+ recommended) and `npm` on PATH
- Git (to clone repo)
- Optional: Docker/Postgres if you want a local Postgres instead of the provided Neon DB

Important environment variables
- `DATABASE_URL` — Postgres connection string (example staging Neon DB):
  `postgresql://neondb_owner:npg_KvgWhwi4C6oe@ep-floral-poetry-azd2jxuj-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `SIGNUP_OTP_ENABLED`, `NEXT_PUBLIC_API_BASE_URL` — see `CHANGELOG.md` for notes; `JWT_SECRET` is required for auth tokens in real runs.

Files I added
- `start-local.ps1` — PowerShell launcher at repo root. Installs deps (if missing) and opens two PowerShell windows to run the Next web dev server and the Nest API dev server. By default it sets `DATABASE_URL` to the Neon URL above. Run from repo root with `.
start-local.ps1`.
- `start-local.cmd` — CMD launcher at repo root with similar behavior for `cmd.exe`.
- There is also a small start file inside the `web` folder: `web/start-local.cmd` which simply runs the web dev script (`npm run dev:local`). Use it if you prefer starting only the web app.

Quick start (one command)

PowerShell (preferred):

```powershell
# from repo root
.\start-local.ps1
```

CMD:

```
start-local.cmd
```

What the launchers do
- Install `web` and `api` dependencies if `node_modules` are missing.
- Start the Next dev server in a new window: `cd web && npm run dev` (local: http://localhost:3000)
- Start the Nest API in a new window with `DATABASE_URL` set: `cd api && npm run start:dev` (listens on port 3001 by default)

Manual steps (if you prefer to run commands yourself)

1. Install dependencies

PowerShell / CMD:

```powershell
npm --prefix web install
npm --prefix api install
```

2. Run database migrations (required for schema/tables)

Make sure `DATABASE_URL` is set to the desired Postgres (Neon) connection string.

PowerShell example:

```powershell
$env:DATABASE_URL = "<your DATABASE_URL>"
npm --prefix api run db:migrate
```

3. Start services

Start the web dev server:

```powershell
# from repo root
npm --prefix web run dev
# or for local host binding on port 3000 explicitly
npm --prefix web run dev:local
```

Start the API (with DATABASE_URL set):

```powershell
$env:DATABASE_URL='<your DATABASE_URL>'
npm --prefix api run start:dev
# or run via ts-node for dev convenience
npx --prefix api ts-node src/main.ts
```

Confirm running
- Web UI: http://localhost:3000 — the Next dev server serves the landing page.
- API: http://localhost:3001/api — `GET /api` returns a 404 (expected). Test routes like `POST /api/auth/signup` and `POST /api/auth/login`.

Example smoke test (Node.js):

```bash
node -e "(async()=>{const r=await fetch('http://localhost:3001/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test User',email:'test@example.com',username:'testuser',password:'Password123!',dateOfBirth:'1990-01-01'})});console.log('STATUS',r.status);console.log(await r.text())})()"
```

Notes, caveats and tips
- The API uses a global `pg` Pool for serverless safety — a valid `DATABASE_URL` is required to run migrations and to start the API without errors.
- The repository contains a development-only route `web/app/dev-settings/page.tsx` — remove or gate it before production.
- If you prefer integrated VS Code terminals instead of opening new windows, I can update the launcher to run both services in the current terminal or create an npm script that uses `concurrently`.
- Node/Next/Nest versions are present in `package.json` files. The Next version in this repo has security warnings; consider upgrading before production.

If you want, I can:
- Automatically run `npm --prefix api run db:migrate` from the launcher before starting the API.
- Add an npm `scripts` entry (`npm run dev:local`) that starts both web and api using `concurrently` (cross-platform).

---
Generated on 2026-08-16 by the repo assistant.

## Test account

- I tested the supplied account against the running local API:
  - Email: `muflah@outlook.com`
  - Password: `&Virpass090`
  - Result: login succeeded (HTTP 201) and the API returned a valid `accessToken` and user payload.

Notes: The API must be started with `JWT_SECRET` set (the launchers now set a default `dev-secret`). If the server was started without `JWT_SECRET`, login attempts return `400: JWT_SECRET is required.` — restart the API with the `JWT_SECRET` env var if you see that error.

## Resetting an existing user's password (SQL)

If you have a registered email but don't know the password, you can reset it by generating a bcrypt hash and updating the `users` table directly. Example steps (run from `api`):

1. Generate a bcrypt password hash (Node):

```powershell
node -e "const {hash}=require('bcryptjs');(async()=>{console.log(await hash('NewPassword123!',12))})()"
```

2. Update the database (psql / DB client):

```sql
UPDATE users
SET password_hash = '<copied-bcrypt-hash>', status = 'active', email_verified_at = now()
WHERE email = 'muflah@outlook.com';
```

After updating the password hash, attempt to log in with the new password.

## Staging DB & Test Credentials (for quick setup)

- **Staging DATABASE_URL** (Neon):

  `postgresql://neondb_owner:npg_KvgWhwi4C6oe@ep-floral-poetry-azd2jxuj-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

- **Test account** (confirmed working on local run):
  - Email: `test@friink.com`
  - Password: `testAcc123!`

Warning: These credentials and the staging DB string are sensitive. Do not commit different production secrets into the repo. Use them only for local development or testing in a trusted environment.

