# Friink Rules

This file documents product/business logic rules for features currently implemented
and active in the codebase. It does NOT cover planned features, deprecated behavior
(beyond marking it Deprecated below), or visual/design rules (see design.md).

When adding a new rule after implementing a feature: add it under the relevant feature
area heading using the template below. If no matching heading exists, create one. Do
not remove entries - mark superseded/removed behavior as Deprecated rather than deleting
the entry, so history isn't lost.

## Web Architecture

### Rule: Post Media Uploads Are Submit-Time And Image-Only
- **What:** A post may include up to 8 JPEG images. The composer keeps selected files local until the user submits, allows the user to reorder the selected attachments before submission, and submits files in the visible order. Clicking a thumbnail opens the 3:5 crop tool directly; Reset restores the crop view, Apply saves the crop, and previous/next arrows switch among attached images. The API then validates ownership, type, and size before associating them with the authenticated user's new post.
- **Edge cases:** The shared post-media preparation targets a 1024px maximum longest edge and approximately 500KB per image. While the post/media request is running, the Post button is disabled and shows the posting spinner; failed submissions preserve the draft and attachments for retry, while successful submissions clear them. Failed submissions must clean up uploaded objects and must not leave a half-created post. Post deletion removes associated post-media objects before marking the post deleted. Successfully associated media is returned as URL items and rendered through the shared horizontal slider: all images remain available, each uses a common nominal height (`24rem` desktop, `15rem` compact screens), and a default 3:5 frame. The shared modal backdrop is above application overlays so crop controls remain interactive.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `web/components/composer.tsx`, `web/components/app-shell.tsx`, `web/components/post-media-gallery.tsx`, `web/lib/auth.ts`, `web/lib/data.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/app/globals.css`, `api/app/routers/posts.py`, `api/app/services/posts.py`, `api/app/services/storage.py`, `api/app/models/post.py`
- **Since:** 2026-09-01 (UTC)

