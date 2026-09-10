# Friink Rules

This file documents product/business logic rules for features currently implemented
and active in the codebase. It does NOT cover planned features, deprecated behavior
(beyond marking it Deprecated below), or visual/design rules (see design.md).

When adding a new rule after implementing a feature: add it under the relevant feature
area heading using the template below. If no matching heading exists, create one. Do
not remove entries - mark superseded/removed behavior as Deprecated rather than deleting
the entry, so history isn't lost.

## Web Architecture

### Rule: Account Switcher Uses Device-Scoped Slots
- **What:** Remembered accounts are server-side slots bound to one device cookie. The default maximum is 4 accounts, configurable from 1 through 16 with `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`; lowering the value does not silently revoke existing slots.
- **Edge cases:** Add-account reuses an existing valid slot, refuses additions at the limit, and preserves the current account on failed authentication, list, or switch requests. Opening the selector shows the cached device-scoped list immediately while one deduplicated async refresh runs; add, switch, and logout operations must refresh the list immediately afterward. A failed refresh leaves the cached/current account usable and exposes a subtle retry action. Active logout revokes only the matching account slot and falls back to the most-recent remaining slot, or the public site when none remain.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/services/account_slots.py`, `web/lib/auth.ts`, `web/components/side-drawer.tsx`, `web/components/app-shell-route.tsx`
- **Since:** 2026-09-07 (UTC)

### Rule: OTP Flags Are API-Owned Runtime Configuration
- **What:** `OTP_ENABLED` is the API-owned master switch and defaults to `true`. When enabled, `SIGNUP_OTP_ENABLED` controls signup verification and `LOGIN_RISK_OTP_ENABLED` controls risk-based normal-login OTP. When `OTP_ENABLED=false`, all OTP challenges are bypassed, including signup, risk-based login, lifecycle reactivation/deletion, and email-change verification. The master switch must be read from the FastAPI deployment environment and verified after redeployment; changing only the web project is insufficient.
- **Edge cases:** The master switch is intended for local/test/staging use and must remain enabled in production; production API startup rejects `OTP_ENABLED=false`. An absent variable uses the secure default (`true`); an empty value is not a valid substitute for omission. A disabled flow must not produce its corresponding prompt. Diagnostics may report effective flag values and the deployment identifier, but never secrets, tokens, OTPs, cookies, hashes, or internal identifiers.
- **Status:** Active
- **Platform:** API/Web
- **File(s):** `api/app/config.py`, `api/app/routers/auth.py`, `api/app/services/auth_debug.py`
- **Since:** 2026-09-07 (UTC)

### Rule: Post Media Uploads Are Submit-Time And Image-Only
- **What:** A post may include up to 8 JPEG images. The composer keeps selected files local until the user submits, allows the user to reorder the selected attachments before submission, and submits files in the visible order. Clicking a thumbnail opens the 3:5 crop tool directly; Reset restores the crop view, Apply saves the crop, and previous/next arrows switch among attached images. The API then validates ownership, type, and size before associating them with the authenticated user's new post.
- **Edge cases:** The shared post-media preparation targets a 1024px maximum longest edge and approximately 500KB per image. While the post/media request is running, the Post button is disabled and shows the posting spinner; failed submissions preserve the draft and attachments for retry, while successful submissions clear them. Failed submissions must clean up uploaded objects and must not leave a half-created post. Post deletion removes associated post-media objects before marking the post deleted. Successfully associated media is returned as URL items and rendered through the shared gallery: multiple images remain available in the horizontal slider with a common nominal height (`24rem` desktop, `15rem` compact screens), a default 3:4 frame, an 8px gap, and 8px rounded image frames; a single image preserves its natural aspect ratio within the available content width and responsive maximum height without a trailing gallery background. The crop tool remains 3:5. Final crop width, height, and aspect ratio are not persisted in media rows. Freeform crop bounds and first-image carousel-ratio locking are not implemented. The shared modal backdrop is above application overlays so crop controls remain interactive.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `web/components/composer.tsx`, `web/components/app-shell.tsx`, `web/components/post-media-gallery.tsx`, `web/lib/auth.ts`, `web/lib/data.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/app/globals.css`, `api/app/routers/posts.py`, `api/app/services/posts.py`, `api/app/services/storage.py`, `api/app/models/post.py`
- **Since:** 2026-09-01 (UTC)

### Rule: Web UI Fixes Must Be Component-Level
- **What:** Reusable web UI behavior, layout, spacing, and interaction fixes must be implemented in shared components, shared CSS contracts, or shell-level state owners rather than inline styles, route-only patches, or one-off page wrappers.
- **Edge cases:** A route may be added to expose a feature URL, such as `/search/[query]`, but the route should delegate visible layout and behavior to shared shell/screen/row primitives. Logged-in app page-specific CSS, CSS Modules, route-only stylesheets, inline CSS, and TSX visual design are not allowed. The public landing stylesheet remains a separate public-site concern.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/*`, `web/app/globals.css`, `packages/design/design.md`, `README.md`
- **Since:** 2026-08-30 (Asia/Karachi)

### Rule: Tablet And Desktop Content Use A 720px Shared Cap
- **What:** The visible shared `ContentBox` and contextual `FloatingBar` surfaces cap at `720px` on tablet and desktop and center within the available main panel after accounting for the side drawer. The shared horizontal gutter is applied outside that visible cap (`16px` desktop, `8px` mobile); on smaller mobile screens both surfaces remain fluid within the gutter.
- **Edge cases:** Screen-level wrappers must not introduce competing max-widths or duplicate outer gutters. List surfaces must use a shrinkable grid track so media min-content width cannot expand beyond `ContentBox`. The floating bar rail must use the same available main-panel area as `ContentBox`: full viewport width on mobile, and from the desktop sidebar edge to the viewport edge on tablet and desktop. The bar itself retains the shared `720px` cap and flex/margin-auto centering.
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

