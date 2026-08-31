# Changelog

> README.md is the authoritative source for the stack. Read it once per work session,
> and always before tasks involving stack, infrastructure, environment setup, or
> deployment configuration.

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
_Last updated: 2026-08-31_

- [api] The wiped `api/` folder now contains a structured FastAPI backend with SQLAlchemy/Postgres wiring via sync psycopg3 sessions, Alembic migrations, Neon Postgres support, signup/login/JWT/refresh/logout/current-user routes, unified post/quote/reply creation on one posts model, private-profile visibility enforcement, dual-handshake follow requests/connections with cooldowns, in-app notifications, OTP/email stubs, focused validation/lockout tests, and Vercel entrypoint support.
- [api] Posts, quotes, and replies now use a single `posts` table with nullable `quoted_post_id`, `parent_post_id`, and a `kind` enum; replies are fetched per post thread while media schema remains reserved through minimal `post_media` storage placeholders pending an object storage decision.
- [api] Connections use a single `follow_requests` table: pending rows represent requests, accepted rows represent active directional follows, rejected rows retain the 24-hour resend cooldown, and canceled rows retain sender-cancel history for the 3-hour/24-hour resend lockout cycle. Pending requests are auto-accepted when a private account flips public.
- [api] In-app notifications are implemented with a `notifications` table, unread/feed/read endpoints, and synchronous notification creation for follow, request, accept, and private-to-public auto-accept events.
- [web] The deployed frontend makes **real fetch calls** to the FastAPI backend via `web/lib/auth.ts` and `web/lib/data.ts`. There is no demo/mock mode for logged-in flows; signup, login, post creation, connections, and profile editing all require the API. `NEXT_PUBLIC_API_BASE_URL` must still be set in the Vercel **web** project to the deployed API base URL, but the app no longer silently falls back to `http://localhost:8000` in deployed browsers; missing config now fails clearly instead of surfacing as a misleading localhost network error. The subscribe section submits to Zoho Forms for real email collection.
- [api/web] The staging profile-picture flow has been verified end to end: the cropped image uploads to R2, confirmation persists the profile URL, and replacing a picture removes the previous stored object, including legacy flat keys.
- [docs/infra] Added `R2.md`, a production-ready Cloudflare R2 and Vercel configuration guide based on the verified staging setup, with secret-handling, CORS, public URL, deployment, and troubleshooting steps.
- [infra] **Two separate Vercel projects** are required: one for the Next.js `web` app (deployed from `web/`) and one for the FastAPI `api` app (deployed from `api/`, entrypoint `api/api/index.py`). There is no root `vercel.json`; each project is configured independently in the Vercel dashboard. The web project needs `NEXT_PUBLIC_API_BASE_URL` set to the API project's deployed URL. The API project needs `DATABASE_URL`, `JWT_SECRET_KEY`, `FRONTEND_URL` (set to the web URL for CORS), and the other vars in `api/.env.example`. The application uses **sync `psycopg` (psycopg3)** through SQLAlchemy, avoiding the async DB driver/event-loop path that caused staging serverless crashes. As of 2026-08-28 the API Vercel project's existence and deployment status for staging is **unconfirmed** — must be verified in the Vercel dashboard.
- [web] The public landing page is now a native Next.js App Router route at `/`, not an iframe wrapper around `web/public/friink-site/index.html`. Landing styles are scoped in a CSS module, landing media assets live under top-level `web/public/brand` and `web/public/media`, and the old `web/public/friink-site/` folder has been removed.
- [web] Page titles now use the `Friink | Page Name` format through route-level metadata. Dynamic profile titles use the known display name when available and fall back to `@username`; deleted demo route names are guarded so `/compose`, `/dev-settings`, and `/floating` return 404 instead of becoming profiles.
- [web] The shared `FloatingBar` is the persistent contextual surface: it now hosts the reusable `Composer` for real post creation by default, starts floating-post entry in a compact single-line layout, expands into multiline borderless entry only as text needs vertical space, and uses the `/chat` route for message lists and direct chat. The old `/compose` route and post compose page components have been removed.
- [web] Added a dedicated `/notifications` screen with Friink-styled notification rows, wired the header bell to open it, and connected it to the API-backed in-app notification feed. The notifications page is now stripped down to the list only, and feed/chat identities open dummy profile views that can launch chat.
- [web] Post headers and the sidebar/profile identity block now use the reusable `ProfileCard` pattern, and the home tabs are reduced to `Explore` and `Following`.
- [web] Post cards navigate to the canonical post detail page when clicking non-interactive card areas. `Show more...` appears only for post body text that exceeds four visible lines and expands the card in place on both feed and post detail surfaces.
- [web] The Home/Explore feed now uses cursor-based loading for older posts, foreground-only polling for newer posts, top-of-feed manual refresh fallback, and local last-viewed post restore so the feed no longer depends on full-page reloads to update.
- [web] Home feed restore now treats stale last-viewed post anchors as recoverable: if `/posts/context/{post_id}` fails, the client clears the saved anchor and falls back to the normal `/posts` feed load instead of showing `Could not load the Home feed.`.
- [web] Chat now uses the shared `Tabs` component under the page navigation with `All`, `Muted`, and `Requests` filters.
- [web] Connections `All` now combines live followers and following, while the private-account `Requests` tab shows both received pending requests with Accept/Reject actions and sent pending requests with Cancel actions.
- [web] Connections tabs no longer fall back to sample/demo people when there are no live followers or following.
- [web] Profile action buttons are now right-aligned, the sidebar profile highlight only tracks the signed-in user profile, and Settings now uses shared row sections with Profile owning separate Name, Username, and About rows while Account holds email and user ID.
- [web] Profile summary content now uses the shared 8px inline inset so the profile card, About text, follower/following stats, and profile actions maintain the minimum spacing inside the ContentBox.
- [web] Header search controls now place the magnifier before the close icon, and the notification bell stays right-aligned while opening a recent-notifications dropdown with an unread dot, count pill, and All Notifications link.
- [web] Removed the duplicate header action right inset so the bell aligns exactly with the right edge of the mobile navigation three-dots control.
- [web] Restored the fourth default recommendation in the floating search suggestions dropdown.
- [web] Removed the unnecessary search-dropdown scrollbar, added the Open Search footer link, and hid the notification count pill and empty placeholder when there are zero unread/recent items.
- [api/web] Post URLs now use an 8-character random `public_id` plus an on-the-fly, eight-word/64-character content slug; UUID primary and foreign keys remain unchanged, and stale username/slug segments redirect to the canonical URL.
- [api] Neon database migration `20260830_0009` has been applied successfully and existing posts have been backfilled with public IDs.
- [docs] README is now the single source of truth for the verified stack, and it contains standing instructions for keeping CHANGELOG, AGENTLOG, design, and rules documentation current.
- [web] Updated the login/signup screen dark-mode background to `#161616`, kept the auth form fluid with a `31rem` maximum width, and aligned mobile auth controls to the right.
- [docs] Documented the login/signup responsive-width, dark-mode, and mobile action-alignment contracts in `packages/design/design.md`.
- [dev] Restarted the local Next.js server after a generated `.next` stylesheet cache caused the landing page CSS asset to return 404; the landing source was unchanged and styles were verified loading again.
- [web] Kept the mobile Forgot password control left-aligned while retaining right-aligned mobile auth action groups.
- [web] Moved profile edit/message/follow actions to a left-aligned row below the inline follower/following statistics across all viewport types.
- [docs] Updated the profile layout contracts in `packages/design/design.md` and `RULES.md` to record the stacked, left-aligned action row.
- [web] Unknown username routes now show `Does not exist or unavailable.` instead of rendering a synthetic demo profile, including while the lookup is pending.
- [docs] Documented the unavailable-profile behavior in `RULES.md` and the ProfileScreen contract.
- [web] Fixed client-side profile navigation so a previously loaded profile cannot flash while the new username is resolving; stale lookup results are ignored and a loading state is shown.
- [docs] Documented the profile loading and stale-request handling contract.
- [web] Replaced hardcoded profile follower/following zeros with API-backed counts and made each statistic open the matching Connections tab.
- [docs] Documented the profile count and statistic-navigation contract.
- [web] Made the complete profile statistics ununderlined links, with profile links targeting the canonical `/{username}/connections` route; the shared Connections screen now loads the requested user's data.
- [docs] Documented profile-specific Connections routes and three-tab behavior for other users.
- [web] Updated profile statistic hover/focus styling so the number and its following/followers label change color together.
- [web] Connections tab changes now update the current URL's `tab` query parameter, removing it when returning to `All`.
- [web] The reusable `Modal` now supports an optional left-side back arrow; the profile-picture crop modal uses it to return to the previous profile-picture step.
- [web] Settings update controls and modal save ticks now use the shared platform button height of `3rem`.
- [api/web] Added persisted profile setup state and a resumable two-step setup wizard for new accounts, covering optional profile picture and About steps with skip, close, and completion behavior.
- [web] Authenticated bootstrap now clears sessions only for explicit `401` responses, preserving valid sessions during network, API, deployment, or migration failures.
- [web] Setup close now dismisses the local modal even when progress persistence fails, and duplicate identical toasts are suppressed.
- [web] New-account signup now explicitly starts profile setup at step 1, and Settings/setup share one `ProfilePictureCropModal` implementation.
- [api/db] Applied profile setup migration `20260831_0011` to the shared database; Alembic is now at head for localhost, staging, and production.
- [web] Hardened auth refresh handling so only an explicit refresh-token 401 can clear local session state; refresh timeouts, CORS/network failures, 403s, 5xx responses, and malformed responses now remain retryable.
- [web] Added refresh/logout generation guards, refresh-before-login recovery for missing or malformed local auth state, and a 15-second request timeout. Server-side refresh-token revocation remains open because tokens are currently stateless JWTs without server records.
- [docs] Added a design-only proposal for opaque refresh-token rotation/revocation, reuse detection, legacy-session migration, and access-token `kid` key rotation; no implementation or schema changes were made.
- [docs] Added `docs/session-updates.md` as a handoff for the completed session rotation/revocation implementation, deployment requirements, verification evidence, and remaining caveats.
- [verification] Runtime verification of session/logout hardening was attempted against the signed-in staging app. Items requiring fault injection, storage mutation, network traces, or an in-flight request could not be tested in the available browser surface; staging-to-production fallback was diff-verified unchanged.