### Rule: Web UI Fixes Must Be Component-Level
- **What:** Reusable web UI behavior, layout, spacing, and interaction fixes must be implemented in shared components, shared CSS contracts, or shell-level state owners rather than inline styles, route-only patches, or one-off page wrappers.
- **Edge cases:** A route may be added to expose a feature URL, such as `/search/[query]`, but the route should delegate visible layout and behavior to shared shell/screen/row primitives. Page-specific overrides are allowed only when the behavior is genuinely unique to that page and documented in `packages/design/design.md`.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/*`, `web/app/globals.css`, `packages/design/design.md`, `README.md`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Primary Desktop Content Uses A 512px Shared Cap
- **What:** The shared `ContentBox` caps primary logged-in app content at `512px` on desktop and centers it within the available main panel. On smaller screens it remains fluid within the responsive content gutter.
- **Edge cases:** Screen-level wrappers must not introduce competing max-widths or duplicate outer gutters. The floating bar rail must use the same available main-panel area as `ContentBox`: full viewport width on mobile, and from the desktop sidebar edge to the viewport edge on desktop. The bar itself retains the shared `512px` cap and flex/margin-auto centering.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/content-box.tsx`, `web/app/globals.css`, `web/theme.config.ts`, `packages/design/design.md`
- **Since:** 2026-09-01 (UTC)

### Rule: In-App Accent Color Is Device-Local
- **What:** Signed-in users may set a six-digit hex accent color from Settings > General. It overrides the app shell's brand token for the current device only; public/landing surfaces are not affected.
- **Edge cases:** Invalid hex values cannot be saved. The default `#33aa55` is used when no valid local preference exists or local storage is unavailable.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`, `web/components/app-shell.tsx`, `web/app/globals.css`
- **Since:** 2026-09-01 (UTC)

### Rule: Route-Based Navigation Uses Real Links
- **What:** Navigation controls that have a stable destination must render as anchors with an `href`, including the signed-in drawer routes. Client-side click handling may intercept normal clicks, but the destination must remain available to browser status previews, middle-click, and open-in-new-tab behavior.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/side-drawer.tsx`, `web/components/app-shell.tsx`, `web/components/header.tsx`
- **Since:** 2026-08-31 (Asia/Karachi)

### Rule: Profile Header Summary Uses ContentBox Spacing
- **What:** Web profile pages render profile identity, about text, follower/following stats, and edit/message/follow actions through the shared `ProfileScreen` inside `ContentBox`. These elements are grouped in the component-level profile summary section, not patched with route-specific spacing.
- **Edge cases:** Profile stats are API-backed, remain inline and left-aligned, and each complete number-and-label statistic is an ununderlined link. Self-profile links use `/connections?tab=...`; another profile uses `/{username}/connections?tab=...`. Edit/message/follow actions move to a dedicated left-aligned row below them on all viewports. The dynamic `/{username}` route must continue delegating to shared `AppShell` and `ProfileScreen`.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/profile-client.tsx`, `web/app/globals.css`, `packages/design/design.md`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Unknown Profile Routes Show Unavailable State
- **What:** A username route that does not resolve to a public user must render `Does not exist or unavailable.` and must not create or display a synthetic/demo profile.
- **Edge cases:** The signed-in user's own username continues to render the self-profile, and a real public user continues to render the browsable profile. While a non-own profile lookup is pending, the route shows `Loading profile...` and must not fall back to the signed-in user's profile. Stale results from an earlier username lookup must be ignored.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/[username]/profile-client.tsx`, `web/app/globals.css`, `packages/design/design.md`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Contextual Header Lists Use Shared Dropdown
- **What:** Floating Search and Notifications lists must use the shared `ContextualDropdown` shell for their container, list spacing, footer treatment, and empty state. The shared empty state displays `Nothing to show.` with centered whitespace; list-specific row content and footer actions may remain specialized.
- **Edge cases:** Search may show fewer than four query-specific suggestions, Notifications may show fewer than four recent items, and zero unread notifications must hide the count pill while retaining the All Notifications action.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/contextual-dropdown.tsx`, `web/components/header.tsx`, `web/app/globals.css`, `packages/design/design.md`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Public Post URLs Use Public IDs
- **What:** Post detail URLs use the author username, an on-the-fly slug from the first eight content words capped at 64 characters, and an 8-character random mixed-case alphanumeric `public_id`. Empty slugs omit the slug text.
- **Edge cases:** The username and slug are cosmetic; the trailing `public_id` is authoritative for lookup. The UUID primary key and all UUID foreign-key relationships remain unchanged. Existing rows receive IDs through the Alembic backfill migration.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/post.py`, `api/app/services/post_slug.py`, `api/app/routers/posts.py`, `api/alembic/versions/20260830_0009_add_public_id_to_posts.py`, `web/lib/post-path.ts`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Quoted Posts Link To Their Original
- **What:** A quoted-post block in a feed or post card links to the original post's canonical detail URL when that original is available. The parent quote post remains navigable through its surrounding non-interactive card area.
- **Edge cases:** Profile-card clicks continue to open the author's profile. Deleted, private, or otherwise unavailable originals render a non-clickable `Original post unavailable`/`Content not available` block because there is not enough visible identity data to construct a safe canonical URL.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `api/app/schemas/posts.py`, `api/app/services/posts.py`, `web/lib/auth.ts`, `web/lib/data.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/components/app-shell.tsx`
- **Since:** 2026-09-01 (Asia/Karachi)

## Authentication & Accounts

### Rule: Authoritative Web Session And Refresh Model
- **What:** This is the single authoritative model for all future web authentication/session work. Authenticated requests send the current access token and refresh only after a `401 TOKEN_EXPIRED`; they retry the original request exactly once with the refreshed token. No request proactively refreshes before receiving a 401. Only an explicit 401 returned by the refresh exchange clears local session state and redirects to `/login`.
- **Edge cases:** Network, timeout, CORS, 403, 5xx, malformed-response, and other original-request failures never refresh or clear the session and remain retryable errors. Refresh network/timeout/CORS/5xx/malformed failures also preserve the session. Refreshes are coordinated across tabs with the browser Web Locks API when available and a shared browser-storage lease/result fallback, so followers wait for and reuse the leader's result. The backend's generic `REFRESH_TOKEN_INVALID` response remains unable to distinguish theft from a bypassed legitimate race; coordination prevents the normal browser race before it reaches the server. Each environment uses only its configured API origin; no cross-environment fallback is allowed for any request. Auth/session logic must not be changed without explicit human approval; future auth prompts must reference this rule and obtain sign-off before implementation.
- **Status:** Active
- **Platform:** Web
- **File(s):** `web/lib/auth.ts`, `web/lib/api-origin.ts`, `web/components/app-shell-route.tsx`
- **Since:** 2026-09-01 (UTC)

### Rule: Signup Creates Active Public Accounts
- **What:** A successful signup creates a user with a lowercased unique email, unique username, display name defaulting to username when omitted, `is_private = false`, a hashed password, and `is_verified = true`.
- **Edge cases:** Signup rejects duplicate emails and duplicate usernames with `409`. OTP records/services exist only as stubs; no OTP challenge is active in signup.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `api/app/models/user.py`
- **Since:** 2026-08-29T07:15:00Z

### Rule: Password And Username Validation
- **What:** Passwords must be at least 8 characters, contain no whitespace, and include at least one uppercase letter, lowercase letter, number, and special character. Usernames must be 1-64 characters and may contain only letters, numbers, `.`, `_`, and `-` with no spaces.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `api/tests/test_validation.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Minimum Signup Age
- **What:** Signup requires users to be at least 13 years old based on `date_of_birth`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/tests/test_validation.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Login Lockout
- **What:** Five failed login attempts for an existing account lock the account for 3 hours. A locked account returns `423` with an ISO retry timestamp. Successful login clears failed-attempt state.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_lockout.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: JWT Sessions
- **What:** Login returns a bearer access token and sets an HTTP-only opaque refresh-token cookie. Access tokens default to 30 minutes; refresh tokens default to 14 days. Access JWT payloads are minimal and stable: `sub`, `typ`, `iat`, and `exp`, with a `kid` header identifying the signing key. Refresh tokens are stored server-side by SHA-256 hash only.
- **Edge cases:** Each login/device receives a refresh-token family. Every refresh rotates the presented token; presenting a rotated or revoked token revokes that family and returns a generic `401`. Logout revokes only the presented family and deletes the refresh cookie with `204`. Expired refresh rows are rejected and retained for bounded reuse-detection cleanup. Token failures are classified server-side as expired, malformed, signature mismatch, schema invalid, refresh-token invalid, or session/user not found; client responses keep details generic but include a machine-readable code.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/refresh_token.py`, `api/app/routers/auth.py`, `api/app/services/session_service.py`, `api/app/services/security.py`, `api/app/services/auth_errors.py`, `api/app/config.py`, `web/lib/auth.ts`, `api/tests/test_token_resilience.py`
- **Since:** 2026-08-31 (Asia/Karachi)

### Rule: Users Can Manage Their Active Sessions
- **What:** Settings > Account lists the user's active server-managed auth sessions with best-effort device, browser, operating-system, logged-in, and last-active information. The server identifies the current session from the presented refresh cookie; the UI never supplies that identity. Users may revoke other sessions individually or revoke all other sessions while preserving the current one.
- **Edge cases:** `refresh_tokens.session_id` is nullable so existing/orphaned refresh rows remain valid and are not backfilled. Missing user-agent parsing falls back to `Unknown device`. Raw tokens, hashes, IPs, and internal UUIDs are never shown. Access tokens already issued may remain valid until their normal expiry after revocation.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/auth_session.py`, `api/app/models/refresh_token.py`, `api/app/routers/auth.py`, `api/app/services/session_service.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx`
- **Since:** 2026-09-01T22:30:00Z

### Rule: JWT Secret Configuration Fails Loud
- **What:** `JWT_SECRET_KEY` is required at API settings load and has no application default or generated fallback. API startup logs only an 8-character SHA256 fingerprint of the configured secret so deploys can confirm secret stability without exposing the secret.
- **Edge cases:** Missing `JWT_SECRET_KEY` prevents startup through Pydantic settings validation. Vercel web/API and staging/production secret values must be verified in deployment settings when environments share a database.
- **Status:** Active
- **Platform:** API only
- **File(s):** `api/app/config.py`, `api/app/main.py`, `api/tests/test_token_resilience.py`
- **Since:** 2026-08-29T12:23:00Z

### Rule: Web Auth Refresh Is Silent For Expired Access Tokens
- **What:** **Deprecated/Superseded by `Authoritative Web Session And Refresh Model`.** The former behavior proactively refreshed access tokens at about 80% of token lifetime and allowed per-request opt-outs. Reactive refresh after `TOKEN_EXPIRED`, one retry, and explicit-refresh-401 session clearing remain only where they conform to the authoritative model.
- **Edge cases:** The old per-tab promise deduplication and feature-specific opt-outs are no longer the session contract. Cross-tab coordination, retryable non-terminal failures, and single-origin API resolution are governed by the authoritative rule above.
- **Status:** Deprecated
- **Platform:** Web only
- **File(s):** `web/lib/auth.ts`
- **Since:** 2026-08-29T12:23:00Z

### Rule: Current User Updates
- **What:** Authenticated users may update username, email, display name, about text, and privacy status. Username/email updates reject conflicts with another user.
- **Edge cases:** If no submitted value changes the user, the API returns the existing user without committing. `about` is capped at 256 characters and display name at 120.
- **Web input limit:** The Settings About textarea limits input to 128 characters and shows the live `x/128` count inside the lower-right of the field; the API's broader 256-character ceiling remains a backend safety limit.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`
- **Since:** 2026-08-29T07:15:00Z

### Rule: Users Can Change Their Password From Account Settings
- **What:** An authenticated user may change their password from `/settings/account` after providing the current password, a new password that satisfies the standard password rules, and a matching confirmation.
- **Edge cases:** The backend verifies the current password and remains authoritative for validation. Signup and Settings expose native `minLength`, `pattern`, and `title` hints for password-manager/browser guidance. Focusing the New password field exposes the live six-item password checklist. Failed changes do not alter the stored password; successful changes preserve the current session.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`, `web/lib/auth.ts`
- **Since:** 2026-08-31T20:57:15Z

### Rule: Web Settings Saves Confirm And Persist Through API
- **What:** Web settings that update account/profile fields call the current-user API and show a success toast after saving. Profile/account fields use icon-only tick save buttons. The Private Profile toggle saves immediately through the API when toggled.
- **Edge cases:** If an API-backed save fails, the UI reverts to the last known saved value. Theme and privacy changes require an explicit tick confirmation. Direct Messages and Mentions currently use client-side draft/save controls until corresponding backend settings exist.
- **Presentation:** Each expanded setting shows its title and summary once; its input/control body must not repeat the setting title as a second visible label, while retaining an accessible control name.

### Rule: Empty About Is Owner-Only Prompt
- **What:** New accounts and profiles with a deleted About keep the stored About value empty. Visitors see no placeholder text; the signed-in owner sees `Add about in settings.` instead.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Profile Pictures Are Optional
- **What:** Users may upload an optional profile picture through the authenticated profile settings flow. When `profile_picture_url` is null, all supported profile identity surfaces use the shared `web/public/media/profile.jpg` default profile picture.
- **Edge cases:** A profile picture is only persisted after the backend verifies the user-scoped object upload and removes the previously stored object when replacing one. Legacy flat object keys are also eligible for deletion. Missing R2 configuration produces a clear service-unavailable error; no fake storage or default credential behavior is allowed.
- **API documentation security:** FastAPI Swagger, ReDoc, and the OpenAPI schema remain available for staging diagnostics but are disabled in production. These documentation surfaces never replace authentication on protected endpoints.
- **Processing:** The client accepts JPG/JPEG, PNG, and WebP, compresses to JPEG before requesting an upload URL, rejects HEIC/HEIF and other unsupported formats, and the confirmation backstop rejects objects over 3 MB.
- **Crop and sizing:** Profile pictures require a square crop in a modal dialog before compression. Sources with a shorter edge below 128px are rejected before cropping, and crop zoom is capped at `shorterEdge / 128` so a smaller crop cannot be selected. The avatar output targets 512px square and approximately 250KB, but never upscales a crop smaller than 512px. The post-media preset targets 1024px maximum longest edge and approximately 500KB and is used by the submit-time post upload flow.
- **Preview and confirmation:** Selecting or cropping a file must not replace the visible server-confirmed avatar. The modal tick is the only post-selection upload control, and the modal closes only after the complete upload and API confirmation flow succeeds.

### Rule: Profile Setup Resumes Until Complete
- **What:** New accounts open the two-step profile setup flow after authentication. The flow is headed `Let's update your settings` and contains optional Profile picture and About steps.
- **Progress:** The current setup step and completion state are persisted on the user record. Skipping a step marks that step done and advances; closing the setup preserves the current step when persistence succeeds and dismisses the local modal even if the save is temporarily unavailable. An incomplete setup resumes from its persisted step on a later login.
- **Completion:** The setup is complete after the About step is saved or skipped. Existing accounts migrated after this flow was introduced are treated as already complete.

### Rule: Preserve Sessions During Recoverable API Failures
- **What:** Authenticated route bootstrap may clear the local session and redirect to login only after an explicit `401 Unauthorized` response.
- **Do not:** Network failures, API `5xx` responses, deployment errors, or database migration mismatches must not be treated as proof that a user's credentials are invalid.
- **Deployment:** Additive database migrations must be applied and verified before deploying code that reads the new fields; the client-side guard remains required as a second line of protection.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`, `web/app/globals.css`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Web Session Persistence
- **What:** The web client stores authenticated sessions in `localStorage` under `friink-auth-session`; logout clears that stored session.
- **Edge cases:** `loadPersistedAuthSession()` intentionally ignores the local demo email `demo@friink.local` so the public landing page does not redirect for demo sessions.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/lib/auth.ts`, `web/app/landing-auth-redirect.tsx`, `web/components/login-screen.tsx`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Profile Identity Blocks Link To Profiles
- **What:** Whenever app content shows a user's profile identity, the UI should use the shared `ProfileCard` instead of separately composing avatar/name/handle. In list surfaces such as Connections and Notifications, the visible profile card links to the user's profile route.
- **Edge cases:** Row action buttons such as Accept, Reject, Cancel, Remove, and post/chat actions remain separate controls. Do not nest a profile link inside a row rendered as a button; keep interactive targets valid and distinct.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-card.tsx`, `web/components/list-row.tsx`, `web/components/connections-screen.tsx`, `web/components/notifications-screen.tsx`
- **Since:** 2026-08-29T12:57:00Z

## Privacy & Connections

### Rule: Directional Follow Relationships
- **What:** Follows are directional and non-mutual. A row in `follow_requests` from `requester_id` to `recipient_id` represents the relationship or request history.
- **Edge cases:** Self-follow is rejected with `400`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/connection.py`, `api/app/services/connections.py`, `api/app/routers/connections.py`
- **Since:** 2026-08-29T07:15:00Z

### Rule: Home Following Feed Is Follow-Only
- **What:** The Home `Following` tab is the canonical `/home/following` route and returns posts only from accounts the signed-in user follows through an accepted directional follow relationship.
- **Edge cases:** The feed uses the same server-side filtering for initial pages, older-page pagination, newer-post polling, and saved-position context restoration. Users without follows see an empty feed; their own posts are not included unless they explicitly follow another account that authored them. The previous `/home/connections` slug redirects to `/home/following` for compatibility.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/routers/posts.py`, `api/app/services/posts.py`, `web/lib/auth.ts`, `web/components/home-screen.tsx`, `web/components/app-shell.tsx`, `web/app/home/[tab]/page.tsx`
- **Since:** 2026-08-31 (Asia/Karachi)

### Rule: Public Accounts Accept Follows Immediately
- **What:** Following a public account creates an `accepted` follow request row immediately and returns it as the active following relationship.
- **Edge cases:** If an active or pending row already exists, the existing row is returned instead of creating a duplicate.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29T07:15:00Z
- **Related rules:** Private Accounts Require Pending Requests; Follow Notifications

### Rule: Private Accounts Require Pending Requests
- **What:** Following a private account creates a `pending` request instead of an active follow. The recipient can accept or reject it.
- **Edge cases:** Pending requests are exposed through incoming/outgoing request endpoints and do not count as followers or following.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`, `web/components/connections-screen.tsx`
- **Since:** 2026-08-29T07:15:00Z
- **Related rules:** Request Notifications; Connections Lists Count Accepted Rows Only

### Rule: Rejected Requests Cool Down For 24 Hours
- **What:** When a pending request is rejected, the row is retained as `rejected` with `responded_at`, and the requester cannot resend to that private profile until 24 hours have passed.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Sender-Canceled Requests Can Trigger A Resend Lockout
- **What:** A requester may cancel pending requests, but after three cancellations within a rolling 3-hour cycle, another request to that private profile is blocked until 24 hours after the first cancellation in that cycle.
- **Edge cases:** One cancellation does not lock resending. The cooldown uses retained `canceled` rows where `removed_at` is null, so owner-side follower removals do not count as sender cancels.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Unfollow Removes The Active Edge From Counts
- **What:** Either party may remove an accepted connection by setting the row to `canceled`; it no longer appears in follower/following lists or counts.
- **Edge cases:** Unfollow does not notify the target. The implementation retains the row instead of hard-deleting it.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`
- **Since:** 2026-08-29T07:15:00Z

### Rule: Owner-Removed Followers Cool Down For 24 Hours
- **What:** When an account owner removes a follower, the active row becomes `canceled` with `removed_at`, and that follower cannot follow the owner again for 24 hours.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29T00:00:00Z

### Rule: Private-To-Public Auto-Accepts Pending Requests
- **What:** When a user changes from private to public, all pending requests received by that user become `accepted` in the same update flow.
- **Edge cases:** Changing from public to private does not alter existing followers or following rows.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_auth_updates.py`
- **Since:** 2026-08-29T07:15:00Z
- **Related rules:** Request Accepted Notifications

### Rule: Connections Lists Count Accepted Rows Only
- **What:** Followers and following endpoints return only users connected through `accepted` rows. Pending, rejected, and canceled rows are excluded.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `web/components/app-shell.tsx`
- **Since:** 2026-08-29T12:20:00Z

### Rule: Requests Tab Is Private-Account UI
- **What:** The web Connections page shows `All`, `Followers`, `Following`, and `Requests` for private signed-in accounts; public signed-in accounts see only `All`, `Followers`, and `Following`. If a public account lands on Requests, the web UI resets the filter to `All`.
- **Edge cases:** The backend request endpoints remain authenticated API routes regardless of the current user's privacy setting.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/connections-screen.tsx`
- **Since:** 2026-08-29T12:15:00Z

## Posts, Replies & Quotes

### Rule: One Posts Table Stores Posts, Replies, And Quotes
- **What:** Posts, replies, and quotes are distinguished by `kind`. Replies set `parent_post_id`; quotes set `quoted_post_id`; ordinary posts set neither.
- **Edge cases:** Replies are excluded from the main feed query. Deleted posts are excluded from normal fetches.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/post.py`, `api/app/services/posts.py`, `api/app/schemas/posts.py`
- **Since:** 2026-08-29T00:00:00Z

### Rule: Post Content And Media Limits
- **What:** Backend post content is capped at 512 characters. Normal posts and replies require non-blank content; quote posts may be created without typed quote text when `quoted_post_id` is present. The web floating post composer also applies a frontend-only 256-character entry limit and displays an `x/256` counter.
- **Edge cases:** Any non-null `media` payload currently returns `400` with `Media uploads are not yet supported.` The frontend's 256-character composer limit is stricter than the backend's 512-character API maximum.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/posts.py`, `api/app/services/posts.py`, `web/components/app-shell.tsx`, `web/components/composer.tsx`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Create Payload Must Match Post Kind
- **What:** Reply posts require `parent_post_id`; non-replies may not set `parent_post_id`. Quote posts require `quoted_post_id`; non-quotes may not set `quoted_post_id`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29T00:00:00Z

### Rule: Private Post Visibility Is Enforced Server-Side
- **What:** A private author's posts are visible only to the author and accepted followers. Public-author posts are visible without an accepted-follow check.
- **Edge cases:** Unauthorized or unauthenticated post detail and reply-list access resolves as `404`-equivalent `Post not found.` for protected posts.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/lib/auth.ts`
- **Since:** 2026-08-29T13:10:00Z
- **Related rules:** Reply Creation Rechecks Parent Visibility; Quote Cards Hide Protected Content

### Rule: Reply Creation Rechecks Parent Visibility
- **What:** A user cannot reply to a post unless the API confirms that user can view the parent post.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29T13:10:00Z
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### Rule: Private Posts Cannot Be Quoted
- **What:** Posts authored by private accounts cannot be quoted, even by the private account owner.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Quote Cards Hide Protected Content
- **What:** If a quoted post is deleted or unavailable, the quote payload is marked unavailable. If the quoted post's author is private and the viewer cannot view it, the quote card content becomes `Content not available`.
- **Edge cases:** Deleted or missing quoted posts use `Original post unavailable.`
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `web/components/feed-post.tsx`
- **Since:** 2026-08-29T13:10:00Z
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### Rule: Feed Pagination And Updates
- **What:** `GET /posts` returns cursor-paginated non-reply feed pages ordered newest first, with a default limit of 20 and maximum limit of 100. `GET /posts/updates` returns posts newer than a supplied top-feed anchor. `GET /posts/context/{post_id}` returns an anchor-centered slice for restoring reading position.
- **Edge cases:** Invalid cursors return `400`. Context for a missing, reply, or unauthorized anchor returns no context and the router reports `404`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/components/home-screen.tsx`
- **Since:** 2026-08-29T10:05:00Z

### Rule: Web Home Feed Restores Reading Position
- **What:** The web Home feed stores the top visible post id in `localStorage` and attempts to restore around that anchor on the next load.
- **Edge cases:** If the saved anchor fails to load, the client clears it and falls back to a normal feed load. Polling for newer posts runs only while the document is visible and uses a 10-second interval.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/home-screen.tsx`
- **Since:** 2026-08-29T10:05:00Z

### Rule: Canonical Post URLs Use Author Username And Post ID
- **What:** Canonical post-detail URLs use `/{username}/{postId}`. The legacy `/posts/{postId}` route fetches the post and redirects to the canonical author-scoped URL.
- **Edge cases:** If the username segment is stale or mismatched, the canonical route permanently redirects to the current author username while preserving query parameters.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/[username]/[postId]/page.tsx`, `web/app/posts/[postId]/page.tsx`, `web/lib/post-path.ts`
- **Since:** 2026-08-29T10:20:00Z

### Rule: Web Post Cards Navigate And Expand Text Locally
- **What:** Clicking a non-interactive area of a web post card opens the canonical post detail page. `Show more...` appears only when the body text exceeds four visible lines and expands that card in place instead of navigating.
- **Edge cases:** Profile links, reply/quote/like/share, star, overflow, and the `Show more...` button keep their own click behavior and do not trigger card navigation.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/feed-post.tsx`, `web/app/globals.css`
- **Since:** 2026-08-30 (Asia/Karachi)

## Notifications

### Rule: In-App Notifications Are Fetchable And Readable
- **What:** Authenticated users can fetch a paginated notification feed, fetch an unread count, mark one notification read, or mark all their notifications read.
- **Edge cases:** Notification feed pages default to 20 items and clamp to a maximum of 100. Marking another user's notification read returns `404`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/notification.py`, `api/app/services/notifications.py`, `api/app/routers/notifications.py`, `web/lib/auth.ts`, `web/components/notifications-screen.tsx`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Follow Notifications
- **What:** Following a public profile creates `follow_sent_public` for the actor and `new_follower` for the target.
- **Edge cases:** Unfollowing is silent for the target.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Request Notifications
- **What:** Sending a private follow request creates `request_sent` for the actor and `request_received` for the target.
- **Edge cases:** Canceling a request is silent for the target. Rejecting a request is silent for the requester.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Request Accepted Notifications
- **What:** Accepting a pending follow request creates `request_accepted` for the requester. Private-to-public auto-accept uses the same notification type.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/services/auth.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29T13:10:00Z

### Rule: Mention Notifications
- **What:** A post mentioning an existing username creates one `mention` notification for each distinct mentioned user other than the author. The notification identifies the author and links to the canonical post containing the mention.
- **Edge cases:** Repeated mentions in one post are deduplicated. Unknown usernames and self-mentions do not create notifications. Mention text is linked to the referenced profile in post and quoted-post views.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/models/notification.py`, `api/alembic/versions/20260901_0012_add_mention_notification.py`, `web/components/mention-text.tsx`, `web/components/feed-post.tsx`, `web/components/notifications-screen.tsx`, `web/components/app-shell.tsx`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Composer Mentions Resolve To Editable Identity Tokens
- **What:** In post, reply, and quote composers, typing a valid `@username` followed by a space resolves that user and displays an editable inline token with their small profile picture and `@username`.
- **Edge cases:** Unknown usernames remain ordinary text and cannot create mention notifications. Editing a resolved token unwraps it to ordinary text so mistakes can be corrected. In rendered posts, mentions remain compact clickable `@username` profile links without repeating the avatar.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/mention-input.tsx`, `web/components/composer.tsx`, `web/components/mention-text.tsx`, `api/app/services/posts.py`
- **Since:** 2026-09-01 (Asia/Karachi)

## Web Navigation & Client Behavior

### Rule: Floating Post Composer Expands Above Its Controls
- **What:** The floating post composer has no field background or border. Once typing begins, its text editor occupies the full-width top row and grows upward to eight lines; longer drafts scroll within the editor. Attachment, character count, and send controls remain in the bottom row.
- **Edge cases:** Empty composers retain the compact single-row layout. Chat composers are not changed by the post-composer expansion behavior.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/composer.tsx`, `web/components/mention-input.tsx`, `web/app/globals.css`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: API Origin Resolution
- **What:** Web API calls use `NEXT_PUBLIC_API_BASE_URL` when configured. Localhost browsing falls back to `http://localhost:8000`. Deployed browser contexts without an API origin throw a configuration error instead of silently calling localhost.
- **Edge cases:** If the configured origin is `https://staging-api.friink.com` and a network-level fetch fails for a safe read (`GET`, `HEAD`, or `OPTIONS`), the client retries `https://api.friink.com`. Mutations are never retried across origins because replaying them could duplicate or misroute user data.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/lib/api-origin.ts`, `web/lib/auth.ts`
- **Since:** 2026-08-29T10:40:00Z

### Rule: Public Pages Remain Accessible To Authenticated Users
- **What:** The public landing page and `/subscriptions` remain accessible when a user has a persisted non-demo auth session; authenticated visitors are not forcibly redirected to `/home`.
- **Edge cases:** The shared public `Header` reflects the session state and provides app navigation without replacing the public page. Demo sessions are not treated as signed-in public sessions.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/page.tsx`, `web/app/subscriptions/page.tsx`, `web/components/public-header.tsx`, `web/lib/auth.ts`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Public Header Uses Signed-In Account Menu
- **What:** The shared public header shows `Login` to signed-out visitors and the signed-in user's profile picture to authenticated visitors. Clicking the picture opens the reusable account menu directly below the picture with a 2px gap and 2px right offset; it shows the user's profile information, Feed (`/home`), Settings (`/settings`), and Log out.
- **Edge cases:** The Friink logo remains the public landing-page link; the public header does not add a redundant Home link. Logout clears the persisted client session and leaves the user on the public site.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/public-header.tsx`, `web/components/action-menu.tsx`, `web/lib/auth.ts`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Internal Account Identifiers Are Not User-Facing
- **What:** Database UUIDs and other internal implementation identifiers are not displayed in the normal Settings > Account screen.
- **Edge cases:** If support tooling later needs an account identifier, it should be provided through a deliberate support/advanced flow rather than the default account settings surface.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Public Plans Are Informational Until Billing Exists
- **What:** The public landing page includes a concise Plans section and links to `/subscriptions` for the full Free, Pro, and Pro+ comparison. Free signup links to `/login`; paid plan cards display `Coming soon` until billing and checkout are implemented.
- **Edge cases:** This page does not create subscriptions, process payments, or grant paid entitlements. The displayed plan benefits and prices are marketing content and must be updated with the subscription implementation before paid launch.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/page.tsx`, `web/app/subscriptions/page.tsx`, `web/app/landing.module.css`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Subscription Settings Starts As A Plan Summary
- **What:** Authenticated Settings includes a dedicated `/settings/subscription` tab showing the current Friink Free plan and linking to the public `/subscriptions` comparison page.
- **Edge cases:** The current plan is presentation-only until billing and entitlements exist; this tab does not process upgrades, payments, cancellations, or paid access.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/account-screens.tsx`, `web/app/settings/[tab]/page.tsx`, `web/app/globals.css`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Landing Newsletter Uses Zoho Form Submission
- **What:** The landing-page subscribe form submits the `Email` field to the configured Zoho Forms endpoint through a hidden iframe target and then disables the form with a submitted state.
- **Edge cases:** The submitted state is deferred briefly so the native form submission includes the email input.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/subscribe-form.tsx`, `web/app/page.tsx`
- **Since:** 2026-08-18T00:00:00Z

### Rule: Chat Filters Are Client-Side Mock Data Filters
- **What:** The web Chat screen filters local conversation data into `All`, `Muted`, and `Requests` tabs using fields from `web/lib/mock-conversations.ts`.
- **Edge cases:** There is no live backend chat, mute, or request API in the current codebase.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/screens.tsx`, `web/lib/mock-conversations.ts`, `web/components/app-shell.tsx`
- **Since:** 2026-08-29T12:05:00Z

### Rule: Appearance And Sidebar Preferences Use Cookies
- **What:** The web app stores appearance (`light`, `dark`, or `system`) and desktop sidebar collapsed state in cookies for one year.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/account-screens.tsx`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Profile Identity And Actions Are Client-Mapped
- **What:** The web profile screen treats the signed-in user's profile as self and other username routes as other-user profiles. Self-profile shows Edit; other-user profiles show follow/request/following state plus a message icon.
- **Edge cases:** Counts include accepted connections only, matching the Connections endpoints; pending, rejected, and canceled relationships are excluded. Self-profile Connections shows the signed-in user's data and request behavior; `/{username}/connections` is the canonical username-scoped route for the requested user's directory.
- **URL State:** Connections uses the username-scoped route `/{username}/connections`, with `/{username}/connections/followers`, `/{username}/connections/following`, and `/{username}/connections/requests` for filtered tabs. Selecting `All` returns to the base route. Legacy `/connections` routes remain compatibility entry points only.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/profile-client.tsx`
- **Since:** 2026-08-26T00:00:00Z

## Infrastructure & Deployment

### Rule: FastAPI Uses Sync SQLAlchemy Sessions
- **What:** The backend uses FastAPI with synchronous SQLAlchemy sessions and psycopg3 database URLs. Alembic migrations define the database schema.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/db.py`, `api/alembic/env.py`, `api/requirements.txt`, `api/api/index.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: CORS Allows Configured Frontend And Local Development
- **What:** The API allows CORS from `FRONTEND_URL`, `http://localhost:3000`, `http://127.0.0.1:3000`, and explicitly `https://staging.friink.com`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`, `api/app/config.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Database Health Endpoint Checks Connectivity Only
- **What:** `GET /health/db` opens a psycopg connection and runs `SELECT 1`, returning `{"database": true}` on success.
- **Edge cases:** This endpoint does not verify ORM schema compatibility; ORM-backed endpoint checks are still needed after migrations.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`
- **Since:** 2026-08-27T00:00:00Z