### Rule: Header Chat Link Reflects Conversation Unread State
- **What:** The global signed-in Header owns the Chat link between Search and Notifications. It routes to `/chats` and shows a small accent dot whenever the authenticated conversation list contains one or more unread messages. Chat is not duplicated in the SideDrawer.
- **Edge cases:** The unread state is server-authoritative, uses the existing visibility-aware four-second conversation polling loop, pauses while the document is hidden, and resumes on focus or visibility recovery. A failed refresh does not invent a new unread state. The legacy `/chat` root remains a compatibility redirect to `/chats`; username-scoped conversation routes remain `/{username}/chat`.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/header.tsx`, `web/components/app-shell.tsx`, `web/components/side-drawer.tsx`, `web/lib/data.ts`, `web/app/chats/page.tsx`, `web/app/globals.css`
- **Since:** 2026-09-03T17:20:29Z

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

### Rule: Post Likes And Saves Are Durable, Unique Reactions
- **What:** Signed-in users may Like/Unlike and Save/Unsave visible `POST` records. Each user can have at most one Like and one Save per post at a time. Like and Save counts are public post aggregates; viewer-specific active state is returned only to an authenticated viewer. Replies are not reaction targets.
- **Edge cases:** Database unique constraints and a post row lock make retries and concurrent toggles idempotent. Self-Likes do not notify the owner. A confirmed Like by another user creates one in-app owner notification; Unlike and all Save operations are silent. Deleted, private, blocked, or otherwise inaccessible posts cannot be reacted to and are omitted from the user's Liked/Saved lists. Direct unavailable post URLs render the neutral unavailable state.
- **Privacy:** `likes_visible` defaults to true and is managed under Settings > Privacy. When disabled, the user's Like identity is omitted from actor lists and their Likes tab is hidden from other signed-in users, while counts and the user's own view remain intact. Saves have no actor list and are not controlled by this setting.
- **Status:** Active; staging migration and authenticated reaction E2E passed, production migration/schema verified read-only. Deployed browser verification remains a release step after the code is deployed.
- **Platform:** Web/API
- **File(s):** `api/app/models/post.py`, `api/app/models/user.py`, `api/app/services/reactions.py`, `api/app/routers/posts.py`, `api/app/routers/users.py`, `api/app/services/posts.py`, `web/components/feed-post.tsx`, `web/components/post-likes-modal.tsx`, `web/components/profile-screen.tsx`, `web/components/saved-screen.tsx`, `web/components/account-screens.tsx`, `docs/like-and-star.md`
- **Since:** 2026-09-03T20:02:30Z

### Rule: Saved Surfaces Use Stable Post And Profile Routes
- **What:** The signed-in Saved area uses `/saved/posts` for the user's private saved-post feed and `/saved/profiles` as the reserved future profile-saving surface. `/saved` and legacy `/starred` redirect to `/saved/posts`. The `/saved/profiles` view remains a placeholder until profile saving is implemented.
- **Interaction:** Each post has one Save/Unsave control: the star in the lower counted action row. The redundant header star is not rendered. The adjacent Save count is display-only because Save actors are private.
- **Status:** Active; profile saving is planned, not implemented.
- **Platform:** Web only
- **File(s):** `web/app/saved/page.tsx`, `web/app/saved/posts/page.tsx`, `web/app/saved/profiles/page.tsx`, `web/app/starred/page.tsx`, `web/components/saved-screen.tsx`, `web/components/feed-post.tsx`, `web/components/app-shell.tsx`, `web/components/side-drawer.tsx`
- **Since:** 2026-09-06 (Asia/Karachi)

## Authentication & Accounts

### Rule: Staff Discovery Is Separate From Ordinary User Features
- **What:** `users.is_staff` defaults to false. Authenticated user responses may expose it so the web shell can show the Control panel entry only to staff users. It does not authorize sensitive control-panel actions.
- **Edge cases:** Ordinary users have no staff access. The initial `admin@friink.com` / `@admin` account is created through controlled password-safe tooling, never a migration or committed secret.
- **Status:** Active for staff discovery and the staging-verified Control panel.
- **Platform:** Web/API
- **File(s):** `api/app/models/user.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/side-drawer.tsx`, `api/scripts/bootstrap_admin.py`
- **Since:** 2026-09-08 (UTC)

### Rule: Staff Access Uses Roles And Additive Direct Grants
- **What:** Staff users may hold multiple roles. Effective control-panel access is the union of permissions from all assigned roles plus additive per-user grants. The only initially seeded role is `superadmin`; additional roles are created when needed.
- **Edge cases:** A user with `is_staff = true` but no roles sees the Control panel entry and a no-access empty state. The panel uses one drawer entry with `Overview`, `Staff`, `Users`, `Security & Sessions`, `Audit Log`, and `Public site` tabs. `Users` is the only functional section in the current rollout; the other sections are explicit placeholders. Tabs and actions are shown only when the current effective permission allows them. Missing or expired privileged access opens the shared staff-verification modal; closing it returns to the prior screen while the ordinary Friink session stays active. Turning `is_staff` off removes staff access immediately and revokes privileged staff sessions; ordinary Friink access is unaffected.
- **Status:** Active; implementation and staging browser verification are complete.
- **Platform:** Web/API
- **File(s):** `docs/auth-and-session.md`, `packages/design/design.md`, `web/components/side-drawer.tsx`, `web/components/control-panel-screen.tsx`, `web/components/modal.tsx`
- **Since:** 2026-09-08 (UTC)

### Rule: Subscription Entitlements Use One Server-Resolved Assignment
- **What:** The API seeds Friink Free, Pro, and Pro+ plans and resolves a user's effective plan from at most one current manual assignment. A missing, expired, or revoked assignment falls back to Free; expiry is checked against server UTC at read time.
- **Edge cases:** Superadmins may grant an active plan for 1–3650 days or indefinitely, or revoke it, with a required reason. A new grant closes the prior effective assignment and preserves history. Admin assignment reads compute `active`, `expired`, or `revoked` from the same effective-state check rather than trusting the stored status column. No checkout, payment, billing, scheduler, or background expiry process exists.
- **Status:** Active for the admin-only API foundation; frontend administration and billing remain out of scope.
- **Platform:** API
- **File(s):** `api/app/models/subscription.py`, `api/app/services/subscriptions.py`, `api/app/routers/subscriptions.py`, `api/alembic/versions/20260910_0042_subscriptions.py`
- **Since:** 2026-09-10 (UTC)

### Rule: Password Recovery Uses Email Reset Links
- **What:** Password recovery accepts an account email, sends a single-use reset link with a 30-minute expiry, stores only a token hash, and revokes refresh-token families after successful reset. Usernames alone cannot authorize recovery.
- **Edge cases:** Existing and non-existing emails receive the same generic response; no reset token is returned by the API. Ordinary user-requested recovery may reuse the current password. A reset link issued for suspicious failed-login activity must use a password different from the current password; this is enforced server-side from the durable token purpose. Authenticated password changes must also differ from the current password. The reset UI must distinguish valid, expired, used, invalid, and successful-link states without exposing account existence or raw tokens. `OTP_ENABLED=false` does not disable this separate email-token flow. The complete copy, delivery, and reset-page contract lives in `docs/forget-password.md`.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `docs/forget-password.md`, `api/app/services/password_reset.py`, `api/app/routers/auth.py`, `web/app/reset-password/page.tsx`
- **Since:** 2026-09-08 (UTC)

### Rule: Account Settings Show Server-Created Joined Date
- **What:** Settings > Account shows a read-only `Joined` field using the account’s server-side creation timestamp. The web client formats the value for the user’s locale and time zone and never derives it from the browser clock.
- **Edge cases:** The field is display-only and is unavailable if the API returns an invalid timestamp. It uses the existing authenticated user response; no separate account-history value is created.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `api/app/models/user.py`, `api/app/schemas/auth.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx`, `docs/auth-and-session.md`
- **Since:** 2026-09-11 (UTC)

### Rule: Authoritative Web Session And Refresh Model
- **What:** This is the single authoritative model for all future web authentication/session work. Authenticated requests send the current access token and refresh only after a `401 TOKEN_EXPIRED`; they retry the original request exactly once with the refreshed token. No request proactively refreshes before receiving a 401. Only an explicit 401 returned by the refresh exchange clears local session state and redirects to `/login`.
- **Edge cases:** Network, timeout, CORS, 403, 5xx, malformed-response, and other original-request failures never refresh or clear the session and remain retryable errors. Refresh network/timeout/CORS/5xx/malformed failures also preserve the session. Refreshes are coordinated across tabs with the browser Web Locks API when available and a shared browser-storage lease/result fallback, so followers wait for and reuse the leader's result. The backend's generic `REFRESH_TOKEN_INVALID` response remains unable to distinguish theft from a bypassed legitimate race; coordination prevents the normal browser race before it reaches the server. Each environment uses only its configured API origin; no cross-environment fallback is allowed for any request. Auth/session logic must not be changed without explicit human approval; future auth prompts must reference this rule and obtain sign-off before implementation.
- **Status:** Active
- **Platform:** Web
- **File(s):** `web/lib/auth.ts`, `web/lib/api-origin.ts`, `web/components/app-shell-route.tsx`

### Rule: OTP Verification Timeout Recovery
- **What:** A client or network timeout while completing OTP verification is ambiguous because the API may already have committed the authenticated session. The shared web login handler may make one refresh-cookie recovery attempt before displaying an error, then continues the normal authenticated redirect if recovery succeeds.
- **Edge cases:** This applies equally to standalone login and in-app Add account. Invalid or expired OTP responses retain their normal errors; recovery must not loop, clear the active account, or infer account identity from the email address. Only an explicitly confirmed terminal session result may clear local auth.
- **Status:** Active
- **Platform:** Web
- **File(s):** `web/components/login-screen.tsx`, `web/lib/auth.ts`, `docs/auth-and-session.md`
- **Since:** 2026-09-01 (UTC)

### Rule: Multiple Account Switching
- **What:** After authentication, the web side drawer will provide `Add account`. It opens a design-system modal that reuses the login/signup fields and actions, supports both login and signup, and follows the email → OTP → password → profile signup sequence. A successful authentication adds that account to the current browser profile. `Change account` remains hidden until at least two accounts are authenticated, then switches only among accounts registered on that device. The switcher limit is controlled server-side by `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`, defaulting to four; this does not limit account creation.
- **Security boundary:** Accounts remain fully independent identities; there is no account-to-account link, merged profile, shared security state, or cross-account data access. Device session slots and account-specific sessions are server-authoritative operational records only. Switching must validate an opaque slot and its device/session state; it must never trust a client-supplied user ID, email, or username. Refresh credentials stay HttpOnly on web and in platform secure storage on mobile. Account lists expose safe display metadata only, and all account-scoped data, notifications, caches, and session controls remain isolated. OTP completion for another account must preserve an existing `friink_device_id`; it must not silently replace the browser device identity and hide prior slots.
- **Compatibility:** This is an additive extension to the current one-account session path. Existing password, signup OTP, JWT, refresh rotation, terminal-versus-ambiguous failure, logout, and revocation rules remain in force. Mobile-specific requirements are deferred in `docs/auth-and-session-mobile.md`.
- **Status:** Active for the web/API slice; mobile requirements deferred
- **Platform:** Web/API
- **File(s):** `docs/auth-and-session.md`, `web/components/side-drawer.tsx`, `web/components/login-screen.tsx`, `web/lib/auth.ts`
- **Since:** 2026-09-04T23:28:41Z

### Rule: Login Route Is Signed-Out Only
- **What:** `/login` is a signed-out entry point. If a persisted authenticated session exists, including a demo session, the route redirects to `/home` and does not render the standalone login form. Authenticated users add another account through the in-app SideDrawer account menu, whose existing modal supports both login and signup.
- **Edge cases:** The route check runs before the standalone form is rendered to avoid an authenticated-user login flash. Account addition does not navigate through `/login`.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/login/login-client.tsx`, `web/components/side-drawer.tsx`, `web/components/login-screen.tsx`
- **Since:** 2026-09-06T20:02:37Z