## 2026-08-31

### Changed

- [web] Standardized signed-in Connections navigation on `/{username}/connections` and its filtered subroutes, matching other-user profile routes. Legacy `/connections` routes remain available as compatibility entry points.
- [api/web] Renamed the Home `Connections` tab to `Following`, changed its slug to `/home/following`, and added server-side follow-only filtering across feed pagination, polling, and context restoration. `/home/connections` redirects to the new slug.
- [web] Made the header Friink logo link to `/home`.
- [web] Removed repeated visible setting titles from expanded Settings fields while retaining accessible input labels.
- [web] Converted stable SideDrawer destinations to real anchors so Chrome can preview their routes on hover and users can open them in a new tab.

## 2026-09-01

### Changed

- [api/web] Made available quoted-post blocks link to the original post's canonical detail page while preserving parent-card and author-profile navigation; unavailable quoted posts remain non-clickable status blocks.

## 2026-08-30

### Changed

- [web] Refined login/signup responsive styling: dark-mode auth background is `#161616`, the form is explicitly fluid up to `31rem`, and mobile auth controls remain right-aligned.
- [docs] Added the login/signup visual contract to `packages/design/design.md`.
- [dev] Recovered localhost landing-page styling by restarting Next.js after a stale generated CSS asset returned 404; no landing-page source changes were needed.

