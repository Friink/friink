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
_Last updated: 2026-08-29_

- [api] The wiped `api/` folder now contains a structured FastAPI backend with SQLAlchemy/Postgres wiring via sync psycopg3 sessions, Alembic migrations, Neon Postgres support, signup/login/JWT/refresh/logout/current-user routes, unified post/quote/reply creation on one posts model, dual-handshake follow requests/connections, OTP/email stubs, focused validation/lockout tests, and Vercel entrypoint support.
- [api] Posts, quotes, and replies now use a single `posts` table with nullable `quoted_post_id`, `parent_post_id`, and a `kind` enum; replies are fetched per post thread while media schema remains reserved through minimal `post_media` storage placeholders pending an object storage decision.
- [api] Connections use a single `follow_requests` table: pending rows represent requests, accepted rows represent active directional follows, and cancel/unfollow converts the row out of the active set so future follows require a fresh request cycle.
- [web] The Deployed frontend makes **real fetch calls** to the FastAPI backend via `web/lib/auth.ts` and `web/lib/data.ts`. There is no demo/mock mode for logged-in flows; signup, login, post creation, connections, and profile editing all require the API. The `NEXT_PUBLIC_API_BASE_URL` env var must be set in the Vercel **web** project to the deployed API base URL — if absent or stale the browser falls back to `http://localhost:8000`, which is unreachable from a deployed context and produces "Failed to fetch" errors. The subscribe section submits to Zoho Forms for real email collection.
- [infra] **Two separate Vercel projects** are required: one for the Next.js `web` app (deployed from `web/`) and one for the FastAPI `api` app (deployed from `api/`, entrypoint `api/api/index.py`). There is no root `vercel.json`; each project is configured independently in the Vercel dashboard. The web project needs `NEXT_PUBLIC_API_BASE_URL` set to the API project's deployed URL. The API project needs `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL` (set to the web URL for CORS), and the other vars in `api/.env.example`. The application uses **sync `psycopg` (psycopg3)** through SQLAlchemy, avoiding the async DB driver/event-loop path that caused staging serverless crashes. As of 2026-08-28 the API Vercel project's existence and deployment status for staging is **unconfirmed** — must be verified in the Vercel dashboard.
- [web] The public landing page is now a native Next.js App Router route at `/`, not an iframe wrapper around `web/public/friink-site/index.html`. Landing styles are scoped in a CSS module, landing media assets live under top-level `web/public/brand` and `web/public/media`, and the old `web/public/friink-site/` folder has been removed.
- [web] Page titles now use the `Friink | Page Name` format through route-level metadata. Dynamic profile titles use the known display name when available and fall back to `@username`; deleted demo route names are guarded so `/compose`, `/dev-settings`, and `/floating` return 404 instead of becoming profiles.
- [web] The shared `FloatingBar` is the persistent contextual surface: it now hosts the reusable `Composer` for real post creation by default, starts floating-post entry in a compact single-line layout, expands into multiline borderless entry only as text needs vertical space, and uses the `/chat` route for message lists and direct chat. The old `/compose` route and post compose page components have been removed.
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

## 2026-08-29

### Fixed
- [web] Corrected drawer interaction behavior so the header hamburger persists the desktop open/collapsed state across route changes, while drawer item taps still close the drawer on mobile and outside clicks continue to dismiss it on mobile only.

### Verified
- [web] `npm run build` passed in `web` after the drawer desktop/mobile behavior fix.

## 2026-08-29

### Added
- [web] Added a dedicated post detail route at `/posts/[postId]` that renders the full post and reserves space for future replies, with dynamic page titles in the format `Friink | Post by User name` when the post can be resolved.
- [api] Added `GET /posts/{post_id}` so the frontend can load a single post for detail routes and metadata generation.

### Fixed
- [web] Restored sidebar icons in the collapsed drawer state after the recent icon-slot refactor by explicitly preserving the collapsed icon wrapper display rules.
- [web] Feed posts now clamp to four lines and show a `Show more...` link only when content overflows, routing to the new full post page instead of expanding inline in the feed.

### Verified
- [web] `npm run build` passed in `web` after the collapsed-sidebar fix, feed clamp/show-more behavior, and post detail route implementation.

