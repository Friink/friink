# Changelog

This changelog uses dated entries instead of release versions. Keep the "Current State" section updated in place, then append new dated entries below it with app tags.

## Current State
_Last updated: 2026-08-14_

- [api] Signup creates active users by default for testability, with OTP signup still available behind `SIGNUP_OTP_ENABLED=true`. JWT login is available on `POST /auth/login` and returns a bearer token plus the user payload. The API is configured for local development with `DATABASE_URL`, `JWT_SECRET`, and `JWT_EXPIRES_IN`. The API `tsconfig` no longer includes `baseUrl` because it caused local config errors; use project-relative paths instead. Local demo validation was relaxed so the signup payload can pass through without being rejected by the strict validation layer during dev testing. Missing: refresh tokens, logout/session revocation, email delivery, profile CRUD, feed/post APIs, and production integrations.
- [web] Login is wired to the API and signup uses a two-step UI: credentials first, then profile details. Successful auth stores a session in `localStorage`, and the signed-in user is passed into the shell, profile, sidebar, and composer. The landing page now points every `Early access` CTA to `/login`. The signup screens keep the step labels and password rule hint, with the back control styled as a hollow outline button. The settings screen includes General, Account, and Privacy & Safety tabs, with theme under General, editable username under Account, and a read-only unique user ID. Privacy & Safety is cosmetic-only and ready for UI testing. Missing: server-backed session refresh, OTP verification UI, and real backend data for profile/feed content.
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