### Verified

- [web] `npm run build` passed at the repository root; Next.js compiled, type-checked, and generated all routes successfully.
- [dev] Live `http://localhost:3000/` verification confirmed landing CTA styles loaded and `scrollWidth` remained below the viewport width.

## 2026-08-30

### Added

- [api] Added the `posts.public_id` migration, unique/indexed storage, public-id lookup endpoint, and centralized slug generation utility.

### Changed

- [web] Updated feed, profile, detail, creation, metadata, and legacy post links to use `/{username}/{slug}-{public_id}` or `/{username}/{public_id}` for empty slugs.
- [docs] Documented public post URL rules and the completed Neon migration in `README.md` and `RULES.md`.
- [docs] Merged the audited stack reference into `README.md`, removed the obsolete duplicate stack file, and corrected the ORM/session reference to synchronous SQLAlchemy with psycopg3.
- [docs] Removed the post URL explanation from the Local Development section after confirming the complete routing rule already lives in `RULES.md` and the implementation history is recorded above.
- [web] Consolidated the search and notification floating lists into the shared `ContextualDropdown` component with a centered “Nothing to show.” empty state.
- [web] Matched the search dropdown footer styling to the notifications footer by scoping search row styles away from the Open Search action.
- [docs] Added a RULES.md architecture rule requiring shared ContextualDropdown usage for floating Search and Notifications lists.
- [web] Tightened the settings username prefix wrapper again so the `@` marker sits outside the entered text cleanly.
- [web] Fixed the `[username]` profile route to read the path slug directly so other-user profile pages open reliably instead of falling back to the signed-in profile.
- [web] Settings username prefixes reset inherited absolute positioning, and other-user profile actions now use a compose/send message icon while own-profile Edit stays unchanged.
- [web] Canonical post detail URLs now use the author-scoped slug shape `/{username}/{postId}`. The legacy `/posts/{postId}` route remains only as a compatibility redirect to the canonical author-scoped URL.
- [web] Post detail URLs now treat `postId` as the only lookup key; if the cosmetic username segment is stale or wrong, the route permanently redirects to the current owner username instead of rendering under the mismatched path.
- [web] Frontend API requests now retry `https://api.friink.com` when a request to the staging API host fails at the network layer, covering the current staging-web case where the deployed bundle targets `https://staging-api.friink.com` but that host is unavailable.
- [web] The three-dot page navigation control now opens a reusable dummy options menu instead of expanding the sidebar.
- [web] The floating post composer enforces a frontend-only 256-character limit with an `x/256` counter, while backend post content still accepts up to 512 characters. Quote posts may be submitted without typed quote text.
- [web] Header notifications show a numeric unread badge from `0` to `99`, then `99+`; Settings saves use icon-only tick buttons with success toasts, and the Private Profile toggle saves immediately through the API.
- [web] Removed the unused `FloatingActions` component, its empty render in the app shell, and its leftover CSS.
- [docs] Cleaned up the `AGENTLOG.md` component registry so it no longer singles out specific page modules as uniquely reusable.
- [docs] Hardened `packages/design/design.md` into an enforceable component contract doc by adding concrete Tokens, Component Contracts, and Unresolved subsections.
- [docs] Resolved `packages/design/design.md` historical discrepancies in Layout, Navigation, and Feed Behavior with dated changelog paper trails; verified all shared component contracts against live implementations; added the permanent design system standing instruction to `CHANGELOG.md` and `AGENTLOG.md`.

## 2026-08-30

### Added
- [web] Added the `/search/[query]` route so submitted header searches open canonical query URLs and render results using shared row layout primitives.
- [web] Added mobile swipe gestures to the shared Tabs component: right-to-left advances to the next tab and left-to-right returns to the previous tab.