## 2026-08-29

### Changed
- [web] Expanded the shared `ListRow` primitive from Chat and Connections to the remaining row-style screens, so Notifications, Directory, and Calendar event lists now reuse the same base row component instead of hand-rolled row markup.

### Verified
- [web] `npm run build` passed in `web` after the wider `ListRow` rollout.

## 2026-08-29

### Changed
- [web] Added a shared `ListRow` component for list-style people/conversation rows and moved both Connections and Chat list screens onto the same row structure and spacing contract.

### Fixed
- [web] Removed the full-app navigation flash between logged-in pages by initializing the shared app shell route from the cached auth session before route effects run.
- [web] Eliminated the layout drift between Connections and Chat list rows by replacing their separate row markup/CSS with one shared implementation.

### Verified
- [web] `npm run build` passed in `web` after the shared list-row refactor and the global page-transition flash fix.

## 2026-08-29

### Fixed
- [web] Changed the public landing page metadata title from `Friink | Home` to `Friink | A place for humans.` so the marketing route is distinct from the signed-in Home screen.

## 2026-08-29

### Changed
- [web] Reordered the `SideDrawer` primary navigation so `Home` appears before `Profile`, matching the intended priority order in the left rail.
- [web] Moved the floating post composer character count into the composer row beside the send button instead of rendering it below the bar.

### Fixed
- [web] Centered side-drawer icon slots more precisely so active items keep their icons visually centered within the green selected state.
- [web] Stopped the Settings route from briefly rendering a blank/white screen while refreshing `/auth/me` by seeding the shell from the existing stored session before the background refresh completes.

### Verified
- [web] `npm run build` passed in `web` after the side-drawer, composer-count, and settings refresh UX fixes.

## 2026-08-29

### Changed
- [api] Added a public `GET /auth/users/{username}` profile lookup so frontend profile and direct-chat screens can fetch a real stored `display_name` and `about` for other users instead of fabricating those values from the username slug.
- [api] Extended post responses to include `author_display_name` alongside `author_username` so the frontend can render the signed-up display name while keeping the username as the handle.
- [web] Updated profile, direct-chat header, and feed post mapping to treat the signup/settings `name` field as the canonical visible display name and keep `username` only for handle routing and mentions.

### Fixed
- [web] Removed the fallback behavior that synthesized other-user profile names from usernames on `/{username}` and direct chat headers when real profile data is available.

### Verified
- [web] `npm run build` passed in `web` after the display-name/profile wiring updates.
- [api] Targeted pytest validation could not run in this shell because `pytest` is not installed in the current Python environment.

## 2026-08-29

### Changed
- [web] Scoped the shared `FloatingBar` so it only renders on `/home` for post creation and on direct `/{username}/chat` routes for message composition, instead of appearing across every logged-in screen.
- [web] Standardized the remaining in-screen chat compose path to use the shared `web/components/composer.tsx` `Composer` component so post and chat composition both flow through the same reusable surface.
- [api] Added unified reply and quote support to post creation by introducing a `kind` field plus `parent_post_id`, and exposed `GET /posts/{post_id}/replies` for thread loading.
- [web] Added shared composer context states for replying and quoting from both the feed and post detail page, keeping the user on the current screen while the floating composer switches mode.
- [web] Extended the shared `Composer` with reusable context labels and quoted-post preview cards so post, reply, and quote composition use one component contract.
- [web] Updated the post detail screen to render real reply rows under the main post and to show full quoted-post content there instead of the feed clamp treatment.

### Fixed
- [web] Preserved post kind and quoted-post display metadata through the post thread mapper so replies stay in-thread and quote previews show the correct display name.
- [web] Cleaned up quote preview clamping so quoted content stays single-line only where intended instead of depending on brittle sibling selectors.
- [web] Feed post bodies and quoted post content now preserve newline formatting instead of collapsing multi-line posts into a single rendered line.
- [web] Added a 512-character limit and live character count to the floating post composer, matching the settings profile `About` field pattern.
- [web] Adjusted the compact multiline post composer textarea spacing so the `Write a post...` placeholder sits vertically centered before expansion.