### Rule: New-Device Verification Uses One Approval Path
- **What:** A new-device login submits credentials once, then completes exactly one verification path: the emailed four-minute OTP or approval from an existing signed-in session.
- **Security boundary:** Approval requests show only coarse device details and Approve/Deny actions; existing sessions never display the plaintext email OTP. The OTP is single-use, hashed, attempt-limited, rate-limited, and bound to the intended login/device.
- **Status:** Active; API approval flow and web approval controls implemented. Mobile-specific implementation is deferred.
- **Platform:** Web/API
- **File(s):** `docs/auth-and-session.md`, `api/app/routers/auth.py`, `web/lib/auth.ts`
- **Since:** 2026-09-06T16:52:53Z

### Rule: Account Switcher UX
- **What:** Add account opens the existing modal with Login first and Create account below. Successful authentication activates the new or already-remembered account. The drawer exposes switching, Add account, and active-account logout. Non-current accounts have an inline right-side logout action; the current account retains its checkmark.
- **Edge cases:** Logout/removal is confirmed with the selected account's profile card. Active logout selects the most recently used remaining account or returns to the public site. Deactivated and pending-deletion accounts show lifecycle messaging, are removed from the device list, and switch automatically. Before adding an account, a legacy active session without a device slot is migrated into one when possible so it remains switchable. Reaching the server limit keeps Add account usable while the API remains authoritative. During an account switch, the selected row shows a spinner and all account rows, logout actions, and Add account are disabled until the request succeeds or fails. A successful switch updates the in-memory app shell and remounts it for the new user without a browser-level reload.
- **Status:** Active for the Phase 4e web slice; mobile-specific requirements are deferred in `docs/auth-and-session-mobile.md`.
- **Platform:** Web
- **File(s):** `web/components/side-drawer.tsx`, `web/components/modal.tsx`, `web/components/login-screen.tsx`, `docs/auth-and-session.md`
- **Since:** 2026-09-06T16:52:53Z