### Changed
- [docs] Documented shared ContextualDropdown ownership, common empty-state behavior, and the allowed Search/Notifications row-specific exceptions in RULES.md.
- [web] Unified contextual dropdown footer controls so Search and Notifications share the same compact border, spacing, and link treatment.
- [web] Reused one contextual dropdown component for header search and notifications, keeping notification styling as the shared base while allowing each list's row content and footer to vary.
- [web] Made search and notification dropdowns naturally size from zero to four visible items, added `/search` navigation from the search footer, and limited the notification count pill to unread counts of at least 1 (`99+` above 99).
- [web] Added the missing fourth default search suggestion, `Search hashtags`, so the floating search dropdown uses its documented four-row capacity.
- [web] Corrected `.topbar-actions` right-edge spacing by removing its extra 16px padding; the shared topbar and navigation bar now resolve to the same 8px right inset.
- [web] Updated the shared Header notification flow to pass recent notification items from AppShell, show up to four items in a floating dropdown, and navigate to the full Notifications screen from the footer or an item.
- [web] Restored the bell's green unread dot indicator and moved the actual unread count into the dropdown footer; no numeric badge is shown on the bell itself.
- [web] Reordered the search panel actions so the magnifying-glass submit control appears before the close control.
- [web] Tightened the profile meta row into a two-column grid with stats and actions sharing the same row, matched stats min-height to action button height for visible vertical centering, and removed legacy profile CSS that could confuse the cascade.
- [web] Added the shared inline content inset to `.profile-summary`, moving profile summary content 8px inward from the ContentBox edges for consistent minimum spacing.
- [web] Refined the profile meta-row breakpoint so the mobile stacked action layout only applies on narrow coarse-pointer/touch views; narrow desktop browser views keep stats and profile actions vertically aligned on one row.
- [docs] Added the profile header/content-box spacing rule to `RULES.md`, covering desktop stats/action alignment, mobile stacking, and shared `ProfileScreen` ownership.
- [web] Made the profile header summary explicit inside `ProfileScreen`, grouping profile card, about text, stats, and actions into one component-level section inside `ContentBox` with standard spacing.
- [docs] Audited this session's UI fixes as component-level changes and added explicit README, rules, and design guidance prohibiting quick page-level or inline fixes for shared UI behavior.
- [web] Reworked the profile header meta area so stats and edit/message/follow actions share one row inside the `ContentBox` on desktop, while mobile stacks actions below stats and keeps them right-aligned.
- [web] Made active header search full-width on mobile with 8px side insets, added a close icon button beside the right-side submit icon, and capped the suggestions dropdown to four visible rows.
- [web] Kept the expanded header search icon on the right as a submit button, removed suggestion-row icons, and wired Enter/search-button submission to `/search/{searched-string}`.
- [web] Visiting the Notifications page now marks notifications read through the existing API helper and immediately clears the header unread badge state.
- [web] Kept profile names color-stable when hovering identity links inside shared list rows, including Connections rows.
- [web] Locked the fixed mobile tab strip to the shared navigation bar height token so tabs begin on the next pixel after the navigation bar during slow scroll, preventing feed content from showing between them.
- [web] Changed the header search action from route navigation to an inline search input with a same-width suggestions dropdown 8px below it, matched bell/search icon boxes, and adjusted notification badge spacing to avoid scrollbar clipping.
- [web] Fixed mobile drawer close behavior through the shared header hamburger event handling, tightened header notification badge spacing so the pill is not clipped, and made feed post star/more icon sizing override the shared icon font exactly.
- [web] Removed the visual gap between the mobile navigation bar and top tabs, reduced top tab height to 90% of the previous height, and grouped feed post star/more actions into one fixed-height spaced cluster matching the navigation overflow icon metrics.
- [web] Matched feed post star/overflow action metrics to the navigation overflow icon, increased the navigation bar height to match the tab strip, and restored bold compact navigation title text at 95% of its previous size.
- [web] Replaced the header notification dot with a numeric unread-count badge that clamps above 99.
- [web] Replaced Settings text update buttons with icon-only tick buttons, right-aligned wrapped save controls, success toasts for saved fields, and immediate API saves for the Private Profile toggle.
- [web] Tuned the mobile navigation title to 90% of its previous size and regular weight, restored 16px mobile bottom spacing for the floating bar, and kept 8px left/right mobile insets.
- [web] Changed post cards so non-interactive card clicks navigate to post detail, while `Show more...` only appears after four-line body overflow and expands the current card in place.
- [web] Allowed quote submission without typed quote text while keeping normal posts and replies text-required, and documented the frontend-only 256-character composer limit.
- [docs] Updated `packages/design/design.md`, `RULES.md`, `CHANGELOG.md`, and `AGENTLOG.md` for the navigation, floating bar, post expansion, quote submission, and composer-limit contracts.

### Verified
- [web] `npx tsc --noEmit --incremental false` passed in `web`; live localhost verification confirmed four search options without a scrollbar, Open Search routing to `/search`, and no notification count pill or empty placeholder at zero unread/recent items.
- [web] Live localhost measurement confirmed the header bell and navigation three-dots right edges match at `0px` delta on the profile/post-detail viewport.
- [web] `npx tsc --noEmit` passed in `web`; live localhost verification confirmed the search action order and notification dropdown at `http://localhost:3000/muflah`.
- [web] `npx tsc --noEmit` passed in `web` after tightening profile meta-row grid alignment; `npm run build` is currently blocked by generated `.next` cache/Windows cleanup errors after source compilation.
- [web] `npx tsc --noEmit` and `npm run build` passed in `web` after refining the profile meta-row mobile breakpoint.
- [web] `npx tsc --noEmit` and `npm run build` passed in `web` after hardening the profile summary/content-box alignment source changes.
- [docs] Component-level audit passed: current-session UI behavior lives in shared components/state owners or documented shared CSS contracts; only component-owned dynamic measurement styles remain (`Tabs` indicator and Home pull-to-refresh height).
- [web] `npx tsc --noEmit` and `npm run build` passed in `web` after the component-level audit documentation updates.
- [web] `npx tsc --noEmit` passed in `web` after the profile meta-row alignment change.
- [web] Verified the profile padding adjustment live at `http://localhost:3000/muflah`; no build was required because this was a CSS-only update to `web/app/globals.css`.
- [web] `npm run build` passed in `web` after clearing the generated `.next` cache that had a Windows/OneDrive lock from the prior build attempt.
- [web] `npx tsc --noEmit` passed in `web` after the mobile header search layout fix.
- [web] `npm run build` passed in `web` after the mobile header search layout fix.
- [web] `npx tsc --noEmit` passed in `web` after the header search route/result layout change.
- [web] `npm run build` passed in `web` after the header search route/result layout change.
- [web] `npx tsc --noEmit` passed in `web` after wiring Notifications page visits to read-all badge clearing.
- [web] `npm run build` passed in `web` after wiring Notifications page visits to read-all badge clearing.
- [web] `npx tsc --noEmit` passed in `web` after the mobile tab swipe gesture change.
- [web] `npm run build` passed in `web` after the mobile tab swipe gesture change.
- [web] `npx tsc --noEmit` passed in `web` after the list-row profile-name hover fix.
- [web] `npm run build` passed in `web` after the list-row profile-name hover fix.
- [web] `npx tsc --noEmit` passed in `web` after the mobile navigation/tabs offset fix.
- [web] `npm run build` passed in `web` after the mobile navigation/tabs offset fix.
- [web] `npx tsc --noEmit` passed in `web` after the header search/bell adjustment.
- [web] `npm run build` passed in `web` after clearing the generated `.next` cache that had a Windows readlink cleanup error.

## 2026-08-29