### Known Issue
- [api][web] After the reply/quote post model changes, the app has been reported as failing to show existing posts and failing to create new posts. A temporary compatibility fallback for null legacy `kind` values was tried and then reverted because it did not resolve the issue. Treat migration/application state and live API contract drift as the first things to investigate in the next pass.

### Fixed
- [api] Applied Alembic migration `20260829_0005` to the staging database after direct inspection showed staging was still at `20260828_0004` and the `posts.kind`, `posts.parent_post_id`, and `post_kind` enum objects were missing.
- [api] Fixed the SQLAlchemy `Post.kind` enum mapping so it binds lowercase enum values (`post`, `quote`, `reply`) instead of Python enum member names (`POST`, `QUOTE`, `REPLY`), which was causing `GET /posts` to crash with `invalid input value for enum post_kind: "REPLY"`.

### Verified
- [api] Direct staging DB inspection now reports Alembic `20260829_0005`, `posts.kind`, `posts.parent_post_id`, and `post_kind` values `post`, `quote`, `reply`.
- [api] Reproduced the failing ORM query locally against staging DB before the enum fix, then confirmed the feed query succeeds and a temporary post inserts as lowercase `post`; the temporary smoke-test row was deleted.
- [api][web] Skipped frontend/browser verification and full web build per user direction; Vercel should build on deploy, and the user will test the browser flow.

## 2026-08-29

### Changed
- [web] Updated quote composer context copy to include the target display name, matching the reply label pattern: `Quoting User Name`.

### Verified
- [web] Build not run; text-only composer label update.

## 2026-08-29

### Audited
- [api][web] Confirmed reply threading and quote citation are not collapsed into one relationship: replies use `parent_post_id`, while quotes continue to use the separate `quoted_post_id` relationship and nested `quoted_post` response data.

### Notes
- [api] No code change needed for the relationship-separation concern. Future delete semantics still need an explicit product decision because both reply parents and quoted posts are self-referential post links with different likely behaviors.

### Verified
- [api][web] Read-only audit only; no build or tests run.

### Verified
- [web] `npm run build` passed in `web` after the reply/quote composer, post-thread updates, newline rendering, floating-bar visibility, and shared-composer/count updates, but runtime post loading/creation is currently reported broken and was not resolved in this pass.

## 2026-08-29

### Changed
- [web] Ported the static `friink-site` homepage into native Next.js JSX with scoped landing styles and React-managed subscribe form behavior, removing the iframe-wrapped landing page and deleting the old static `web/public/friink-site/` source once live references were gone.
- [web] Added route-level metadata/layout wrappers for all current app routes so titles render as `Friink | Home`, `Friink | Chat`, `Friink | Settings`, `Friink | Starred`, `Friink | Connections`, `Friink | Notifications`, `Friink | Login`, dynamic display-name profile titles, and error titles.
- [web] Removed the demo `/dev-settings` and `/floating` pages and guarded retired/demo names in the dynamic username route so they return 404 instead of being interpreted as profile slugs.
- [web] Reused the existing composer implementation as the default floating-bar post box instead of creating a new component. It starts in the compact single-line layout with attachment on the left, text in the middle, and post/send on the right; submitting from the floating bar creates a real post through the posts API and returns to Home.
- [web] Renamed `web/components/chat-composer.tsx` and `ChatComposer` to `web/components/composer.tsx` and `Composer` so the shared control is not chat-specific.
- [web] Made the floating composer functional by submitting through the existing posts API, removed the `/compose` route, and deleted the old post compose page/control components.

### Fixed
- [web] Added an auto-expanding floating-post composer mode with readable dark-theme text, borderless textarea styling, and bottom-aligned attach/send controls after text wraps or new lines are added. Chat keeps its existing one-line visual behavior.
- [web] Constrained the expanded floating composer to a readable max width and reduced the multiline textarea height cap so short multiline posts do not render as an oversized full-width box.
- [web] Pinned expanded floating composer controls to the bottom row so the attachment button remains bottom-left while multiline text occupies the top row.
- [web] Removed the expanded-only floating composer width override so the composer keeps the same width when switching from single-line to multiline.
- [docs] Updated `packages/design/design.md` to rename `ChatComposer` to `Composer`, document the compact-to-expanded floating-post behavior, and set composer attachment/send controls to the standard `8px` radius.
- [docs] Updated `packages/design/design.md` so `FloatingBar` + `Composer` are the canonical post creation surface.