### Rule: Drawer Account Controls Use Profile Menu
- **What:** The signed-in SideDrawer profile card has a separate caret account-menu trigger. The expanded drawer places it beside the profile card; the collapsed desktop drawer places it over the avatar's bottom-right corner. The menu shows `Using as @username`, all remembered accounts in the existing server-provided order, then Manage accounts and Add account.
- **Edge cases:** The ProfileCard remains separate from the account-menu trigger, and the existing Profile navigation item remains the drawer's profile destination. The menu only reorganizes existing web account actions; it creates no backend relationship and changes no account/session rules.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/side-drawer.tsx`, `web/components/action-menu.tsx`, `web/app/globals.css`
- **Since:** 2026-09-06T19:57:29Z

### Rule: Signup Creates Active Public Accounts
- **What:** A completed signup creates a user with a normalized unique email, a case-insensitive unique username key with preserved display casing, display name defaulting to username when omitted, `is_private = false`, a hashed password, and `is_verified = true`. When signup OTP is enabled, completion occurs only through successful email verification.
- **Edge cases:** Signup validates username syntax and checks username availability before submission. The API remains authoritative and rejects duplicate usernames case-insensitively with `409`; the database enforces the same invariant. The direct signup endpoint is unavailable while OTP is enabled, preventing a client-side bypass.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `api/app/models/user.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`
- **Since:** 2026-09-04T22:06:53Z

### Rule: Existing Email Signup Recovery
- **What:** When email-first signup receives an email already registered to Friink, the API creates no signup reservation or signup OTP. It sends a separate single-use, 15-minute sign-in link to the registered address while the web flow stays on the email step with neutral copy.
- **Security boundary:** The browser response must not say that the email is registered or offer account-specific recovery text. The link is delivered only to the address on file, uses the normal session path, and delivery failure does not change the neutral response. Unknown-email login remains generic and never auto-creates an account.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `web/lib/auth.ts`, `docs/auth-and-session.md`
- **Since:** 2026-09-07T01:00:00Z

### Rule: Signup Email Ownership OTP
- **Current clarification:** Existing registered emails use the separate
  sign-in-link recovery rule above; they do not follow the former
  login-or-different-email UI path.
- **What:** With `SIGNUP_OTP_ENABLED=true`, signup uses `/auth/signup/email/start` immediately after email, followed by `/auth/signup/email/verify`, then `/auth/signup/complete`; no user row is created before successful verification. Codes are six uppercase alphanumeric characters, expire after four minutes, are single-use, and a newer code invalidates the previous code.
- **Edge cases:** Verification is limited to five attempts. The pre-verification record contains only the normalized email and hashed OTP; password/profile data is submitted after verification. New signup emails receive the OTP flow; existing emails use the separate registered-address sign-in-link rule and do not receive a signup OTP. Resend delivery is server-side only through `RESEND_API_KEY`; ordinary login remains password-only unless the separate risk-based login OTP flow is implemented.
- **Status:** Active; implementation and database-backed request tests pass. Live staging browser/provider verification remains a deployment acceptance step.
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/services/email.py`, `api/app/services/otp.py`, `api/app/config.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`, `api/tests/test_email.py`
- **Since:** 2026-09-04T22:06:53Z

### Rule: Password And Username Validation
- **What:** Passwords must be at least 8 characters, contain no whitespace, and include at least one uppercase letter, lowercase letter, number, and special character. Passwords are limited to 72 UTF-8 bytes to match the current bcrypt storage format. Usernames must be 2-32 characters and may contain only letters, numbers, `.`, `_`, and `-` with no spaces. Username identity is case-insensitive: accepted usernames are canonicalized to lowercase for storage and routing, while the handle is displayed in that canonical form. Display names are optional, trimmed, and limited to 124 characters.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `api/tests/test_validation.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Security Events And Login Notifications Are Durable And Idempotent
- **What:** Successful fresh logins create one durable security event and one user-visible `login_security` notification. Refreshes, retries, and ordinary session activity never create duplicate fresh-login notifications. Security events may record refreshes, failed logins, logout, login challenges, and refresh-token reuse with stable event keys and server-side user/session/device context.
- **Edge cases:** Notification delivery runs through a row-locked, retryable outbox after authentication commits. Provider, network, or configuration failures remain delivery failures and must not log the user out. Event-linked notification uniqueness and stale-processing recovery protect duplicate workers and delayed delivery. Future email delivery uses the provider-neutral outbox hook and is not required for in-app login notification success. Audit insertion uses idempotent conflict handling; after insert or conflict, the event is resolved by its unique event key.
- **Failure isolation:** Security-event recording is a non-blocking side effect at auth-critical call sites, including login, refresh/reuse detection, bootstrap, logout, failed-login tracking, and staff actions. Any audit insert, lookup, assertion, connection, or other exception is logged loudly and swallowed; it must not alter the primary auth response or roll back the token/session decision.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/security_event.py`, `api/app/models/notification_outbox.py`, `api/app/models/notification.py`, `api/app/services/security_events.py`, `api/app/routers/auth.py`, `web/components/app-shell.tsx`
- **Since:** 2026-09-05T22:02:50Z

### Rule: Minimum Signup Age
- **What:** Signup requires users to be at least 13 years old based on `date_of_birth`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/tests/test_validation.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Login Lockout
- **What:** Failed-login throttling is account-based and progressive: failures 1–3 have no cooldown, failures 4–5 use one minute, failures 6–8 use five minutes, and failures 9+ use a capped fifteen-minute cooldown. A successful login or password reset clears the state; 24 hours without another failure also clears it. Attempts during cooldown do not extend or advance the tier. A secondary hashed per-IP throttle applies across protected authentication endpoints, using an initial 100-request/10-minute baseline followed by a one-minute IP cooldown; shared-network bans are not used.
- **Security boundary:** Unknown identifiers do not create account-specific state and remain subject only to generic endpoint/IP protections. Email and username login share the same account state. Device/session throttling is explicitly out of scope; existing device recognition and risk-based OTP remain separate.
- **Notifications:** The third failure creates at most one failed-login security notification per account per rolling 24 hours. Delivery is non-blocking and cannot alter the authentication result.
- **UX:** Progressive cooldowns return `429` with server-provided remaining time and distinct retry copy. The web login form preserves the identifier, clears the password, disables submission, and maintains an accessible countdown across refreshes and tabs. It must not show attempts remaining, tier names, IP/device metadata, or full-lock copy.
- **Full lock:** A separate full account lock returns `423` with exactly `Your account is locked. Contact support.` and no reason, duration, or retry detail.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_lockout.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Login With Email Or Username
- **What:** The login identifier accepts either the account email or username. Email and username matching are case-insensitive; username lookup uses the authoritative `username_key`. The web field is labeled `Email or username`, while signup remains email-only.
- **Edge cases:** Unknown identifiers and wrong passwords return the same generic invalid-credentials result. Username login follows the same lockout, rate-limit, device-recognition, and future risk-based OTP decisions as email login. A leading `@` is accepted and stripped for username lookup. The API may accept the legacy `email` request key during client migration, but new clients send `identifier`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/app/services/auth.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`, `api/tests/test_auth_updates.py`
- **Since:** 2026-09-05T00:00:00Z

