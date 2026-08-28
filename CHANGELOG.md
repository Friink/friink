# Changelog

> INSTRUCTIONS FOR AI AGENTS: Before starting any task, read this file
> for project history and current state. After completing any change to the
> codebase, add a dated entry here summarizing what changed and why. Also
> read AGENTLOG.md for the most recent detailed change context.
>
> DESIGN SYSTEM RULE: Before making any visual, UI, layout, spacing, or
> styling change, you MUST read packages/design/design.md in full —
> specifically the "Tokens" and "Component Contracts" sections. All rules,
> dimensions, alignments, and component variants documented there are
> binding and must be strictly adhered to without creating ad-hoc overrides.
>
> NOTE FOR AGENTS: Whenever you update this file, you MUST also append a
> corresponding detailed entry to AGENTLOG.md describing the exact files or
> scope touched and why. Keep both files synchronized.

This changelog uses dated entries instead of release versions. Keep the "Current State" section updated in place, then append new dated entries below it with app tags.

## Current State
_Last updated: 2026-08-28_

- [api] The wiped `api/` folder now contains a structured FastAPI backend with async SQLAlchemy/Postgres wiring, Alembic migrations, Neon Postgres support, signup/login/JWT/refresh/logout/current-user routes, text-only post and quote-post creation, dual-handshake follow requests/connections, OTP/email stubs, focused validation/lockout tests, and Vercel entrypoint support.
- [api] Posts and quote-posts use a single `posts` table with nullable `quoted_post_id`; media schema is reserved through minimal `post_media` storage placeholders, but upload/compression/storage remains pending an object storage decision.
- [api] Connections use a single `follow_requests` table: pending rows represent requests, accepted rows represent active directional follows, and cancel/unfollow converts the row out of the active set so future follows require a fresh request cycle.
- [web] The deployed frontend runs entirely in self-contained demo mode: `/` serves the landing page from `web/public/friink-site/index.html` with seamless `<base target="_top">` navigation to `/home` and `/login`. Authentication is handled directly via mock demo sessions in `web/lib/auth.ts`, allowing full exploration of the UI mockup without any backend requirement. The subscribe section now submits to Zoho Forms for real email collection.
- [infra] The repository and root `vercel.json` are streamlined to deploy the Next.js frontend (`web`) to Vercel without broken serverless API handlers or missing database environment dependencies.
- [web] The shared `FloatingBar` is the persistent contextual surface: it provides compact default navigation, full-width chat and post-composer controls, and composer layouts reserve space for it without nested scrolling. The message-list route is `/chat`.
- [web] Added a dedicated `/notifications` screen with Friink-styled notification rows, and wired the header bell to open it. The notifications page is now stripped down to the list only, and feed/chat identities open dummy profile views that can launch chat.
- [web] Post headers and the sidebar/profile identity block now use the reusable `ProfileCard` pattern, and the home tabs are reduced to `Explore` and `Connections`.
- [web] Profile action buttons are now right-aligned, the sidebar profile highlight only tracks the signed-in user profile, and the settings account username field now matches the signup prefix treatment.
- [web] Tightened the settings username prefix wrapper again so the `@` marker sits outside the entered text cleanly.
- [web] Fixed the `[username]` profile route to read the path slug directly so other-user profile pages open reliably instead of falling back to the signed-in profile.
- [web] Settings username prefixes reset inherited absolute positioning, and other-user profile actions now use a compose/send message icon while own-profile Edit stays unchanged.
- [web] The three-dot page navigation control now opens a reusable dummy options menu instead of expanding the sidebar.
- [web] Removed the unused `FloatingActions` component, its empty render in the app shell, and its leftover CSS.
- [docs] Cleaned up the `AGENTLOG.md` component registry so it no longer singles out specific page modules as uniquely reusable.
- [docs] Hardened `packages/design/design.md` into an enforceable component contract doc by adding concrete Tokens, Component Contracts, and Unresolved subsections.
- [docs] Resolved `packages/design/design.md` historical discrepancies in Layout, Navigation, and Feed Behavior with dated changelog paper trails; verified all shared component contracts against live implementations; added the permanent design system standing instruction to `CHANGELOG.md` and `AGENTLOG.md`.

## 2026-08-28

### Changed
- [web] Made direct `/[username]/chat` routes resilient: missing/nonexistent local conversations now render an empty chat shell instead of a not-found message, and the composer stays disabled unless the connection status allows chat.