### Added
- [api] Added JWT/session resilience safeguards: required `JWT_SECRET_KEY`, API startup secret fingerprint logging, classified auth failure codes/logs, minimal JWT schema validation, Alembic `SESSION INVALIDATION:` migration convention, and focused token resilience tests.
- [web] Added access-token resilience in the frontend auth client: proactive refresh at 80% of token lifetime, one silent refresh-and-retry on `TOKEN_EXPIRED`, and deduped concurrent refresh attempts.
- [docs] Created `rules.md` as the root product/business rules contract, covering currently active code-backed behavior for auth, privacy/connections, posts/replies/quotes, notifications, web navigation/client behavior, and infrastructure.
- [api] Added the `notifications` table/model/schema/service/router with paginated `GET /notifications`, `GET /notifications/unread-count`, single-read, and read-all endpoints.
- [api] Added synchronous in-app notification creation for public follows, new followers, sent/received private follow requests, request acceptance, and private-to-public auto-accept.
- [api] Added sender-cancel resend cooldown logic: three cancels within a rolling 3-hour cycle lock resending until 24 hours from that cycle's first cancellation.
- [web] Wired the notifications screen to the live API feed and connected the Connections Requests view to both incoming and outgoing pending requests.
- [api] Added feed pagination and restore endpoints: `GET /posts` now returns cursor-based pages with `next_cursor` and `has_more`, `GET /posts/updates` returns posts newer than the current top item, and `GET /posts/context/{post_id}` returns anchor-centered feed context for last-read restoration.

### Changed
- [web] Extended `ProfileCard` with an optional profile link and updated Connections and Notifications rows to render linked `ProfileCard` identity blocks instead of separate avatar/title/handle fragments.
- [docs] Updated `RULES.md` and the design contract so profile identity shown in app content should use linked `ProfileCard` where profile navigation is intended.
- [docs] Normalized `rules.md` `Since` timestamps and all `AGENTLOG.md` date lines to `YYYY-MM-DD (HH:MM UTC-0)`.
- [api] Enforced private-post visibility server-side for post fetches, feed/update/context serialization, replies, and quoted-post cards. Private authored posts now serialize quoted cards as `Content not available` for non-authorized viewers.
- [api] Blocked quoting private-profile posts at post creation, including for the private-profile owner, matching the existing product decision.
- [web] Authenticated post-read requests now include the saved bearer token when available so private-profile visibility can be evaluated by the API.
- [web] Removed the demo-data fallback from Connections tabs so `All`, `Followers`, and `Following` only display real API data.
- [web] Fixed Connections filtering so `All` shows both followers and following from live API data, with duplicate/mutual people de-duped into one row.
- [web] Hid the Connections `Requests` tab for public profiles based on the existing DB-backed `is_private` account setting.
- [web] Added shared top tabs to the Chat page and wired the message list to the selected `All`, `Muted`, or `Requests` filter.
- [api] Applied pending staging database migrations `20260829_0006` and `20260829_0007`, adding `users.is_private` and `follow_requests.removed_at`; this fixed the live staging `GET /posts` 500 that surfaced in the web app as `Could not load the Home feed.`.
- [web] Made Home feed last-viewed restoration resilient to stale staging/localStorage anchors by clearing a failed saved anchor and retrying the normal `GET /posts` initial load before surfacing the fatal feed error.
- [web] Added a network-only API-origin fallback so browser requests that are compiled to `https://staging-api.friink.com` retry `https://api.friink.com` before surfacing `Failed to fetch.`, while successful requests and normal HTTP auth errors continue unchanged.
- [web] Centralized frontend API-origin resolution so local development still defaults to `http://localhost:8000`, while deployed/browser contexts now require `NEXT_PUBLIC_API_BASE_URL` instead of silently attempting localhost and surfacing a generic `Failed to fetch.` on login.
- [web] Added mismatch handling on the canonical `/{username}/{postId}` route so it fetches the post by `postId` only, compares the URL username with the post owner's current username, and issues a permanent redirect to the correct URL when they differ while preserving query params.
- [web] Rebuilt the Home/Explore feed as a self-updating controller with IntersectionObserver-based older-post loading, 10-second foreground polling for newer posts, deferred prepends during active scrolling, local last-viewed post persistence/restore, and a top refresh fallback UI for missed/pending updates.
- [web] Extended the frontend API client and shared page surface to support the new feed contract and top-of-feed interaction states without changing profile, connection, or post-creation logic.
- [web] Added a shared `getPostPath()` helper and switched canonical post detail navigation from `/posts/{postId}` to `/{username}/{postId}` across feed cards, starred-post rows, and post-detail quote creation redirects.
- [web] Added the new App Router post-detail route at `web/app/[username]/[postId]` and kept the old `/posts/{postId}` page as a compatibility redirect that resolves the post author and forwards to the canonical username-scoped path.