### Rule: Permanent Email Uniqueness
- **What:** One normalized email address can belong to only one Friink account permanently. This rule applies across all accounts and remains in force when multiple-account support is added; accounts are never linked or allowed to share an email.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/user.py`, `api/app/services/auth.py`, `api/alembic/versions/20260905_0029_casefold_email_uniqueness.py`
- **Since:** 2026-09-05T00:00:00Z

### Rule: Risk-Based Login And Device Recognition
- **What:** Email and username password logins use the same server-authoritative risk decision. Recognized normal devices proceed without OTP; new or suspicious devices receive a fresh four-minute email OTP when delivery is configured. The device identifier is opaque, hashed at rest, HttpOnly on web, and separate from refresh tokens and sessions.
- **Edge cases:** Missing or changed device signals trigger the challenge; successful approval records the current coarse signals. Refresh never requires OTP, and no client claim, IP address alone, or browser fingerprint alone establishes trust. Missing or unreadable device cookies are fail-closed and force the OTP path, covered by `test_risk_login_challenges_new_changed_and_recognized_devices` in `api/tests/test_phase2_auth_flows.py`. When OTP is completed for an account not yet recognized on a browser that already has a device cookie, the existing cookie is retained so device account slots survive.
- **Status:** Active; implementation and database-backed request tests pass. Live staging browser/provider verification remains a deployment acceptance step.
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/services/login_challenges.py`, `api/app/services/session_service.py`, `api/app/services/email.py`, `api/app/config.py`, `api/alembic/versions/20260905_0026_login_risk_challenges.py`, `api/tests/test_phase2_auth_flows.py`
- **Since:** 2026-09-05T00:00:00Z

### Rule: Account Lock And Access-Token Boundary
- **What:** Account locking blocks password login and refresh only. Already-issued short-lived access JWTs are not force-invalidated and remain valid until normal expiry; no lock-state revocation/version check is added to authenticated access-token validation.
- **Edge cases:** Lifecycle deactivation/pending deletion is intentionally a separate, stricter boundary: `get_current_user` rejects already-issued access JWTs for inactive lifecycle states while ordinary account locks do not. The paired regression is `test_deactivation_rejects_existing_access_token_but_lock_does_not` in `api/tests/test_phase2_auth_flows.py`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/user.py`, `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/alembic/versions/20260905_0026_login_risk_challenges.py`
- **Since:** 2026-09-05T00:00:00Z

### Rule: Username Release And Lockout Copy
- **What:** Username changes require no step-up authentication. Released usernames, including high-profile usernames, are immediately available with no cooldown. Full account locks show exactly `Your account is locked. Contact support.`; progressive cooldowns show a distinct tier-specific retry message and must never use the full-lock copy.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/routers/auth.py`, `packages/design/design.md`, `docs/auth-and-session.md`
- **Since:** 2026-09-05T00:00:00Z

### Rule: JWT Sessions
- **What:** Login returns a bearer access token and sets an HTTP-only opaque refresh-token cookie. Access tokens default to 30 minutes; refresh tokens default to 14 days. Access JWT payloads are minimal and stable: `sub`, `typ`, `iat`, and `exp`, with a `kid` header identifying the signing key. Refresh tokens are stored server-side by SHA-256 hash only.
- **Edge cases:** Each login/device receives a refresh-token family. Every refresh rotates the presented token; presenting a rotated or revoked token revokes that family, records one durable `refresh_reuse_detected` security event, and returns the same generic `401`. Logout revokes only the presented family and deletes the refresh cookie with `204`. Expired refresh rows are rejected and retained for bounded reuse-detection cleanup. Token failures are classified server-side as expired, malformed, signature mismatch, schema invalid, refresh-token invalid, or session/user not found; client responses keep details generic but include a machine-readable code. Event and generic-response behavior are covered by `test_refresh_rotation_reuse_logout_legacy` in `api/tests/test_refresh_token_rotation.py`.
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
- **What:** Authenticated users may update username, display name, about text, and privacy status. Email changes require current-password confirmation followed by the dedicated new-email ownership OTP flow; direct email updates through the general profile endpoint are rejected. Settings validates username availability before submission, and the API/database remain authoritative: username/email updates reject conflicts with another user, with both identifiers compared case-insensitively.
- **Edge cases:** If no submitted value changes the user, the API returns the existing user without committing. `about` is capped at 256 characters and display name at 120.
- **Web input limit:** The Settings About textarea limits input to 128 characters and shows the live `x/128` count inside the lower-right of the field; the API's broader 256-character ceiling remains a backend safety limit.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`
- **Since:** 2026-08-29T07:15:00Z