## 2026-08-28

### Added
- [api] Added persisted user profile fields for display name and about text, with a migration and server-side 256-character about validation.
- [web] Added a Settings Profile tab where users can edit Name and About, and wired the profile Edit action to open that tab.
- [web] Added an Account tab email update field with the same changed-state Update button behavior as username.

### Changed
- [api] Extended `PATCH /auth/me` to support partial username, email, display name, and about updates with uniqueness checks for username and email.
- [web] Persisted signup Name as backend `display_name` and mapped returned profile fields into the shared auth session.
- [docs] Updated the design contract for Settings/Profile edit ownership.

## 2026-08-28

### Changed
- [web] Removed seeded dummy posts from the app shell timeline so posts come from the API or remain empty.
- [web] Pointed the local frontend API base URL at the current FastAPI server on `http://localhost:8000`.
- [web] Normalized network fetch failures so `Failed to fetch.` includes terminal punctuation.

## 2026-08-28

### Added
- [api] Added the dual-handshake Connections system with send, accept, reject, cancel, unfollow/remove, followers, following, incoming pending, outgoing pending, and per-profile status endpoints.
- [api] Added Alembic schema for `follow_requests` with pending/accepted uniqueness per requester-recipient pair and a self-follow check constraint.
- [web] Wired other-user profile follow state/actions and incoming follow request accept/reject UI to the Connections API.

### Notes
- [api] Followers/following lists are public until a profile visibility system exists; pending incoming/outgoing request lists remain scoped to the signed-in user.
- [api] Follower/following counts are computed live from accepted rows rather than denormalized.

## 2026-08-28

### Changed
- [web] Moved Home and Chat from the default `FloatingBar` into the `SideDrawer`, leaving the floating default action as Post only.
- [web] Updated the sidebar navigation order to Profile, Home, Connections, Chat, Starred, and reduced the collapsed desktop profile avatar size for better alignment.
- [docs] Updated the design contract to match the new SideDrawer/FloatingBar navigation split.

## 2026-08-28

### Added
- [api] Added text-only post creation and quote-post creation using a unified `POST /posts` endpoint with optional `quoted_post_id`.
- [api] Added Alembic schema for `posts` plus reserved `post_media` placeholders without upload, compression, storage, or share logic.
- [web] Wired the compose flow to the posts API and added basic quote display in feed posts and the composer.

### Changed
- [docs] Updated the design system content-width guidance to remove the obsolete fixed `1024px` shell-content rule.

### Notes
- [api] Media handling remains deferred pending the object storage decision.
- [api] Quote-of-a-quote is allowed and displays only the directly quoted post. Soft-deleted or unavailable quoted originals serialize as `Original post unavailable.`

## 2026-08-27

### Changed
- [docs] Updated `docs/checklist.txt` to reflect the current Friink tooling: Next.js/React/TypeScript frontend, FastAPI backend, SQLAlchemy/Alembic, Neon Postgres, PyJWT auth, Vercel hosting, local scripts, and current testing tools.

## 2026-08-27

### Changed
- [api] Standardized FastAPI auth and validation error copy so all backend-surfaced error messages end with a period.

### Verified
- [api] Re-scanned auth/frontend error string patterns for missing terminal punctuation.
- [api] Ran `.\.venv\Scripts\python.exe -m pytest` in `api`; all 5 tests passed, with a sandbox-only pytest cache write warning.

## 2026-08-27

### Changed
- [api] Updated the duplicate-username signup error copy to `Username is already taken.` so the frontend alert includes the final period.

### Verified
- [api] Ran `.\.venv\Scripts\python.exe -m pytest` in `api`; all 5 tests passed, with a sandbox-only pytest cache write warning.

## 2026-08-27

### Verified
- [web] Checked the merged auth changes after conflict resolution: no conflict markers were present, `npm --prefix web run build` completed successfully after the known sandbox worker-spawn retry, and `npx tsc --noEmit` passed in `web`.

## 2026-08-27

### Changed
- [web] Reconnected the auth client to FastAPI signup/login responses, preserved backend auth error details in the login/signup alert, and stopped the signup username field from using browser username autofill.

### Verified
- [web] Ran `npm --prefix web run build`; the first sandboxed attempt hit the known Next.js worker-spawn `EPERM`, then the elevated rerun completed successfully with all 16 routes generated.
- [web] Ran `npx tsc --noEmit` in `web`.