### Verified
- [docs] Scanned `rules.md` `Since` fields and `AGENTLOG.md` date lines and confirmed they all use UTC-0 timestamps in 24-hour format.
- [docs] Confirmed `rules.md` exists at the project root and follows the requested per-rule template.
- [api] `api/.venv/Scripts/python.exe -m pytest` passed with 44 tests, including the requested reject/cancel cooldown coverage and private-post visibility checks.
- [api] `api/.venv/Scripts/python.exe -m compileall app tests` passed.
- [api] `alembic upgrade head` applied `20260829_0008`; `alembic current` now reports `20260829_0008 (head)` for the configured database.
- [api] FastAPI TestClient `GET /posts?limit=1` returned HTTP 200 against the configured database after the migration.
- [web] `npx tsc --noEmit` passed in `web`.
- [web] `npm run build` passed in `web`.
- [web] `npm run build` passed in `web` after removing the Connections tabs demo fallback; the first attempt hit a stale generated `.next` readlink error, then passed after clearing `web/.next`, and the follow-up broad removal also passed.
- [web] `npm run build` passed in `web` after the Connections `All`/Requests visibility fix.
- [web] `npm run build` passed in `web` after adding Chat tabs.
- [api] Before applying migrations, local ORM reproduction against `api/.env.staging` failed with `column users.is_private does not exist`; after `alembic upgrade head`, the same feed query returned 9 items.
- [api] `alembic current` against staging now reports `20260829_0007 (head)`.
- [api] Live `GET https://staging-api.friink.com/posts` now returns `200` with the paginated feed payload and CORS headers for `https://staging.friink.com`.
- [web] `npm run build` passed in `web` after the stale Home feed restore fallback.
- [web] Reproduced in the in-app browser that `https://staging.friink.com/login` showed `Failed to fetch.` after submit while `https://friink.com/login` reached the backend and returned `Invalid credentials.` for the same dummy payload; fetched the deployed login bundles and confirmed staging was compiled against `https://staging-api.friink.com` while production was compiled against `https://api.friink.com`.
- [web] `npm run build` passed in `web` after adding the staging-to-production API network fallback.
- [web] `npx tsc --noEmit` passed in `web` after the fallback change.
- [web] `npm run build` passed in `web` after replacing the silent deployed localhost fallback with the shared API-origin resolver.
- [web] `npx tsc --noEmit` passed in `web` after the API-origin change.
- [web] New staging follow-up evidence on 2026-08-29: login succeeded, but the user then reported `Could not load the Home feed.`; browser repro started but was interrupted before the failing feed request could be isolated, so this remains a separate pending staging issue.
- [web] `npm run build` passed in `web` after adding the username-mismatch permanent redirect on the post detail route.
- [web] `npx tsc --noEmit` passed in `web` after the mismatch-redirect update.
- [api] `api/.venv/Scripts/python.exe -m pytest tests/test_posts.py` passed with cursor-helper coverage after the feed endpoint changes.
- [api] `python -m compileall api/app api/tests` passed after the feed pagination additions.
- [web] `npm run build` passed in `web` after the Home feed controller rollout.
- [web] `npx tsc --noEmit` passed in `web`.
- [web] Manual browser verification is still pending for post-route scenarios that require live username changes and reassignment; no commit was made in this pass.
- [web] `npm run build` passed in `web`, and the generated route manifest now includes `ƒ /[username]/[postId]` plus the legacy redirecting `ƒ /posts/[postId]`.
- [web] `npx tsc --noEmit` passed in `web` after rebuilding `.next` types.

## 2026-08-29

### Changed
- [api] Added a separate `removed_at` timestamp on `follow_requests` so owner-side follower removal now triggers its own 24-hour re-follow cooldown without affecting sender-canceled requests.
- [api] Removed followers can no longer immediately re-follow a public or private account; re-follow attempts are blocked until 24 hours after the owner removed them.

### Verified
- [api] `api/.venv/Scripts/python.exe -m pytest tests/test_connections.py` passed after adding the follower-removal cooldown rule.
- [api] `python -m compileall api/app api/tests` passed after the follower-removal cooldown update.

## 2026-08-29

### Added
- [api] Added account privacy support with a persisted `users.is_private` flag, public-account instant follow behavior, a 24-hour cooldown after denied private follow requests, transactional auto-accept of pending requests when a user switches from private to public, and a dedicated owner-side remove-follower action.
- [web] Wired the Settings privacy toggle to the real account setting and added owner-side follower removal from the Connections follower list when API data is available.

### Changed
- [api] Kept `follow_requests` as the single directional relationship table and reused retained `rejected` rows plus `responded_at` for denial-cooldown tracking, avoiding a second audit table.
- [api] Defaulted new accounts to public (`is_private = false`) unless the user explicitly turns privacy on later.
- [web] Extended shared auth/profile types so privacy state flows through login, `/auth/me`, public profile lookup, and follower/following UI mapping.

### Verified
- [api] `api/.venv/Scripts/python.exe -m pytest tests/test_connections.py tests/test_auth_updates.py` passed with 18 tests covering the new connection/privacy behavior.
- [api] `python -m compileall api/app api/tests` passed after the connection/privacy changes.
- [web] `npx tsc --noEmit` passed in `web`.
- [web] `npm run build` passed in `web`.

## 2026-08-29

### Changed
- [web] Added a shared client-side `formatRelativeTime` utility in `web/lib/time.ts` and moved post, reply, thread, starred-row, notification, and chat timestamp rendering onto it so all user-facing timestamps now follow the same local-time rules.
- [web] Refactored shared frontend post and mock-conversation data to carry raw ISO timestamps (`createdAt`) instead of preformatted display strings, preventing different screens from baking in conflicting date styles.

### Verified
- [web] `npx tsc --noEmit` passed in `web` after the timestamp refactor.
- [web] `npm run build` passed in `web` after replacing the timestamp formatting logic.
- [web] Ran direct formatter boundary checks for seconds, minutes, same-day time, next-day local-date rollover, and invalid-input fallback; outputs matched the new spec.

## 2026-08-29

### Added
- [api] Added temporary, env-gated auth debug logging around JWT issuance and verification failure paths so staging can capture PyJWT exception type, unverified `iat`/`exp`, current server time, request path/method, auth flow context, and `VERCEL_GIT_COMMIT_SHA` without logging raw tokens.
- [web] Added an `X-Friink-Auth-Context` header on authenticated frontend API calls so the backend debug logs can distinguish normal authenticated requests from refresh-exchange traffic during staging investigation.

### Changed
- [api] Gated the new auth debug logging behind `AUTH_DEBUG_LOGGING_ENABLED` so the extra token-claim logging can be enabled temporarily on staging and removed or left off before merge.

### Verified
- [api] `python -m compileall api/app` passed after the temporary auth-debug instrumentation was added.
- [web] `npx tsc --noEmit` passed in `web` after adding the auth-context request metadata.

### Pending
- [api][web] Real staging deploy-boundary reproduction and evidence collection are still required before any root-cause fix is applied or any commit is made.

## 2026-08-29