### Rule: Users Can Change Their Password From Account Settings
- **What:** An authenticated user may change their password from `/settings/account` after providing the current password, a new password that satisfies the standard password rules, and a matching confirmation.
- **Edge cases:** The backend verifies the current password and remains authoritative for validation. Signup and Settings expose native `minLength`, `maxLength`, `pattern`, and `title` hints for password-manager/browser guidance. Focusing the New password field exposes the shared concise password checklist. Failed changes do not alter the stored password; successful changes preserve the current session.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`, `web/lib/auth.ts`
- **Since:** 2026-08-31T20:57:15Z

### Rule: Web Settings Saves Confirm And Persist Through API
- **What:** Web settings that update account/profile fields call the current-user API and show a success toast after saving. Profile/account fields use icon-only tick save buttons. The Private Profile toggle saves immediately through the API when toggled.
- **Edge cases:** If an API-backed save fails, the UI reverts to the last known saved value. Theme and privacy changes require an explicit tick confirmation. Direct Messages and Mentions currently use client-side draft/save controls until corresponding backend settings exist.
- **Presentation:** Each expanded setting shows its title and summary once; its input/control body must not repeat the setting title as a second visible label, while retaining an accessible control name. Every settings row uses a left setting icon, a shrinkable middle setting body, and a right-side action rail; right-side save and action controls are square icon-only controls with accessible labels/tooltips.

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
- **What:** The web client stores only safe authenticated account metadata in `localStorage` under `friink-auth-session`; the short-lived access token remains in memory and the refresh credential remains an HTTP-only cookie. Logout clears the stored metadata and the current in-memory session.
- **Edge cases:** `loadPersistedAuthSession()` intentionally ignores the local demo email `demo@friink.local` so the public landing page does not redirect for demo sessions. Planned multiple-account support may store safe summaries for more than one account, but must not store access/refresh tokens, token hashes, passwords, OTPs, internal UUIDs, or device secrets in browser-readable storage.
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
- **Edge cases:** Media-only posts are allowed when the payload contains confirmed post-media items, and media is limited to 8 items. The frontend's 256-character composer limit is stricter than the backend's 512-character API maximum.
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
- **Edge cases:** Profile links, reply/quote/like/share, Save, overflow, and the `Show more...` button keep their own click behavior and do not trigger card navigation.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/feed-post.tsx`, `web/app/globals.css`
- **Since:** 2026-08-30 (Asia/Karachi)

## Notifications

### Rule: In-App Notifications Are Fetchable And Readable
- **What:** Authenticated users can fetch a paginated notification feed, fetch an unread count, mark one notification read, or mark all their notifications read.
- **Edge cases:** Notification feed pages default to 20 items and clamp to a maximum of 100. The web app polls the unread count every 4 seconds through a transport boundary, pauses polling while hidden, resumes immediately on focus/visibility recovery, and refreshes the full list while the Notifications screen is open. Marking another user's notification read returns `404`.
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

### Rule: Profile Message Action Opens Direct Chat
- **What:** On another user's profile, the paper-plane Message action is an active button that navigates to the username-scoped `/{username}/chat` route. The self-profile variant continues to show Edit instead.
- **Edge cases:** The chat route and API enforce the mutual accepted-follow policy; navigation itself does not bypass authorization. The profile message action must not be rendered as a decorative or inert control.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/chat/chat-client.tsx`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Profile Connection State Resolves Before Actions
- **What:** When an other-user profile resolves, its Follow/Following/request action must resolve from the authenticated connection-status API rather than retaining the self-profile state from the initial loading render.
- **Edge cases:** While status is loading, the profile may temporarily show the neutral Follow action; failures fall back to the actionable neutral state. The self-profile continues to show Edit. The Message action still routes to chat, whose API enforces mutual accepted follows.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `web/components/app-shell.tsx`, `web/components/profile-screen.tsx`, `api/app/routers/connections.py`, `api/app/services/connections.py`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Incoming Requests Are Available In The Owner's Connections
- **What:** The signed-in account's Connections surface always exposes the Requests tab. Incoming pending follow requests are loaded from the authenticated API and render Accept and Reject actions; the client must not hide or reset the tab based on a cached privacy flag.
- **Edge cases:** Other users' Connections directories do not expose the owner's private request queue. Public accounts normally have no pending incoming requests because public follows are accepted immediately, but the Requests tab remains a valid empty state.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `web/components/app-shell.tsx`, `web/components/connections-screen.tsx`, `api/app/routers/connections.py`, `api/app/services/connections.py`
- **Since:** 2026-09-01 (Asia/Karachi)

### Rule: Floating Post Composer Expands Above Its Controls
- **What:** The floating post composer has no field background or border. Once typing begins, its text editor occupies the full-width top row and grows upward to eight lines; longer drafts scroll within the editor. Attachment, character count, and send controls remain in the bottom row.
- **Edge cases:** Empty composers retain the compact single-row layout. Chat composers are not changed by the post-composer expansion behavior. Profile pages do not render the floating composer.
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

### Rule: Chat Uses REST With Polling Delivery
- **What:** Chat uses authenticated REST endpoints for conversation discovery, conversation creation, message history, message sending, request acceptance, per-user settings, read-cursor updates, and the persisted read-receipt privacy preference. Mutual accepted follows enable immediate chat. A paid-tier user may initiate a non-mutual request with a maximum of eight requester-authored messages while pending; the receiver accepts by button or reply, and a reply automatically unlocks two-way chat. Active conversations and the `/chats` conversation list poll every 4 seconds through guarded transport/state loops; both pause while the document is hidden and resume immediately on focus/visibility recovery.
- **Edge cases:** Pending requests appear in Requests for both participants and move to All Chats only after acceptance. The receiver's pending composer says `Reply to accept.`; the requester is disabled after eight messages with `Request pending.`; free non-mutual users are disabled with a generic placeholder; blocked or no-longer-mutual accepted chats are read-only with `Chat unavailable.`. Message history is incremental and cursor-based, messages are deduplicated by server ID, server timestamps determine ordering, and sends include a client message ID. Mute suppresses chat notifications for that user while preserving the current tab; archive moves the chat to Archived and implies mute, with explicit mute surviving unarchive. The composer must not be disabled merely because transport or history loading failed. Subscription billing, profile hiding, and block controls remain future work; see `docs/chat-behavior.md`.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `api/app/models/chat.py`, `api/app/models/user.py`, `api/app/models/notification.py`, `api/app/routers/chat.py`, `api/app/services/chat.py`, `api/app/schemas/chat.py`, `api/alembic/versions/20260902_0016_add_chat_requests_and_settings.py`, `web/lib/auth.ts`, `web/lib/chat-transport.ts`, `web/app/[username]/chat/chat-client.tsx`, `web/components/screens.tsx`
- **Since:** 2026-09-01T16:00:00Z

### Rule: Chat Read Receipts Use Per-User Cursors
- **What:** Chat exposes sent, delivered, and read states. A visible app-level inbox sync or the full conversation endpoint records delivery; the visible conversation advances the viewer's read cursor through an idempotent endpoint. Polling returns receipt metadata even without new messages, so tick state can change on the existing 4-second cycle.
- **Edge cases:** Unread counts include only incoming messages and appear as row pills plus an in-conversation unread separator. Pending requests use the same receipt rules without treating read as acceptance. A visible inbox sync marks discovered incoming messages delivered, but only viewport visibility/scroll advances read state. Mute and archive do not change receipt state. Blocked conversations do not advance or expose delivery/read receipts while the block is active. Read receipts use mutual privacy: both users must have the preference enabled. The preference is persisted and editable in Settings > Privacy. Chat messages are limited to 2,048 Unicode characters.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `api/app/models/chat.py`, `api/app/models/user.py`, `api/app/routers/chat.py`, `api/app/services/chat.py`, `api/app/schemas/chat.py`, `api/alembic/versions/20260902_0017_add_chat_read_receipts.py`, `web/lib/auth.ts`, `web/lib/chat-transport.ts`, `web/app/[username]/chat/chat-client.tsx`, `web/components/screens.tsx`, `web/app/globals.css`, `docs/read-receipts.md`
- **Since:** 2026-09-02 (UTC)

### Rule: Chat List Refreshes Through Visibility-Aware Polling
- **What:** The `/chats` conversation-list screen refreshes `GET /chat/conversations` every 4 seconds while visible. Each response refreshes previews, latest-activity ordering, unread counts, unread styling, and the row state for the currently selected All, Muted, Requests, or Archived tab.
- **Edge cases:** Polling pauses without requests or timer rescheduling while the document is hidden, resumes immediately on visibility or focus recovery, prevents overlapping requests, and cleans up its timer and listeners on unmount. The server remains authoritative for filtering and unread counts; no database migration or separate unread-count endpoint is required.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/screens.tsx`, `web/lib/auth.ts`, `docs/chat-behavior.md`
- **Since:** 2026-09-02 (UTC)

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