## 2026-08-27

### Added
- [api] Created ignored local FastAPI environment files for development, staging, and production, with separate JWT secrets for staging and production.

### Changed
- [api] Tightened `api/.gitignore` so secret-bearing `.env*` files stay local while `.env.example` remains tracked.

### Verified
- [api] Confirmed `.env`, `.env.staging`, and `.env.production` are ignored by git and that FastAPI settings load the local development `.env`.

## 2026-08-27

### Changed
- [web] Updated the root landing route so users with a persisted non-default auth session are redirected from `/` to `/home`, while logged-out/demo-fallback visitors still see the landing page.

### Verified
- [web] Ran `npx tsc --noEmit` in `web` and `npm --prefix web run build`; the build generated all 16 routes successfully after running outside the sandbox due to local worker-spawn `EPERM`.

## 2026-08-27

### Added
- [api] Implemented backend-only authentication for FastAPI with separated config, models, schemas, routers, and services for signup, login, refresh, logout, and current-user lookup.
- [api] Added async SQLAlchemy models for `users` and `otp_codes`, Alembic configuration, and the initial auth migration.
- [api] Added JWT utilities, bcrypt password hashing, environment-driven CORS/cookie behavior, OTP/email service stubs, and a Vercel `api/index.py` entrypoint.
- [api] Added focused tests for password validation, username validation, age validation, and lockout behavior.

### Changed
- [api] Updated README and `.env.example` with auth, migration, local/Vercel environment, and frontend cookie-call notes.

### Verified
- [api] Installed new dependencies in `api/.venv`, reset/migrated Neon staging, confirmed tables `alembic_version`, `otp_codes`, and `users`, ran an end-to-end temporary signup/login smoke test, and deleted the temporary user.
- [api] Ran `python -m pytest` in `api`; all 5 tests passed. App import also succeeded. Secret scan confirmed the Neon credential was not written to repo files.

## 2026-08-27

### Added
- [api] Added Postgres/Neon wiring for FastAPI via `DATABASE_URL`, including a `/health/db` endpoint, local `.env` example, and `scripts/reset_database.py` to drop/recreate the `public` schema.

### Changed
- [api] Added `psycopg[binary]` and explicit `python-dotenv` dependencies for database connectivity and local environment loading.

### Verified
- [api] Installed the Postgres driver in `api/.venv`, reset the provided Neon staging database's `public` schema, and confirmed the FastAPI database health code returns `database: true`.

## 2026-08-27

### Changed
- [dev] Extended `localhost/localhost.ps1` so one script stops existing listeners on both web port `3000` and FastAPI port `8000`, starts the FastAPI API from `api/.venv`, starts the Next.js web app, and prints both local URLs.

### Verified
- [dev] Parsed `localhost/localhost.ps1` with PowerShell's parser to confirm syntax is valid without launching dev-server windows.

## 2026-08-27

### Added
- [api] Created a fresh FastAPI starter in `api/` with `app/main.py`, `requirements.txt`, API-specific `.gitignore`, and setup/run notes in `api/README.md`.

### Verified
- [api] Created/repaired `api/.venv`, installed FastAPI/Uvicorn, launched Uvicorn on `http://127.0.0.1:8000`, and confirmed `/` returns `Hello, World!`.

## 2026-08-27

### Changed
- [docs] Updated `packages/design/design.md` prose sections (Layout, Navigation, Feed Behavior) to accurately describe current shipped behavior (partitioned navigation across `FloatingBar`, `SideDrawer`, and `Header`; `/chat` route naming; `Explore`/`Connections` home tabs) with dated paper trail notes.
- [docs] Verified all 10 component contracts against active component implementations across all usage contexts (no contract violations found).
- [docs] Added a permanent standing instruction to `CHANGELOG.md` and `AGENTLOG.md` requiring agents to read `design.md`'s Tokens and Component Contracts sections before making any visual/UI/UX changes.

### Verified
- [web] Ran `npm --prefix web run build` to confirm clean compilation and zero route errors.

### Verified
- [docs] Re-read the top of `AGENTLOG.md` to confirm the registry note was removed cleanly.

## 2026-08-27

