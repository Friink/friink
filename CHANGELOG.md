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
_Last updated: 2026-08-27_

- [api] All broken/non-functional backend auth controllers, services, database schemas, and drizzle migrations have been removed from `api/`. The `AppModule` and `package.json` in `api/` are kept minimal and clean.
- [web] The deployed frontend runs entirely in self-contained demo mode: `/` serves the landing page from `web/public/friink-site/index.html` with seamless `<base target="_top">` navigation to `/home` and `/login`. Authentication is handled directly via mock demo sessions in `web/lib/auth.ts`, allowing full exploration of the UI mockup without any backend requirement. The subscribe section now submits to Zoho Forms for real email collection.
- [infra] The repository and root `vercel.json` are streamlined to deploy the Next.js frontend (`web`) to Vercel without broken serverless API handlers or missing database environment dependencies.
- [web] The shared `FloatingBar` is the persistent contextual surface: it provides compact default navigation, full-width chat and post-composer controls, and composer layouts reserve space for it without nested scrolling. The message-list route is `/chat`.

## 2026-08-27

### Changed
- [web] Renamed the floating navigation component and styling namespace to `FloatingBar` / `floating-bar`, and made the default three-icon navigation compact while contextual composer modes span the available page width.
- [web] Moved direct-chat attachment, message, and send controls into the floating bar. Moved post attachment and publish controls into the same bar while keeping the post textarea in the compose screen.
- [web] Renamed the message-list route from `/messages` to `/chat` and updated app-shell navigation.

### Fixed
- [web] Restored the default floating navigation fallback when no contextual controls are provided, so the Compose control remains available.
- [web] Removed nested compose scrolling and constrained the post textarea to end above the persistent floating bar.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed.

## 2026-08-18

### Changed
- [web] Integrated the Zoho Email Subscription form into the landing page subscribe section (`#subscribe`). The form now POSTs to the real Zoho endpoint with proper hidden fields and field attributes, while keeping the user on-page via a hidden iframe target.
- [web] Fixed form submission bug where disabling inputs synchronously in the submit handler caused the `Email` field to be excluded from POST data; deferred UI feedback with `setTimeout`.

### Verified
- [web] Form structure matches the original Zoho form schema; submit handler allows native form submission before disabling inputs.

### Removed
- [api] Removed auth controllers, services, DTOs, database schemas, drizzle migrations, and serverless handler from `api/`.
- [infra] Removed `api/vercel.json` and cleaned up `api/package.json`.

### Changed
- [web] Added `<base target="_top">` to `web/public/friink-site/index.html` to ensure iframe landing page links break out to top-level routes smoothly.
- [infra] Updated root `package.json` and local start scripts (`start-local.ps1`, `start-local.cmd`, `scripts/*`) to focus on launching the Next.js web application.

### Verified
- [web] Ran `npm --prefix web run build`, successfully generating all 15 static/dynamic routes with zero compile errors.

## 2026-08-17

### Changed
- [web] Made the Vercel frontend demo self-contained: the public landing page now provides a direct `Explore the demo` path and the local login/signup flow no longer checks username availability through the unavailable API.
- [infra] Removed the obsolete API build and API-only route override from the root Vercel config, allowing the Next frontend's normal routes to serve on the demo deployment.
- [docs] Recorded the production-safe frontend-only demo behavior in the repo notes.

### Verified
- [web] `npx tsc --noEmit` passes, a source audit confirms there are no frontend API/network requests, and `npm run build` completes successfully with Next's single-worker build setting.

### Changed
- [web] Flattened the shared radius styling so buttons and single-line inputs use an 8px corner radius instead of the pill-style `--radius-pill` default across the app and landing UI.
- [docs] Recorded the styling adjustment and the live localhost verification state in the repo notes.

### Verified
- [web] `http://localhost:3000` responded with `200 OK` after the shared style update.


### Changed
- [web] Enabled a localhost-only demo auth bypass so the login button creates a demo session instead of calling the unavailable backend. This lets the frontend render all app screens and routes without the API running.
- [docs] Added the localhost startup troubleshooting notes to the repo history so future agents understand why the API was not reliable and why the frontend-only demo path was adopted.

### Fixed
- [web] Kept the app accessible locally by bypassing backend auth during UI exploration while the API remains intentionally left alone.
- [repo] Synced `CHANGELOG.md` and `AGENTLOG.md` to reflect the current frontend-only localhost workflow.

### Notes
- The Nest API was unstable locally due to a missing dist entrypoint issue, port conflicts on `:3001`, and a broken watch launch path; it was not required to achieve a working frontend demo.
- The frontend now creates a demo session in `localStorage` on login, so local navigation and page viewing are possible even when the backend is down.
- The app is intended to run locally with `npm --prefix web run dev:local`; the API is intentionally not required for the UI-only demo mode.

## 2026-08-16

### Fixed
- [docs] Corrected inconsistent `Notes` labels and newest-first entry guidance in `AGENTLOG.md`.
- [web] Added the requested blank source line to the public landing page without changing its behavior.
- [infra] Fixed the backend Vercel deployment issue by adding `api/vercel.json` with an explicit `outputDirectory`, preventing the “No Output Directory named public found” error for the Nest API serverless function.
- [infra] Corrected the monorepo routing in the root `vercel.json` so the Next app serves `/`, `/login`, and other app routes normally while `/api/*` continues to route to the Nest serverless function.
- [web] Closed the final TypeScript build blockers by tightening the literal tab unions in the app shell and fixing the stale signup back-navigation step in the login flow.
- [docs] Removed the `User` field from the root `AGENTLOG.md` template so future entries stay consistent and no one adds it again.

### Verified
- [web] `cd web && npm run build` completed successfully.
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