### Rule: Current Web And API Runtime Baseline
- **What:** The web runtime baseline is Next.js 16.3.4 with React 19.3.0 and asynchronous App Router `params`/`searchParams`. The currently installed API baseline is FastAPI 0.141.1 with Uvicorn; `api/requirements.txt` remains intentionally unpinned.
- **Compatibility:** Local Windows development may use Next's `--webpack` fallback when the native SWC binding is unavailable. This is a tooling accommodation and does not change the production deployment contract.
- **Status:** Active implementation baseline; staging acceptance remains the release gate.
- **Platform:** Web/API
- **File(s):** `package.json`, `web/package.json`, `web/tsconfig.json`, `api/requirements.txt`
- **Since:** 2026-09-09T20:55:02Z

### Rule: Staging And Production Use Separate Databases
- **What:** `api-staging` uses the existing staging Neon database and `api-production` uses its separate production Neon database. The production database is currently hosted temporarily on Neon and is planned to move to the Droplet later. The web projects do not receive `DATABASE_URL`; they receive only their environment-specific `NEXT_PUBLIC_API_BASE_URL`.
- **Do not:** Treat rows, object keys, sessions, or media URLs from one deployed environment as available in the other environment. Do not add a media bucket/environment identifier column as a workaround for the old shared-database topology.
- **Deployment:** Apply the full Alembic chain to a new production database before deploying production API code. A fresh production database must reach the repository head and pass `alembic check`; staging migrations and data remain independent.

### Rule: Media Storage Follows The API Environment
- **What:** Avatar and post-media upload services use the active API environment's `R2_BUCKET_NAME`; public delivery uses its configured `R2_PUBLIC_URL`. Staging uses `friink-staging`; production uses `friink-prod-media` with `https://media.friink.com`.
- **Edge cases:** Media rows are safe across environments because the databases are separate. New profile-picture records store an object key, while existing post-media records retain their key and URL fields. No bucket/environment column is required while database isolation is maintained.

### Rule: FastAPI Uses Sync SQLAlchemy Sessions
- **What:** The backend uses FastAPI with synchronous SQLAlchemy sessions and psycopg3 database URLs. Alembic migrations define the database schema.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/db.py`, `api/alembic/env.py`, `api/requirements.txt`, `api/api/index.py`
- **Since:** 2026-08-27T00:00:00Z


### Rule: Deployment-Neutral Database Connection Management
- **What:** Database connection management must remain portable across Neon and the planned Ubuntu deployment. Pool behavior is configured by environment, not by platform-specific application branches. The default is a small SQLAlchemy pool (3 base connections plus 2 overflow connections, with pre-ping, LIFO reuse, recycling, and a bounded checkout timeout); pooling can be disabled explicitly when a runtime requires short-lived connections.
- **Edge cases:** Neon Free has scale-to-zero and connection limits, so a small pool must not be treated as a promise to keep the database warm. Ubuntu values may be increased only after accounting for API worker count and PostgreSQL `max_connections`; total connections across workers and processes are the controlling limit. The local post-pooling sample improved switch completion to approximately 1.0–1.7 seconds, but account-list refresh still reached approximately 12 seconds; continue treating refresh latency as a separate investigation.
- **Status:** Active; default implementation deployed to development and staging for validation.
- **Platform:** API/infrastructure
- **File(s):** `api/app/db.py`, `api/app/config.py`, `api/.env.example`, `README.md`, `docs/auth-and-session.md`
- **Since:** 2026-09-10T01:00:00Z

### Rule: CORS Allows Configured Frontend And Local Development
- **What:** The API allows CORS from `FRONTEND_URL`, `http://localhost:3000`, `http://127.0.0.1:3000`, and explicitly `https://staging.friink.com`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`, `api/app/config.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Development Uses An Isolated Database And Branch Flow
- **What:** The `development` branch is the local implementation and rehearsal
  branch below `staging`; `staging` is the deployed acceptance environment and
  `main` is the production release branch. A local `api/.env.development` may
  reuse the variable names from `api/.env.staging`, but its `DATABASE_URL` must
  point to an isolated development database.