### Removed
- [web] Deleted `web/components/floating-actions.tsx` after confirming it was only imported/rendered as an empty placeholder.
- [web] Removed the matching `FloatingActions` import/render from `AppShell` and pruned the stale `.floating-actions` CSS.

### Verified
- [web] Confirmed no `FloatingActions` / `floating-actions` references remain outside generated build metadata, then ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all 16 route generations passed.

## 2026-08-27

### Added
- [web] Added a reusable `NavigationMenu` component with placeholder action buttons for the three-dot page navigation control.

### Changed
- [web] Rewired the nav bar overflow button to toggle the new options menu with outside-click and Escape dismissal.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all 16 route generations passed.

## 2026-08-27

### Changed
- [web] Reset the settings account username prefix positioning so the `@` marker no longer overlaps the handle text.
- [web] Changed only the other-profile message action icon from a comment/message bubble to a compose/send message icon.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all 16 route generations passed. Google Fonts optimization was skipped because the stylesheet could not be downloaded in the restricted network environment.

## 2026-08-26

### Changed
- [web] Switched the `[username]` profile route to derive the viewed handle from the actual URL path, and only treat the page as the signed-in profile when the slug matches the current user.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the profile-route fix.

## 2026-08-26

### Changed
- [web] Adjusted the settings account username prefix wrapper so the `@` marker sits outside the text field instead of overlapping the entered username.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the prefix-spacing cleanup.

## 2026-08-26

### Changed
- [web] Aligned the profile action button to the right for both own-profile Edit and dummy-profile message states.
- [web] Prevented the sidebar profile item from showing active when viewing another user’s dummy profile.
- [web] Fixed the settings account username field so the `@` prefix no longer gets covered and matches the signup input treatment.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the profile-state and settings spacing updates.

## 2026-08-26

### Changed
- [web] Moved the feed post date to sit below the profile card block, with the date left-aligned under the avatar/name/handle cluster.
- [web] Adjusted the dummy profile view spacing so the bio, follower stats, and action control line up from the left edge instead of floating in the middle.
- [web] Restored the self-profile action to Edit while keeping the dummy profile action as a message icon.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the profile spacing/action updates.

## 2026-08-26

### Changed
- [web] Reworked post headers to use the reusable `ProfileCard` pattern: avatar/name/handle on one line, with the post date moved below that block.
- [web] Simplified the home tab set to `Explore` and `Connections` only.
- [web] Applied the same identity block pattern to sidebar/profile contexts so the app uses a single shared profile card style.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the `ProfileCard` refactor.

## 2026-08-26

### Changed
- [web] Removed the notifications-page heading/copy/banner chrome so the page opens directly into the notification list.
- [web] Removed the chat list page title and search box, and shifted the compose affordance into dummy profile views instead.
- [web] Made feed posts and chat identities link into browsable dummy profiles, and added a message button to non-own profile views.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed after the chat/profile updates.

## 2026-08-26

### Added
- [web] Added a dedicated Notifications route and screen so the header bell opens a first-class inbox-style page instead of a placeholder control.

### Changed
- [web] Extended the shared app-shell screen union and page routing to support `/notifications`.

### Verified
- [web] Ran `npm run build` in `web`; Next.js compilation, lint/type checks, and all route generation passed, including the new notifications page.

## 2026-08-27

### Changed
- [web] Renamed the floating navigation component and styling namespace to `FloatingBar` / `floating-bar`, and made the default three-icon navigation compact while contextual composer modes span the available page width.
- [web] Moved direct-chat attachment, message, and send controls into the floating bar. Moved post attachment and publish controls into the same bar while keeping the post textarea in the compose screen.
- [web] Renamed the message-list route from `/messages` to `/chat` and updated app-shell navigation.
- [dev] Consolidated the root `localhost/` helpers around `start-local-dev.ps1`; it now stops only the listener on port 3000 and clears the generated `.next` cache before launching the web dev server. Removed the unused status checker and stale backend-oriented setup guide.
- [web] Removed stale fixed post-footer CSS, the header’s compensating negative logo margin, and viewport/transform-based floating-bar positioning in favor of container-relative layout constraints.
- [web] Refined navigation and header behavior: `/chat` is the visible Chat label, the shared back control is history-aware, desktop header/sidebar controls have a single aligned hamburger, and chat/compose no longer show duplicate back buttons.
- [web] Added a visible Back control to the login form, matching the signup-flow control and returning to the landing page.

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