### Fixed
- [api] Posts now return real `reply_count` and `quote_count` aggregates from the database instead of leaving the frontend to hardcode zeros.
- [web] Home, Profile, and Post Detail now all read the same API-backed reply/quote counts through the shared `FeedPost` mapping path, so post action counts stay consistent across surfaces.

### Verified
- [web] `npm run build` passed in `web` after wiring real post counts through the API/frontend contract.

### Changed
- [web] Kept the shared floating composer active on profile pages, and when viewing another user's profile it now seeds the post draft with their `@username` as an editable mention suggestion.
- [docs] Updated `packages/design/design.md` to record the profile-page floating composer and removable mention-prefill rule.

### Verified
- [web] `npm run build` passed in `web` after the profile floating-composer update.

### Fixed
- [web] Corrected the mobile navigation back-button availability so it reflects real browser history instead of disabling itself just because the current screen is `Home`; returning to Home after visiting Connections, a profile, or a post now still leaves back navigation available.

### Verified
- [web] `npm run build` passed in `web` after the back-button history fix.

### Changed
- [web] Brought the persistent floating bar onto the same centered content rail as `ContentBox` and inset it by `16px` on both sides, so it no longer renders wider than the app content on large screens.
- [docs] Updated `packages/design/design.md` and `AGENTLOG.md` with stricter reuse guidance: prefer shared layout primitives over new wrapper components, and avoid inline or targeted spacing fixes for global layout issues.

### Verified
- [web] `npm run build` passed in `web` after the floating-bar rail alignment and design/log guidance update.

### Fixed
- [web] Moved Home, Chat list, Notifications, Connections, Starred, Settings, and Profile onto a shared `PageSurface` wrapper so screen components no longer carry their own competing outer content-box spacing rules.
- [web] Removed the remaining page-specific outer padding from the logged-in screens and normalized shared inset usage in headers and tabs, so the `ContentBox` contract now drives width and horizontal rhythm consistently across those surfaces.
- [docs] Updated `packages/design/design.md` to make `PageSurface` the required first-level screen wrapper inside `ContentBox`, with `ContentBox` as the sole owner of app-page max width, centering, and side gutters.

### Verified
- [web] `npm run build` passed in `web` after the page-surface unification and spacing cleanup.

### Changed
- [web] Confirmed Connections was already on the shared `ListRow` primitive and converted the Starred screen to the same row-summary pattern, with rows opening post detail while keeping lightweight reply/quote actions available.
- [web] Capped the shared logged-in `ContentBox` at `1024px` on desktop and centered it within the main panel so wide screens no longer stretch primary content awkwardly.
- [web] Moved the Settings > Profile `Name` update button onto the same row as the input, matching the `Username` row pattern.
- [docs] Updated `packages/design/design.md` so the `1024px` desktop content cap, Starred row-summary direction, and inline single-line settings field rule are explicit.

### Verified
- [web] `npm run build` passed in `web` after the Starred row conversion, desktop width cap, and inline Name-row update.

### Fixed
- [web] Quote posts now place the feed `Show more...` link below the quoted-post block instead of above it, so the quote card stays visually attached to the post body it belongs with.
- [web] Softened the feed `Show more...` treatment from emphasized link styling to a lighter, regular-weight secondary affordance.
- [docs] Updated `packages/design/design.md` to lock in the quoted-post `Show more...` placement rule and the lighter default link styling.

### Verified
- [web] `npm run build` passed in `web` after the quote-card `Show more...` placement and styling update.

### Changed
- [docs] Strengthened `packages/design/design.md` so page-gutter ownership is now an explicit contract: `ContentBox` owns the outer responsive inset, row/card primitives may reuse the inset token internally, and screen wrappers must not add duplicate page-width centering or side gutters unless a documented exception exists.

### Verified
- [web] `npm run build` passed in `web` after tightening the design-system ownership rule and syncing the repo logs.

### Fixed
- [web] Centralized the primary app-page horizontal gutter inside the shared `ContentBox` and removed competing screen-level side padding/width assumptions from Settings and Notifications, so Home, Settings, and Notifications now align to the same responsive content rails.
- [docs] Updated `packages/design/design.md` to make `ContentBox` the owner of the standard app-page horizontal gutter instead of leaving inset control to individual screens.

### Verified
- [web] `npm run build` passed in `web` after the shared content-box gutter fix.

### Changed
- [web] Moved `Username` from Settings > Account into Settings > Profile, where `Name`, `Username`, and `About` now render as separate shared-row sections with independent update buttons and status messages.
- [web] Changed the shared composer preview behavior so replies show the referenced post in the composer just like quotes, improving composition clarity on both the home timeline and dedicated post page.
- [web] Added visible reply and quote counts beside the corresponding feed action icons, keeping the action bar aligned while making thread/citation activity scannable.
- [docs] Updated `packages/design/design.md` so the settings tab ownership, always-visible feed `Show more...` rule, and feed action-count contract are explicit.

### Fixed
- [web] Feed cards now always render the `Show more...` link to the post detail route instead of showing it only when body overflow is detected.

### Verified
- [web] `npm run build` passed in `web` after the settings row split, composer reply-preview change, and feed action/show-more updates.

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

## 2026-08-30

### Changed