- **Do not:** Commit `.env.development`, `.env.staging`, or secrets. Do not use
  a development rehearsal to edit staging or production authentication rows,
  and do not fetch or force-rewrite a branch when that would discard local
  progress.
- **Migration:** Bring a fresh development database to the Alembic head and
  run `alembic check` before auth/session rehearsals. The committed
  `api/.env.example` remains the non-secret variable template; environment
  files provide deployment-specific values and are not interchangeable with
  the template.
- **Status:** Active
- **Platform:** All
- **File(s):** `README.md`, `api/.env.example`, `api/alembic/`
- **Since:** 2026-09-08T22:33:11Z

### Rule: Database Health Endpoint Checks Connectivity Only
- **What:** `GET /health/db` opens a psycopg connection and runs `SELECT 1`, returning `{"database": true}` on success.
- **Edge cases:** This endpoint does not verify ORM schema compatibility; ORM-backed endpoint checks are still needed after migrations.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`
- **Since:** 2026-08-27T00:00:00Z

### Rule: Account Lifecycle Uses Owner-Verified State Transitions
- **What:** Accounts may be `active`, `deactivated`, `pending_deletion`, or `deleted`. Deactivation requires current-password confirmation only; deletion requires current-password confirmation plus OTP. Reactivation requires valid credentials plus fresh OTP and creates only one new session; prior sessions and remembered device credentials are not restored. The product UI is owner-only, while staff retain protected backend recovery capability.
- **Edge cases:** Deactivation revokes all sessions and refresh families and immediately rejects access for the inactive account. It preserves readable, read-only chats and renders retained identity as `Friink User` with the real username and default avatar. Deletion is cancellable for 32 days, including the final hour before the deletion transaction, then removes public/user-generated content while retaining restricted UUID tombstones, identity history, required billing/security records, and chats as `Account Deleted`.
- **Billing:** The contract requires deactivation not to pause/cancel subscriptions and deletion to cancel billing immediately; the billing-provider adapter is not yet wired, so this behavior must not be represented as verified until that integration is delivered. Reactivation must not resume a cancelled subscription.
- **Cooldown:** After reactivation, the same account cannot be deactivated again for 8 minutes (480 seconds). A blocked attempt returns `429`, and the web UI surfaces the server-provided remaining time in a live countdown toast.
- **Security:** Inactive-account failed logins never send email and use only minimal restricted internal events. Unknown identifiers and wrong passwords remain lifecycle-state agnostic.
- **Status:** Active runtime slice; full contract gates remain open for warning-link delivery, billing-provider integration, exhaustive transition concurrency/idempotency, abuse controls, and fully audited staff overrides.
- **Platform:** All
- **File(s):** `docs/account-lifecycle.md`, `docs/auth-and-session.md`
- **Since:** 2026-09-05T22:32:26Z

### Rule: Resend Uses One Verified Domain With Centralized Sender Aliases
- **What:** The API configures one verified `RESEND_FROM_DOMAIN` and generates sender addresses centrally by message purpose: `noreply` for OTP, `hello` for welcome messages, and `security` for security messages. `RESEND_API_KEY` remains server-side only.
- **Edge cases:** The domain must be verified in Resend, sender aliases must not be repeated across environment variables or email methods, and the full sender address must never be supplied by the frontend. Staging and production configure their own provider credentials and verified sender domain.
- **Status:** Active
- **Platform:** API
- **File(s):** `api/app/config.py`, `api/app/services/email.py`, `api/.env.example`
- **Since:** 2026-09-06T23:30:00Z
- ### Rule: Blocking Is Bilateral And Irreversible For Relationships
- **What:** Blocking removes accepted and pending follow relationships in both directions transactionally. Unblocking never restores them. Both users lose profile access and message sending, while existing chats remain readable and read-only.
- **Status:** Active
- **Platform:** Web/API
- **File(s):** `docs/blocking.md`, `api/app/services/blocking.py`, `api/app/routers/users.py`, `api/app/services/chat.py`

### Rule: OTP And Approval Paths Are Mutually Exclusive In The UI
- **What:** The login screen may offer emailed OTP and existing-session approval for the same challenge, but once OTP entry begins, approval-status polling must stop. A late approval status cannot overwrite OTP validation, submission, or successful navigation.
- **Edge cases:** Editing the OTP clears stale approval messaging. Polling must not run during OTP submission. The backend remains authoritative for whether the submitted OTP is valid or expired.
- **Status:** Active
- **Platform:** Web
- **File(s):** `web/components/login-screen.tsx`, `docs/auth-and-session.md`

### Rule: Login Challenge Completion Is Server-Authoritative
- **What:** OTP verification, existing-session approval, and denial compete on one login challenge. The API serializes transitions, preserves the first terminal outcome, and reports `otp_verified` when OTP consumed the challenge without approval winning.
- **Edge cases:** A delayed status response must not turn a completed OTP challenge into `expired`; the frontend may defensively ignore stale responses, but correctness belongs to the API. Completion remains single-use and must preserve add-account/device-slot behavior.
- **Status:** Active
- **Platform:** API/Web
- **File(s):** `api/app/services/login_challenges.py`, `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`

### Rule: Do Not Overstate OTP Concurrency Verification
- **What:** A successful single-browser OTP redirect verifies the normal challenge flow only. It is not evidence that concurrent OTP, approval, or duplicate completion requests were serialized correctly.
- **Edge cases:** Documentation and release notes must distinguish normal-flow staging evidence from direct API status assertions and backend concurrency tests. The concurrency gate remains open until those tests exist and pass.
- **Status:** Active
- **Platform:** API/Web
- **File(s):** `docs/auth-and-session.md`, `docs/latency.md`, `api/tests/`
