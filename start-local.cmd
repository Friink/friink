@echo off
REM start-local.cmd
REM Usage: Run this from the repo root to install deps (if needed) and
REM start the Next web dev server.

echo Repo root: %~dp0

if not exist "web\node_modules" (
  echo Installing web dependencies...
  npm --prefix web install
)

echo Starting web (Next) in a new window...
start "web" cmd /k "cd /d "%~dp0web" && npm run dev:local"

echo Launched web server at http://localhost:3000