- [docs] Consolidated the overlapping README agent guidance into one section, clarified targeted verification versus handoff commits, and added the README stack-read pointer to this file.
- [docs] Final README cleanup corrected `RULES.md` filename casing, removed a duplicated documentation instruction, and retained the existing README-read pointer.
- [docs] Fixed missing Markdown list markers in the README agent-instructions section so all “after finishing” guidance renders consistently.
- [docs] Indented multiline continuations in those list items so the README renders as valid, consistently formatted Markdown.
- [api/web] Prepared profile-picture media support: added nullable user URL/timestamp fields, migration `20260830_0010`, a real boto3/R2 storage service, authenticated upload-url and confirmation endpoints, R2 env placeholders, and settings UI with preview/loading/error states. Shared profile and sidebar avatars use the stored URL when present and retain initials fallback otherwise. RULES.md was not changed because existing avatar guidance already covers the optional/default behavior.
- [api] Alembic upgrade to `20260830_0010` applied cleanly; remaining setup is limited to adding the five R2 environment values when staging credentials arrive.
- [docs] Completed the R2 documentation pass by adding the `ProfileCard.imageUrl` fallback contract, the Settings profile-picture UI contract, and the optional-profile-picture product rule in `packages/design/design.md` and `RULES.md`.
- [web/api] Added client-side profile-picture compression before the existing upload flow using the browser Canvas API: JPG/JPEG, PNG, and WebP are normalized to JPEG at the avatar preset (600px max edge, ~250KB target), HEIC/HEIF and unsupported types are rejected explicitly, transparent pixels flatten to white, and the backend confirmation safety net rejects objects over 3MB. The picker now displays processing separately from upload progress. A future `postMedia` preset can be added without changing the utility API.
- [web] Added `react-easy-crop` square cropping before profile-picture compression; updated the avatar preset to 512px square/~250KB without upscaling smaller crops, and implemented an unwired `postMedia` preset at 1024px max edge/~500KB with preserved aspect ratio.
- [web] Added the provided root `profile.jpg` unchanged at `web/public/media/profile.jpg` and made the shared `ProfileCard` use it as the default whenever no user-uploaded profile picture URL exists.
- [web] Enforced a 128px minimum source short edge before profile-picture cropping and capped `react-easy-crop` zoom at `shorterEdge / 128`, preventing unusably small crop selections.
- [verification] Completed the profile-picture pipeline audit: schema/migration, R2 service, protected endpoints, frontend sequence, compression presets, avatar fallback coverage, and cross-task consistency were checked. Fixed the upload button/handler so an uncropped file cannot bypass the modal; TypeScript and diff checks pass.
- [verification] Normalized the remaining legacy Questions/Directory avatar renderers to the shared `ProfileCard` fallback path so no code path bypasses the default profile image.
- [local] Added the supplied staging R2 account, access key, secret key, and bucket name to ignored `api/.env`; `R2_PUBLIC_URL` remains blank pending the bucket public URL/custom domain and no secret values were added to tracked files.
- [web] Moved the profile-picture cropper into an accessible modal/popup with backdrop dismissal, cancel/close controls, title/help text, and explicit Confirm crop action.
- [web] Added contextual profile-picture upload errors that distinguish API startup, R2 transfer/CORS, and API confirmation failures, including relevant HTTP status and staging configuration guidance.
- [docs] Clarified in `api/.env.example` that staging R2 values belong in Vercel Preview and must not be committed.
- [web] Renamed the profile-picture file picker action to `Upload`, moved the tick confirmation control into the crop modal, made the final upload action explicit, and removed crop-dialog horizontal overflow.
- [web] Structured profile-picture failure toasts with a plain-language title, stable code, user-facing summary, and smaller diagnostic detail beneath it.
- [web] Replaced developer-oriented profile-picture failure details with plain-language summaries and next steps while retaining a support code.
- [web] Restored the last server-confirmed profile picture after a failed upload so an optimistic local preview cannot imply that the account was updated.
- [api] Hardened profile-picture confirmation with a public-object verification fallback and safe handling for unexpected confirmation failures.
- [api] Made R2 confirmation resilient when the public development endpoint does not support `HEAD`: confirmation now falls back to a bounded `GET` while preserving the 3 MB object-size limit.
- [api] Made previous profile-picture cleanup fully best-effort so legacy object keys cannot cause a successful replacement to return an error after the database update.
- [api] Changed profile-picture replacement cleanup to mandatory deletion before the new database URL is committed, with support for deleting legacy flat object keys.
- [api] Fixed the profile-picture confirmation `500`: the route accidentally resolved `refresh(...)` to the `/auth/refresh` handler after committing the new picture. Confirmation now returns the committed result directly.
- [api/security] Kept FastAPI API documentation available in staging while disabling Swagger, ReDoc, and OpenAPI routes in production.
- [verification] Confirmed the staging profile-picture upload succeeds end to end after aligning the web client, FastAPI confirmation route, R2 verification, database persistence, and mandatory previous-object deletion.
- [api/web] Included each post author's profile-picture URL in post responses and preserved it through feed, live-update, post-detail, and reply mapping so shared feed profile cards render uploaded avatars for other users.
- [web] Made tab state URL-addressable with canonical paths for Home, Connections, Chat, Settings, and Profile tabs; legacy tab roots redirect to their default tab.
- [web] Kept the server-confirmed profile picture visible during selection, cropping, processing, and upload; the crop-modal tick now performs the upload and closes only after success, with the duplicate upload button and empty-selection copy removed.
- [web] Changed empty About rendering so visitors see no placeholder, while the signed-in owner sees `Add about in settings.`; new accounts already retain an empty About by default.
- [web] Limited the Settings About textarea to 128 frontend characters and moved the live `x/128` counter inside the field's lower-right corner.
- [web] Enlarged the profile-page avatar to `5rem`, twice the standard ProfileCard avatar size, without changing feed or list avatars.
- [web] Standardized Settings around a shared `SettingsRow` with matching leading-icon/right-action dimensions, moved field save ticks to the common rail, added Theme and Privacy confirmation ticks, and aligned profile-picture Upload with that rail.
- [web] Extracted the profile-picture crop dialog into a reusable global `Modal` with a top-right close cross and bottom action ribbon, placing Cancel beside the upload tick.
- [web] Corrected Privacy settings layout by moving all two-state controls into the right action rail, adding left-On/right-Off segmented toggles, and top-aligning ticks with the leading icons.
- [web] Replaced the profile-picture picker’s text Upload button with an accessible upload icon button.
