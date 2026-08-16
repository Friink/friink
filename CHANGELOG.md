# Changelog

> INSTRUCTIONS FOR AI AGENTS: Before starting any task, read this file
> for project history and current state. After completing any change to the
> codebase, add a dated entry here summarizing what changed and why. Also
> read AGENTLOG.md for the most recent detailed change context.
>
> NOTE FOR AGENTS: Whenever you update this file, you MUST also append a
> corresponding detailed entry to AGENTLOG.md describing the exact files or
> scope touched and why. Keep both files synchronized.

This changelog uses dated entries instead of release versions. Keep the "Current State" section updated in place, then append new dated entries below it with app tags.

## Current State
_Last updated: 2026-08-16_

- [api] Signup creates active users by default for testability, with OTP signup still available behind `SIGNUP_OTP_ENABLED=true`. JWT login is available on `POST /auth/login` and returns a bearer token plus the user payload. The API is configured for local development with `DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN`. The API `tsconfig` no longer includes `baseUrl` because it caused local config errors; use project-relative paths instead. Local demo validation was relaxed so the signup payload can pass through without being rejected by the strict validation layer during dev testing. Missing: refresh tokens, logout/session revocation, email delivery, profile CRUD, feed/post APIs, and production integrations.
- [web] Auth is now route-gated: signed-in users are redirected away from `/` and `/login` to `/home`, and logging out returns them to `/`. The landing page keeps the local Nunito typography for display/CTA work while the app uses Inter. The post composer has a bottom footer, the floating nav hides during composition, and the settings screen is streamlined for UI-only work. Missing: server-backed session refresh, OTP verification UI, and real backend data for profile/feed content.
- [repo] `AGENTLOG.md` is kept in sync with `CHANGELOG.md` and no longer uses a `User` field in entry templates.

## 2026-08-16

### Fixed
- [infra] Fixed the backend Vercel deployment issue by adding `api/vercel.json` with an explicit `outputDirectory`, preventing the “No Output Directory named public found” error for the Nest API serverless function.
- [web] Closed the final TypeScript build blockers by tightening the literal tab unions in the app shell and fixing the stale signup back-navigation step in the login flow.
- [docs] Removed the `User` field from the root `AGENTLOG.md` template so future entries stay consistent and no one adds it again.

### Verified
- [api] `cd api && npm run build` completed successfully after the Vercel config fix.
- [web] `cd web && npm run build` completed successfully with compilation, lint/type checks, and page optimization all passing.

## 2026-08-15

### Added
- [web] Development-only `/dev-settings` page for UI-only settings iteration.
- [web] Bottom-fixed post composer actions and a compose-mode hide state for the floating bottom navigation.
- [infra] Vercel serverless wrapper and deployment config for the Nest API.
- [web] Landing page font split using local Nunito for display/CTA styling while app shell remains on Inter.
- [repo] Agent audit workflow with `AGENTLOG.md` and sync instructions in `CHANGELOG.md`.

### Changed
- [web] Removed the Settings header chrome and kept the tab bar directly under the header for cleaner UI previews.
- [api] Switched the database module to a global `pg` Pool to fit serverless hosting constraints.
- [web] Added route guards to redirect signed-in users away from public auth screens and route logout to `/`.
- [web] Tightened tab callback typing and state unions to satisfy strict TypeScript builds.

### Fixed
- [api] Repaired the local API startup workflow, rebuilt the server, and validated the app could run locally for auth testing.
- [web] Fixed CSS and runtime issues in the settings UI and route logic.
- [repo] Removed stale agent docs and synced the changelog/agent log history.

### Notes
- The `/dev-settings` route is development-only and should be gated or removed before production.
- Required Vercel environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SIGNUP_OTP_ENABLED`, and `NEXT_PUBLIC_API_BASE_URL`.

## 2026-08-14

### Added
- [api] Added JWT login and made OTP signup optional behind an environment flag.
- [api] Enabled CORS for the local web app and cleaned up JWT typing so the backend builds locally.
- [api] Removed the unnecessary `baseUrl` entry from the API TypeScript config.
- [api] Added the missing `name` column migration for signup.
- [web] Wired login/signup forms to the API endpoints.
- [web] Persisted auth sessions in `localStorage` and redirected authenticated users into the app shell.
- [web] Replaced hard-coded user identity with the signed-in user across the app shell and profile/composer screens.
- [web] Split signup into a two-step credentials/profile UI.
- [web] Right-aligned signup actions and styled the back control as a hollow button.
- [web] Updated landing page CTA behavior so all `Early access` actions route to `/login`.
- [web] Added the Settings tabs for General, Account, and Privacy & Safety.
- [mobile] Added the initial mobile brand asset structure.

### Changed
- [web] Simplified signup helper copy while keeping the step labels clear.
- [web] Removed the long login helper paragraph and the password hint from the signup UI.
- [web] Added client-side validation and a best-effort username uniqueness check.
- [web] Fixed password visibility toggles, tab order, and date-picker icon visibility.
- [web] Refined the custom error page presentation and error code display.
- [web] Restored the public landing page at `/` and kept `/login` as the auth entry point.

### Notes
- This is the baseline snapshot for the monorepo so future work can be traced by app and date.
- Local demo flow is testable after restarting the API with the correct JWT env values and applying the DB migration.
- Added local startup check scripts to confirm the API and web app both run on the expected ports before verification.
