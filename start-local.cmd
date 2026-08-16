@echo off
REM start-local.cmd
REM Usage: Run this from the repo root to install deps (if needed) and
REM open two cmd windows: one for the Next web dev server and one for the Nest API dev server.

SET "DATABASE_URL=postgresql://neondb_owner:npg_KvgWhwi4C6oe@ep-floral-poetry-azd2jxuj-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SET "JWT_SECRET=dev-secret"

echo Repo root: %~dp0

if not exist "web\node_modules" (
  echo Installing web dependencies...
  npm --prefix web install
)

if not exist "api\node_modules" (
  echo Installing api dependencies...
  npm --prefix api install
)

echo Starting web (Next) in a new window...
start "web" cmd /k "cd /d "%~dp0web" && npm run dev"

echo Starting api (Nest) in a new window with DATABASE_URL set...
echo Running DB migrations against: %DATABASE_URL%
set DATABASE_URL=%DATABASE_URL%
set JWT_SECRET=%JWT_SECRET%
npm --prefix api run db:migrate

start "api" cmd /k "set DATABASE_URL=%DATABASE_URL% && set JWT_SECRET=%JWT_SECRET% && cd /d "%~dp0api" && npm run start:dev"

echo Launched web and api. Check the new windows for logs.
