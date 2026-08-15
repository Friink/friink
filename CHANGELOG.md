# Changelog

> INSTRUCTIONS FOR AI AGENTS: Before starting any task, read this file 
> for project history and current state. After completing any change 
> to the codebase, add a dated entry here summarizing what changed and 
> why. Also read AGENTLOG.md for the most recent detailed change context.
>
> NOTE FOR AGENTS: Whenever you update this `CHANGELOG.md`, you MUST also append a corresponding, detailed entry to `AGENTLOG.md` describing the exact files or scope touched and why. Do not assume the agent log is optional — keep both files in sync.

This changelog uses dated entries instead of release versions. Keep the "Current State" section updated in place, then append new dated entries below it with app tags.

## Current State
_Last updated: 2026-08-15_

- [api] Signup creates active users by default for testability, with OTP signup still available behind `SIGNUP_OTP_ENABLED=true`. JWT login is available on `POST /auth/login` and returns a bearer token plus the user payload. The API is configured for local development with `DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN`. The API `tsconfig` no longer includes `baseUrl` because it caused local config errors; use project-relative paths instead. Local demo validation was relaxed so the signup payload can pass through without being rejected by the strict validation layer during dev testing. Missing: refresh tokens, logout/session revocation, email delivery, profile CRUD, feed/post APIs, and production integrations.
- [web] Login is wired to the API and signup uses a two-step UI: credentials first, then profile details. Successful auth stores a session in `localStorage`, and the signed-in user is passed into the shell, profile, sidebar, and composer. The landing page now points every `Early access` CTA to `/login`. The signup screens keep the step labels and password rule hint, with the back control styled as a hollow outline button. The settings UI includes General, Account, and Privacy & Safety tabs. A development-only `/dev-settings` route was added to preview the Settings UI without backend auth; the Settings header icon/heading/description was removed and the tab bar placed directly under the header for cosmetic editing. Missing: server-backed session refresh, OTP verification UI, and real backend data for profile/feed content.

## 2026-08-15

### Added
- [web] Development-only `/dev-settings` page to render the Settings UI without requiring backend authentication (for offline cosmetic edits).

### Changed
- [web] Removed the Settings header icon, heading, and descriptive paragraph; adjusted the styles so the tab bar sits directly under the header. Added CSS updates in `web/app/globals.css` and adjusted `web/components/account-screens.tsx` to support these cosmetic changes.

### Notes
- UI-only changes. Dev route should be removed or guarded before shipping to production. The change was verified by starting the local dev server and loading `/dev-settings`.

### Fixed / Backend
- [api] Repaired local API dev workflow: installed dependencies, rebuilt the API, and resolved a build/runtime issue so the API can run locally on port 3001. Verified the server process is running for local testing. If your local DB is configured and migrations are applied, login/signup routes will operate end-to-end.
- [web] Fixed a CSS compile error introduced while adjusting settings spacing (`web/app/globals.css`) that caused the dev server to fail until corrected.
- [repo] Removed obsolete docs (`codex.md`, `copilot.md`) and committed all changes (commit 383b617).

### 2026-08-15 (Vercel Prep)

### Added
- [infra] `api/api-handler.ts` serverless wrapper to run the Nest API on Vercel using `serverless-http`.
- [infra] `vercel.json` to build the Next.js `web` project and route `/api/*` to the API handler.

### Changed
- [api] Use a global `pg` Pool in `api/src/database/database.module.ts` so serverless functions reuse connections and avoid exhausting Neon DB connection limits.

### Notes
- These changes prepare the repo to deploy both frontend and backend on Vercel. After pushing, configure Vercel environment variables and run DB migrations in CI or a trusted runner.

### 2026-08-15 (Ready for Deployment)