### Verified
- [web] `npm run build` passed after the native landing page port and route metadata changes; the build route table contains 13 routes and no `/compose`, `/dev-settings`, or `/floating` pages.
- [web] Dev server checks on `http://localhost:3001` confirmed `/`, `/home`, `/chat`, `/connections`, `/connectionsfilter`, `/login`, `/notifications`, `/settings`, `/starred`, `/debug/error-preview`, `/mayachen`, `/mayachen/chat`, `/muflah`, and `/muflah/chat` return distinct `Friink | ...` titles with no `public-site-frame` or `friink-site` references.
- [web] Browser checks confirmed the landing page renders full-width at 1440x900 and 390x844, has no horizontal overflow on mobile, has no visible broken images, and updates the visible tab title to `Friink | Home`; deleted routes show the browser title `Friink | Error (404)`.
- [web] `npm run build` passed after the floating composer changes and again after the rename.

## 2026-08-28

### Fixed
- [api] Applied pending Neon database migrations through `20260828_0004`, restoring staging login and post feed endpoints after the deployed API code expected columns/tables that were not present yet.
- [api] Converted Alembic's migration runner from async SQLAlchemy to sync SQLAlchemy/psycopg so local and deployment maintenance commands use the same DB driver path as the API.
- [api] Made the follow-request enum migration resilient to a pre-existing `follow_request_status` enum left by an earlier partial migration attempt.

### Verified
- [api] `alembic current` reports `20260828_0004 (head)`.
- [api] Live `GET https://staging-api.friink.com/posts` returns `200` with CORS headers for `https://staging.friink.com`.
- [api] Live `POST https://staging-api.friink.com/auth/login` returns `200` for the provided test account.

## 2026-08-28

### Fixed
- [api] Replaced the API's SQLAlchemy async engine/session with sync psycopg3-backed sessions while preserving the existing FastAPI route responses. This removes the async database connection path that caused staging endpoints such as `POST /auth/login` and `GET /posts` to crash before CORS headers could be attached.

### Changed
- [api] Updated auth, post, and connection services/routers to use sync SQLAlchemy sessions under the existing async route/service surface, and changed `SQLAlchemy[asyncio]` to `SQLAlchemy` in `api/requirements.txt`.

### Verified
- [api] `python -m compileall app` passed.
- [api] `python -m pytest` passed all 25 tests when ignoring leftover pytest cache temp folders with Windows permission errors.
- [api] A direct SQLAlchemy `SELECT 1` probe against the configured Neon database returned `1`.

## 2026-08-28

### Fixed
- [api] Extended FastAPI CORS `allow_origins` in `api/app/main.py` to unconditionally include `https://staging.friink.com`, so staging browser requests are not rejected at the CORS layer even when `FRONTEND_URL` env var is unset or defaults to localhost.
- [docs] Removed stale "self-contained demo mode / no backend requirement" claim from CHANGELOG.md "Current State"; replaced with accurate description of real API wiring and required two-Vercel-project infra topology.

### Notes
- **Manual actions required in Vercel dashboard before staging is fully functional:**
  1. Verify or create the FastAPI API Vercel project (Root Directory: `api/`).
  2. Set API project env vars for Staging: `DATABASE_URL`, `JWT_SECRET_KEY`, `ENVIRONMENT=staging`, `FRONTEND_URL=https://staging.friink.com`, plus JWT timing vars.
  3. Set web project Staging env var: `NEXT_PUBLIC_API_BASE_URL=https://<api-project-url>`.
  4. Redeploy both projects to pick up the new env vars.

## 2026-08-28

### Added
- [web] Added an app-level `ToastStack` for logged-in errors, fixed lower-right on desktop and bottom-centered on mobile with timestamps and stacked ordering.

### Changed
- [web] Routed post, settings, profile-connection, and connection-request errors through toasts instead of inline page/body error text.

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