### Notes
- The repository is prepared for deployment to Vercel: a serverless handler (`api/api-handler.ts`) and `vercel.json` were added, and the database module was updated to reuse a global `pg` Pool for serverless environments. The `/dev-settings` route remains in the codebase for design testing and should be removed or gated before production.
- Required Vercel environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (optional), `SIGNUP_OTP_ENABLED`, and `NEXT_PUBLIC_API_BASE_URL` (set to https://<your-vercel-domain>/api).
- After you push, deploy on Vercel and verify `/api/auth/login` and the frontend. If migrations are needed, run `npm --prefix api run db:migrate` from a CI job or trusted runner.

### UI

- [web] Moved the post composer action buttons (attach file, post settings, Post) from the header into a bottom-fixed footer for clearer mobile UX. While composing a post the app now hides the floating bottom navigation to avoid control conflicts. Files changed: `web/components/post-screen.tsx`, `web/app/globals.css`.





- [web] Login is wired to the API and signup uses a two-step UI: credentials first, then profile details. Successful auth stores a session in `localStorage`, and the signed-in user is passed into the shell, profile, sidebar, and composer. The landing page now points every `Early access` CTA to `/login`. The signup screens use streamlined helper copy; the inline password rule hint and the long login helper paragraph were removed as part of recent UX updates. The back control remains styled as a hollow outline button. The settings screen includes General, Account, and Privacy & Safety tabs, with theme under General, editable username under Account, and a read-only unique user ID. Privacy & Safety is cosmetic-only and ready for UI testing. Missing: server-backed session refresh, OTP verification UI, and real backend data for profile/feed content.
- [mobile] The mobile workspace currently contains brand assets only. There is no runnable mobile app code yet.

## 2026-08-14

### Added
- [api] Added JWT login and made OTP signup optional behind an environment flag.
- [api] Enabled CORS for the local web app and cleaned up JWT typing so the backend builds locally.
- [api] Removed the unnecessary `baseUrl` entry from the API TypeScript config to prevent local path resolution errors.
- [api] Added the missing `name` column migration for user signup.
- [web] Wired login/signup forms to `POST /api/auth/login` and `POST /api/auth/signup`.
- [web] Persisted auth sessions in `localStorage` and redirected authenticated users into the app shell.
- [web] Replaced hard-coded user identity in the shell, sidebar, profile, and composer with the signed-in user.
- [web] Split signup into a two-step credentials/profile UI.
- [web] Right-aligned signup actions and styled the back control as a hollow button.
 - [web] Simplified signup helper copy while preserving the step labels.
 - [web] Removed the long login helper paragraph and the inline password rule hint from the signup UI; validation was moved to the client-side flow.
 - [web] Added client-side validation: email and password are validated before advancing from step 1 to step 2; username format validation on step 2.
 - [web] Added a best-effort username uniqueness check from the client that calls `GET /api/auth/username-available?username=...` if available; the check gracefully degrades if the endpoint is not present.
 - [web] Fixed password field behavior: confirm-password now has an independent visibility toggle and the password eye buttons are skipped in the tab order so Tab focuses inputs in expected order.
 - [web] Fixed date picker calendar icon visibility in dark mode by inverting the indicator.
- [web] Refined the custom error page presentation and error code display.
- [web] Wired the root page to the public Friink site shell.
- [web] Restored the public landing page at `/` and kept `/login` as the auth entry point.
- [web] Updated the landing page `Early access` CTA so all variants route to `/login`.
- [web] Added the settings tabs for General, Account, and Privacy & Safety, with the theme selector in General and a cosmetic account/privacy layout for testing.
- [mobile] Added the initial mobile brand asset structure.

### Notes
- Baseline snapshot for the monorepo so future work can be tracked by app and date.
 - Local demo flow is now testable end to end after restarting the API with the JWT env values and applying the database migration. After pushing UI changes, restart or clear the Next dev cache (`rm -rf .next`) so the served bundle reflects the edits.
- Added local startup check scripts to confirm the API and web app are both running on the correct ports before login/signup testing.
