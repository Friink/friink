# Friink Rules

This file is Friink's complete, current, implementation-backed rulebook. It
contains only behavior and implementation contracts that are active today.
Planning, open questions, limitations, and future work remain in the individual
unit documents.

The former root [RULES.md](archives/RULES.md) is retained as a historical reference. This
document is the current source of truth and includes stable rule IDs, effective
dates, platform scope, exact implementation files, related units, and source
links. Detailed UX, technical contracts, and verification remain in the unit
documents.

**Last edited:** 2026-09-26T12:53:21Z
**Rule policy:** Active rules describe behavior currently enforced by the product or an explicitly active implementation contract. Deferred, superseded, or retired decisions belong in [Rule history](#rule-history).

## How to read this file

Each rule has a stable ID. Unit documents may reference these IDs instead of
copying the rule. Every rule records its `Platform` and `File(s)` fields so the
current implementation boundary is visible here. If implementation conflicts
with an active rule, record the conflict in [migration history](archives/migration.md)
and do not silently change either side. A rule is not added to the active
section until its implementation is present and verified.

Five historical rules did not identify their platform, implementation files, or
effective date. Their fields are explicitly marked as not recorded rather than
invented; those entries require a future implementation audit before the
missing evidence can be filled in.

## Web Architecture

### WEB-R-001 — Account Switcher Uses Device-Scoped Slots

- **Status:** Active
- **Effective:** 2026-09-26T12:53:21Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `api/app/services/account_slots.py`, `web/lib/auth.ts`, `web/components/side-drawer.tsx`, `web/components/app-shell-route.tsx`

- **What:** Remembered accounts are server-side slots bound to one device cookie. The default maximum is 4 accounts, configurable from 1 through 16 with `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`; lowering the value does not silently revoke existing slots.
- **Edge cases:** Add-account reuses an existing valid slot, refuses additions at the limit, and preserves the current account on failed authentication, list, or switch requests. When `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` is `1`, the API reports the switcher disabled and the web app hides its add/switch menu. This does not block ordinary sign-in or silently revoke existing slots; a normal login at capacity may remain un-slotted. With a larger limit, opening the selector shows the cached device-scoped list immediately, or the current account as a safe fallback when no cache exists, while one deduplicated async refresh runs; add, switch, and logout operations must refresh the list immediately afterward. A failed refresh leaves the cached/current account usable and exposes a subtle retry action. Active logout revokes only the matching account slot and falls back to the most-recent remaining slot, or the public site when none remain.

### WEB-R-002 — OTP Flags Are API-Owned Runtime Configuration

- **Status:** Active
- **Effective:** 2026-09-07T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API/Web
- **File(s):** `api/app/config.py`, `api/app/routers/auth.py`, `api/app/services/auth_debug.py`

- **What:** `OTP_ENABLED` is the API-owned master switch and defaults to `true`. When enabled, `SIGNUP_OTP_ENABLED` controls signup verification and `LOGIN_RISK_OTP_ENABLED` controls risk-based normal-login OTP. When `OTP_ENABLED=false`, all OTP challenges are bypassed, including signup, risk-based login, lifecycle reactivation/deletion, and email-change verification. The master switch must be read from the FastAPI deployment environment and verified after redeployment; changing only the web project is insufficient.
- **Edge cases:** The master switch is intended for local/test/staging use and must remain enabled in production; production API startup rejects `OTP_ENABLED=false`. An absent variable uses the secure default (`true`); an empty value is not a valid substitute for omission. A disabled flow must not produce its corresponding prompt. Diagnostics may report effective flag values and the deployment identifier, but never secrets, tokens, OTPs, cookies, hashes, or internal identifiers.

### WEB-R-003 — Post Media Uploads Are Submit-Time And Image-Only

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [posts](units/posts.md), [media](units/media.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `web/components/composer.tsx`, `web/components/app-shell.tsx`, `web/components/post-media-gallery.tsx`, `web/lib/auth.ts`, `web/lib/data.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/app/globals.css`, `api/app/routers/posts.py`, `api/app/services/posts.py`, `api/app/services/storage.py`, `api/app/models/post.py`

- **What:** A post may include up to 8 JPEG images. The composer keeps selected files local until the user submits, allows the user to reorder the selected attachments before submission, and submits files in the visible order. Clicking a thumbnail opens the 3:5 crop tool directly; Reset restores the crop view, Apply saves the crop, and previous/next arrows switch among attached images. The browser prepares JPEG files and the API validates the authenticated user's ownership and post-media key contract before associating confirmed uploads with the user's new post.
- **Edge cases:** The shared post-media preparation targets a 1024px maximum longest edge and approximately 500KB per image. While the post/media request is running, the Post button is disabled and shows the posting spinner; failed submissions preserve the draft and attachments for retry, while successful submissions clear them. Failed submissions must clean up uploaded objects and must not leave a half-created post. Post deletion removes associated post-media objects before marking the post deleted. Uploads use one-at-a-time browser preparation, presigned R2 `PUT`, confirmation, and final post association; confirmation validates the authenticated user's key ownership and namespace but does not use public `HEAD`/`GET` or S3 `HeadObject` to verify stored MIME type or byte length. Successfully associated media is returned as URL items and rendered through the shared gallery: multiple images remain available in the horizontal slider with a common nominal height (`24rem` desktop, `15rem` compact screens), a default 3:4 frame, an 8px gap, and 8px rounded image frames; a single image preserves its natural aspect ratio within the available content width and responsive maximum height without a trailing gallery background. The crop tool remains 3:5. Final crop width, height, and aspect ratio are not persisted in media rows. Freeform crop bounds and first-image carousel-ratio locking are not implemented. The shared modal backdrop is above application overlays so crop controls remain interactive.

### WEB-R-004 — Web UI Fixes Must Be Component-Level

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/*`, `web/app/globals.css`, `packages/design/design.md`, `README.md`

- **What:** Reusable web UI behavior, layout, spacing, and interaction fixes must be implemented in shared components, shared CSS contracts, or shell-level state owners rather than inline styles, route-only patches, or one-off page wrappers.
- **Edge cases:** A route may be added to expose a feature URL, such as `/search/[query]`, but the route should delegate visible layout and behavior to shared shell/screen/row primitives. Logged-in app page-specific CSS, CSS Modules, route-only stylesheets, inline CSS, and TSX visual design are not allowed. The public landing stylesheet remains a separate public-site concern.

### WEB-R-005 — Tablet And Desktop Content Use A 720px Shared Cap

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/content-box.tsx`, `web/app/globals.css`, `web/theme.config.ts`, `packages/design/design.md`

- **What:** The visible shared `ContentBox` and contextual `FloatingBar` surfaces cap at `720px` on tablet and desktop and center within the available main panel after accounting for the side drawer. The shared horizontal gutter is applied outside that visible cap (`16px` desktop, `8px` mobile); on smaller mobile screens both surfaces remain fluid within the gutter.
- **Edge cases:** Screen-level wrappers must not introduce competing max-widths or duplicate outer gutters. List surfaces must use a shrinkable grid track so media min-content width cannot expand beyond `ContentBox`. The floating bar rail must use the same available main-panel area as `ContentBox`: full viewport width on mobile, and from the desktop sidebar edge to the viewport edge on tablet and desktop. The bar itself retains the shared `720px` cap and flex/margin-auto centering.

### WEB-R-006 — In-App Accent Color Is Device-Local

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [account-access](units/account-access.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`, `web/components/app-shell.tsx`, `web/app/globals.css`

- **What:** Signed-in users may set a six-digit hex accent color from Settings > General. It overrides the app shell's brand token for the current device only; public/landing surfaces are not affected.
- **Edge cases:** Invalid hex values cannot be saved. The default `#33aa55` is used when no valid local preference exists or local storage is unavailable.

### WEB-R-007 — Theme Preference Applies Before Session Restore

- **Status:** Active
- **Effective:** 2026-09-11T00:00:00Z
- **Related units:** [account-access](units/account-access.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell-route.tsx`, `web/components/app-shell.tsx`, `web/app/globals.css`, `web/app/landing.module.css`

- **What:** The web app defaults to the system color scheme. A valid `friink_appearance` cookie with `light`, `dark`, or `system` is the device-local override, and the same preference applies to the authenticated shell and standalone authentication/lifecycle recovery screens.
- **Edge cases:** Missing or invalid cookie values resolve to `system`. A session-recovery screen must not fall back to light when the system is dark or when the explicit preference is dark. Public marketing surfaces continue to follow the system palette and do not apply the authenticated app override.

### WEB-R-008 — Route-Based Navigation Uses Real Links

- **Status:** Active
- **Effective:** 2026-08-31T00:00:00Z
- **Related units:** [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/side-drawer.tsx`, `web/components/app-shell.tsx`, `web/components/header.tsx`, `web/app/directory/page.tsx`

- **What:** Navigation controls that have a stable destination must render as anchors with an `href`, including the signed-in drawer routes. Client-side click handling may intercept normal clicks, but the destination must remain available to browser status previews, middle-click, and open-in-new-tab behavior.
- **Edge cases:** The shared drawer order places Directory immediately after Saved and its canonical destination is `/directory`.

### WEB-R-009 — Profile Header Summary Uses ContentBox Spacing

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [profiles](units/profiles.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/profile-client.tsx`, `web/app/globals.css`, `packages/design/design.md`

- **What:** Web profile pages render profile identity, about text, follower/following stats, and edit/message/follow actions through the shared `ProfileScreen` inside `ContentBox`. These elements are grouped in the component-level profile summary section, not patched with route-specific spacing.
- **Edge cases:** Profile posts are loaded from the viewed user's author-scoped post feed rather than from the global Explore page, and remain subject to the same visibility rules. Profile stats are API-backed, remain inline and left-aligned, and each complete number-and-label statistic is an ununderlined link. Self-profile links use `/connections?tab=...`; another profile uses `/{username}/connections?tab=...`. Edit/message/follow actions move to a dedicated left-aligned row below them on all viewports. The dynamic `/{username}` route must continue delegating to shared `AppShell` and `ProfileScreen`.

### WEB-R-010 — Unknown Profile Routes Show Unavailable State

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [profiles](units/profiles.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/[username]/profile-client.tsx`, `web/app/globals.css`, `packages/design/design.md`

- **What:** A username route that does not resolve to a public user must render `Does not exist or unavailable.` and must not create or display a synthetic/demo profile.
- **Edge cases:** The signed-in user's own username continues to render the self-profile, and a real public user continues to render the browsable profile. While a non-own profile lookup is pending, the route shows `Loading profile...` and must not fall back to the signed-in user's profile. Stale results from an earlier username lookup must be ignored.

### WEB-R-011 — Contextual Header Lists Use Shared Dropdown

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/contextual-dropdown.tsx`, `web/components/header.tsx`, `web/app/globals.css`, `packages/design/design.md`

- **What:** Floating Search and Notifications lists must use the shared `ContextualDropdown` shell for their container, list spacing, footer treatment, and empty state. The shared empty state displays `Nothing to show.` with centered whitespace; list-specific row content and footer actions may remain specialized.
- **Edge cases:** Search may show fewer than four query-specific suggestions, Notifications may show fewer than four recent items, and zero unread notifications must hide the count pill while retaining the All Notifications action.

### WEB-R-012 — Header Chat Link Reflects Conversation Unread State

- **Status:** Active
- **Effective:** 2026-09-03T17:20:29Z
- **Related units:** [chat](units/chat.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/header.tsx`, `web/components/app-shell.tsx`, `web/components/side-drawer.tsx`, `web/lib/data.ts`, `web/app/chats/page.tsx`, `web/app/globals.css`

- **What:** The global signed-in Header owns the Chat link between Search and Notifications. It routes to `/chats` and shows a small accent dot whenever the authenticated conversation list contains one or more unread messages. Chat is not duplicated in the SideDrawer.
- **Edge cases:** The unread state is server-authoritative, uses the existing visibility-aware four-second conversation polling loop, pauses while the document is hidden, and resumes on focus or visibility recovery. A failed refresh does not invent a new unread state. The legacy `/chat` root remains a compatibility redirect to `/chats`; username-scoped conversation routes remain `/{username}/chat`.

### WEB-R-013 — Public Post URLs Use Public IDs

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [posts](units/posts.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/post.py`, `api/app/services/post_slug.py`, `api/app/routers/posts.py`, `api/alembic/versions/20260830_0009_add_public_id_to_posts.py`, `web/lib/post-path.ts`

- **What:** Post detail URLs use the author username, an on-the-fly slug from the first eight content words capped at 64 characters, and an 8-character random mixed-case alphanumeric `public_id`. Empty slugs omit the slug text.
- **Edge cases:** The username and slug are cosmetic; the trailing `public_id` is authoritative for lookup. The UUID primary key and all UUID foreign-key relationships remain unchanged. Existing rows receive IDs through the Alembic backfill migration.

### WEB-R-019 — Functional TopBar Preview Preserves Existing Navigation

- **Status:** Active preview
- **Effective:** 2026-09-16T20:37:01Z
- **Related units:** [feed](units/feed.md), [profiles](units/profiles.md), [settings](units/settings.md), [staff-admin](units/staff-admin.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/top-bar.tsx`, `web/components/app-shell.tsx`, `web/app/globals.css`

- **What:** The signed-in app renders a functional shared `TopBar` preview on the side-drawer surface. Desktop uses the theme-aware full Friink logo linked to Home, a centered current title, and Home sidebar toggle/Search/Chat/Notifications or contextual history-aware Back and the existing `ActionMenu`. Mobile Home shows the full logo without a title; other regular screens show the title beside Back and align actions to the right. The search route retains its Back/search/actions layout. TopBar control glyphs are 24px inside 40px hit areas and use the neutral gray from the active drawer item for hover and keyboard-focus backgrounds while retaining accent-colored icons. Chat and Notifications display actual unread counts in top-right pills, showing 1–9 and then `9+`; pills are 16px high, use 12px text, and have a 1px surface-colored border. The search-filter active indicator remains a dot.
- **Edge cases:** The preview overlays the existing Header and NavigationBar; neither existing component is removed or replaced. Tabs remain unchanged, and all preview actions preserve the established destinations and semantics until the prototype is accepted.

### WEB-R-020 — Post Details Use A Contextual Shell State

- **Status:** Active
- **Effective:** 2026-09-22T23:29:46Z
- **Related units:** [navigation](units/navigation.md), [posts](units/posts.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/lib/data.ts`, `web/app/posts/[postId]/post-client.tsx`, `web/app/[username]/[postId]/post-client.tsx`

- **What:** Authenticated post-detail routes use the contextual `Post` shell screen. The header shows `Post`, and no drawer destination is active while the detail is open.
- **Edge cases:** The route remains history-aware through the shared Back control; opening or returning to Home restores the Home title and drawer highlight.

### WEB-R-021 — Owners Delete Posts From The Post Options Menu

- **Status:** Active
- **Effective:** 2026-09-23T00:52:12Z
- **Related units:** [posts](units/posts.md), [feed](units/feed.md)
- **Source:** Current implementation
- **Platform:** Web/API
- **File(s):** `api/app/routers/posts.py`, `api/app/services/posts.py`, `web/lib/auth.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/components/profile-screen.tsx`, `web/components/saved-screen.tsx`, `web/components/post-detail-screen.tsx`

- **What:** The post options menu exposes `Delete post` only when the authenticated viewer owns the post. The action confirms intent, calls `DELETE /posts/{post_id}`, and removes the deleted post from active feed lists.
- **Edge cases:** The API remains authoritative and rejects deletion of another user's post. Successful deletion soft-deletes the post and removes its associated media before the web shows a success toast; post-detail deletion returns to the previous route.

### WEB-R-022 — Collapsed Drawer Temporarily Expands On Hover

- **Status:** Active
- **Effective:** 2026-09-24T20:20:36Z
- **Related units:** [navigation](units/navigation.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/side-drawer.tsx`, `web/app/globals.css`

- **What:** At viewport widths of 768px and above, a non-touch pointer over the collapsed drawer temporarily reveals its expanded layout. The expanded drawer overlays the page while the page and top bar retain the collapsed layout width.
- **Edge cases:** Pointer exit restores ribbon width without changing the persisted hamburger state. Touch pointers and mobile widths do not trigger hover expansion; the hamburger continues to toggle the persistent drawer state.

### WEB-R-023 — Drawer Starts Collapsed Without A Saved Preference

- **Status:** Active
- **Effective:** 2026-09-24T20:29:07Z
- **Related units:** [navigation](units/navigation.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`

- **What:** The drawer's first render is collapsed when no saved desktop preference is available. A saved expanded preference is applied after the browser cookie is read.
- **Edge cases:** Mobile starts collapsed regardless of the saved preference. A saved collapsed preference remains collapsed on desktop and tablet.

### WEB-R-024 — Desktop Drawer Hides Its Scrollbar Indicator

- **Status:** Active
- **Effective:** 2026-09-24T20:34:23Z
- **Related units:** [navigation](units/navigation.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/app/globals.css`

- **What:** At tablet and desktop widths, the drawer retains native vertical scrolling while its scrollbar indicator is hidden.
- **Edge cases:** Hiding the indicator does not disable scrolling; mobile drawer scrollbar styling is unchanged.

### WEB-R-014 — Quoted Posts Link To Their Original

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `api/app/schemas/posts.py`, `api/app/services/posts.py`, `web/lib/auth.ts`, `web/lib/data.ts`, `web/components/feed-post.tsx`, `web/components/home-screen.tsx`, `web/components/app-shell.tsx`

- **What:** A quoted-post block in a feed or post card links to the original post's canonical detail URL when that original is available. The parent quote post remains navigable through its surrounding non-interactive card area.
- **Edge cases:** Profile-card clicks continue to open the author's profile. Deleted, private, or otherwise unavailable originals render a non-clickable `Original post unavailable`/`Content not available` block because there is not enough visible identity data to construct a safe canonical URL.

### WEB-R-015 — Post Likes And Saves Are Durable, Unique Reactions

- **Status:** Active
- **Effective:** 2026-09-03T20:02:30Z
- **Related units:** [posts](units/posts.md), [saved-items](units/saved-items.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/post.py`, `api/app/models/user.py`, `api/app/services/reactions.py`, `api/app/routers/posts.py`, `api/app/routers/users.py`, `api/app/services/posts.py`, `web/components/feed-post.tsx`, `web/components/post-likes-modal.tsx`, `web/components/profile-screen.tsx`, `web/components/saved-screen.tsx`, `web/components/account-screens.tsx`, `docs/archives/like-and-star.md`

- **What:** Signed-in users may Like/Unlike and Save/Unsave visible posts, replies, and quotes. Each user can have at most one Like and one Save per content object at a time. Like and Save counts are public aggregates for that content object; viewer-specific active state is returned only to an authenticated viewer.
- **Edge cases:** Database unique constraints and a post row lock make retries and concurrent toggles idempotent. Self-Likes do not notify the owner. A confirmed Like by another user creates one in-app owner notification; Unlike and all Save operations are silent. Deleted, private, blocked, or otherwise inaccessible content cannot be reacted to and is omitted from the user's Liked/Saved lists. Direct unavailable post URLs render the neutral unavailable state.
- **Privacy:** `likes_visible` defaults to true and is managed under Settings > Privacy. When disabled, the user's Like identity is omitted from actor lists and their Likes tab is hidden from other signed-in users, while counts and the user's own view remain intact. Saves have no actor list and are not controlled by this setting.

### WEB-R-016 — Saved Surfaces Use Stable Post And Profile Routes

- **Status:** Active
- **Effective:** 2026-09-06T00:00:00Z
- **Related units:** [profiles](units/profiles.md), [posts](units/posts.md), [saved-items](units/saved-items.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/saved/page.tsx`, `web/app/saved/posts/page.tsx`, `web/app/saved/profiles/page.tsx`, `web/app/starred/page.tsx`, `web/components/saved-screen.tsx`, `web/components/feed-post.tsx`, `web/components/app-shell.tsx`, `web/components/side-drawer.tsx`

- **What:** The signed-in Saved area uses `/saved/posts` for the user's private saved-post feed and `/saved/profiles` for private saved profiles. `/saved` and legacy `/starred` redirect to `/saved/posts`. Profile saves are created from another user's profile action menu with a star-icon Save profile action and removed through the resulting Remove from saved action.
- **Edge cases:** Deactivated or pending-deletion profiles remain as removable unavailable rows without links or profile details; reactivation restores the saved row's details, while permanent account deletion removes the relationship through the database cascade.
- **Interaction:** Each post has one Save/Unsave control: the star in the lower counted action row. The redundant header star is not rendered. The adjacent Save count is display-only because Save actors are private.

### WEB-R-017 — Sidebar Highlight Tracks Only Owned Profile Navigation

- **Status:** Active
- **Effective:** 2026-09-18T21:26:00Z
- **Related units:** [navigation](units/navigation.md), [profiles](units/profiles.md)
- **Source:** [Design implementation contract](../packages/design/design.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/side-drawer.tsx`, `web/app/[username]/profile-client.tsx`, `web/app/globals.css`

- **What:** The signed-in drawer highlights the Profile destination only while viewing the signed-in user's own profile. The Profile identity row does not receive the standard active-destination gray background. Home and Profile must not be shown as active while browsing another user's profile route.
- **Edge cases:** The other-user profile remains fully navigable and may expose its own contextual actions, but it does not inherit the Home highlight from the route used to reach it. The active drawer state is derived from the current shell screen, not from the previous page.

### WEB-R-018 — Search Refinements Are URL-Backed And Scope-Aware

- **Status:** Active
- **Effective:** 2026-09-21T00:00:00Z
- **Related units:** [search](units/search.md), [navigation](units/navigation.md)
- **Source:** [search unit](units/search.md), [design system](design-system.md)
- **Platform:** Web/API
- **File(s):** `web/components/top-bar.tsx`, `web/components/app-shell.tsx`, `web/components/screens.tsx`, `web/lib/auth.ts`, `api/app/routers/search.py`, `web/app/globals.css`

- **What:** The search route places a funnel control between the query field and contextual ActionMenu. It opens one shared sort/filter modal. Sort state is URL-backed and supports Most relevant, Newest, and Oldest; People remains relevance-only. Date state is URL-backed and supports Any time, preset ranges, and inclusive custom bounds for Posts and Messages. Applying a refinement reloads results and the funnel shows an accent indicator when a non-default refinement is active.
- **Edge cases:** Date controls are hidden for People and ignored outside supported result types. Custom ranges require both bounds and reject a start date later than the end date. Reset returns to Most relevant and Any time. Search authorization and visibility remain server-authoritative.

## Authentication & Accounts

### AUTH-R-001 — Staff Discovery Is Separate From Ordinary User Features

- **Status:** Active
- **Effective:** 2026-09-08T00:00:00Z
- **Related units:** [staff-admin](units/staff-admin.md), [discovery](units/discovery.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/user.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/side-drawer.tsx`, `api/scripts/bootstrap_admin.py`

- **What:** `users.is_staff` defaults to false. Authenticated user responses may expose it so the web shell can show the Control panel entry only to staff users. It does not authorize sensitive control-panel actions.
- **Edge cases:** Ordinary users have no staff access. The initial `admin@friink.com` / `@admin` account is created through controlled password-safe tooling, never a migration or committed secret.

### AUTH-R-002 — Staff Access Uses Roles And Additive Direct Grants

- **Status:** Active
- **Effective:** 2026-09-08T00:00:00Z
- **Related units:** [staff-admin](units/staff-admin.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `docs/archives/auth-and-session.md`, `packages/design/design.md`, `web/components/side-drawer.tsx`, `web/components/control-panel-screen.tsx`, `web/components/modal.tsx`

- **What:** Staff users may hold multiple roles. Effective control-panel access is the union of permissions from all assigned roles plus additive per-user grants. The only initially seeded role is `superadmin`; additional roles are created when needed.
- **Edge cases:** A user with `is_staff = true` but no roles sees the Control panel entry and a no-access empty state. The panel uses one drawer entry with `Overview`, `Staff`, `Users`, `Security & Sessions`, `Audit Log`, and `Public site` tabs. `Users` is the only functional section in the current rollout; the other sections are explicit placeholders. Tabs and actions are shown only when the current effective permission allows them. Missing or expired privileged access opens the shared staff-verification modal; closing it returns to the prior screen while the ordinary Friink session stays active. Turning `is_staff` off removes staff access immediately and revokes privileged staff sessions; ordinary Friink access is unaffected. Permission definitions, role ownership, and role-to-permission assignments are database-backed and must not be hardcoded in application logic. Superadmin effective permissions are resolved dynamically from the database permission catalog.

### AUTH-R-003 — Authentication Incident Operations Are Protected And Idempotent

- **Status:** Active
- **Effective:** 2026-09-12T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API/operations
- **File(s):** `api/app/routers/auth_operations.py`, `api/app/services/session_service.py`, `api/app/services/staff.py`, `api/app/services/security_events.py`, `docs/archives/auth-incident-response.md`

- **What:** Authorized authentication-incident operators use the protected internal auth-operations path with the dedicated `AUTH_OPERATIONS_INTERNAL_TOKEN`; authentication rows are not edited manually. Operations require explicit confirmation, a unique `Idempotency-Key`, a recorded reason, operator/scope/result evidence, and the smallest safe applicable scope.
- **Edge cases:** Retrying an operation with the same idempotency key returns the original result. Per-user revocation invalidates refresh sessions, recognized devices, and issued access tokens through the security epoch. Compromised staff accounts additionally lose staff access, account access is locked, privileged sessions are revoked, and the operation does not depend on the compromised administrator's session. Platform-wide revocation is reserved for confirmed platform-level incidents. The implementation records the operation's target, scope, reason, and result, but does not record a human operator identity. Secrets, passwords, OTPs, raw tokens, JWT secrets, private IP data, and other sensitive authentication material must never be placed in logs, tickets, or operator messages.

### AUTH-R-004 — Password Recovery Uses Email Reset Links

- **Status:** Active
- **Effective:** 2026-09-08T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `docs/archives/forget-password.md`, `api/app/services/password_reset.py`, `api/app/routers/auth.py`, `web/app/reset-password/page.tsx`

- **What:** Password recovery accepts an account email, sends a single-use reset link with a 30-minute expiry, stores only a token hash, and revokes refresh-token families after successful reset. Usernames alone cannot authorize recovery.
- **Edge cases:** Existing and non-existing emails receive the same generic response; no reset token is returned by the API. Ordinary user-requested recovery may reuse the current password. A reset link issued for suspicious failed-login activity must use a password different from the current password; this is enforced server-side from the durable token purpose. Authenticated password changes must also differ from the current password. A newer reset request invalidates older unused reset links. After the reset token is committed, the API directly attempts email delivery and swallows delivery failures so the neutral response remains unchanged; this is not a durable reset-email outbox. Successful reset revokes active privileged Control Panel sessions as well as ordinary refresh-token families and remembered device credentials. The reset UI must distinguish valid, expired, used, invalid, and successful-link states without exposing account existence or raw tokens. `OTP_ENABLED=false` does not disable this separate email-token flow. The complete copy, delivery, and reset-page contract lives in `docs/archives/forget-password.md`.

### AUTH-R-005 — Subscription Entitlements Use One Server-Resolved Assignment

- **Status:** Active
- **Effective:** 2026-09-10T00:00:00Z
- **Related units:** [subscriptions](units/subscriptions.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API
- **File(s):** `api/app/models/subscription.py`, `api/app/services/subscriptions.py`, `api/app/routers/subscriptions.py`, `api/alembic/versions/20260910_0042_subscriptions.py`

- **What:** The API owns the stable entitlement keys for Friink Free, Pro, and Pro+ and resolves a user's effective plan through at most one current manual assignment. Free is the default and includes core participation; Pro and Pro+ add only application-defined capabilities. Feature boundaries check server-resolved entitlements rather than plan-name or client boolean checks. A missing, expired, or revoked assignment falls back to Free; expiry is checked against server UTC at read time.
- **Edge cases:** Superadmins may grant an active Free, Pro, or Pro+ assignment for 1–3650 days or indefinitely, or revoke it, with a required reason. A new grant replaces the user's current effective assignment and preserves history. Fixed assignments transition from active to expired by effective server-time calculation; indefinite assignments remain active until revoked. Existing content and login sessions remain valid when paid access expires, while new paid-only actions are rejected. Admin assignment reads compute `active`, `expired`, or `revoked` from the same effective-state check rather than trusting the stored status column. The API and authenticated Settings surface expose the server-resolved effective plan, while plan actions remain informational and cannot grant or self-activate paid access. No checkout, payment, billing, scheduler, or background expiry process exists.

### AUTH-R-006 — Account Settings Show Server-Created Joined Date

- **Status:** Active
- **Effective:** 2026-09-11T00:00:00Z
- **Related units:** [account-access](units/account-access.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/user.py`, `api/app/schemas/auth.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx`, `docs/archives/auth-and-session.md`

- **What:** Settings > Account shows a read-only `Joined` field using the account’s server-side creation timestamp. The web client formats the value for the user’s locale and time zone and never derives it from the browser clock.
- **Edge cases:** The field is display-only and is unavailable if the API returns an invalid timestamp. It uses the existing authenticated user response; no separate account-history value is created.

### AUTH-R-007 — Account Settings Show Creation Region

- **Status:** Active
- **Effective:** 2026-09-11T00:00:00Z
- **Related units:** [account-access](units/account-access.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/user.py`, `api/app/models/signup_reservation.py`, `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx`, `docs/archives/updated-account-info.md`

- **What:** Settings > Account shows a read-only `Region` field containing the province/state-level country-region signal available when the account is created. The server stores a coarse ISO 3166-2-style code and never stores the raw IP for this feature.
- **Edge cases:** If the trusted deployment geolocation signal is unavailable, Region displays `Unavailable`. Existing accounts are not inferred or backfilled, and the existing user-entered profile `location` field remains separate. Onboarding may also collect optional user-entered `Location` and private `How I use Friink` values (`For professional networking` or `For personal connection`); both can be edited later. The professional-networking value controls availability of the profile-badge preference but does not grant access, billing, recommendations, ranking, professional status, or directory eligibility.

### AUTH-R-008 — Authoritative Web Session And Refresh Model

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [account-access](units/account-access.md), [session-handling](units/session-handling.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web
- **File(s):** `web/lib/auth.ts`, `web/lib/api-origin.ts`, `web/components/app-shell-route.tsx`

- **What:** Web access JWTs are held in memory and also issued as short-lived HttpOnly access cookies scoped to the account slot; the JWT carries its `sid`, and API authentication verifies the referenced session remains active. On full document entry, the client reads `/auth/me` using the slot access cookie and does not rotate the refresh cookie while that access credential is valid. A `401 TOKEN_EXPIRED` or missing access cookie triggers one slot-captured, coordinated refresh exchange and one retry. Refresh-token family reuse detection remains enabled. Authenticated requests use the in-memory bearer token when available; cookie-authenticated unsafe requests require an allowed Origin. No bearer credential is written to browser-readable persistent storage or sent in cross-tab messages.
- **Edge cases:** A public-site visit with no valid remembered session stays public; when one or more valid sessions exist, Friink restores the most recently used one. Protected routes validate the session before rendering authenticated data/actions. A confirmed terminal failure presents an explanation for the cause and waits for the user's acknowledgment before changing accounts. After acknowledgment, Friink validates remembered sessions in descending last-use order and activates the first valid candidate, or returns to the public site if none remain. It never silently switches accounts after a terminal failure. Timeouts, network, CORS, 403, 5xx, malformed responses, and other ambiguous failures do not change identity and remain retryable in recovery. Refresh coordination uses the same captured slot for lock and request, and followers revalidate with their own slot access cookie rather than rotate again. Each environment uses only its configured API origin. Changes are locally implemented; staging acceptance remains required under [BUG-AUTH-003](bugs.md#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session). Auth/session logic must not be changed without explicit human approval; future auth prompts must reference this rule and obtain sign-off before implementation.

### AUTH-R-009 — OTP Verification Timeout Recovery

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web
- **File(s):** `web/components/login-screen.tsx`, `web/lib/auth.ts`, `docs/archives/auth-and-session.md`

- **What:** A client or network timeout while completing OTP verification is ambiguous because the API may already have committed the authenticated session. The shared web login handler may make one refresh-cookie recovery attempt before displaying an error, then continues the normal authenticated redirect if recovery succeeds.
- **Edge cases:** This applies equally to standalone login and in-app Add account. Invalid or expired OTP responses retain their normal errors; recovery must not loop, clear the active account, or infer account identity from the email address. Only an explicitly confirmed terminal session result may clear local auth.

### AUTH-R-010 — Multiple Account Switching

- **Status:** Active
- **Effective:** 2026-09-26T11:40:24Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `docs/archives/auth-and-session.md`, `web/components/side-drawer.tsx`, `web/components/login-screen.tsx`, `web/lib/auth.ts`

- **What:** After authentication, the web side drawer will provide `Add account`. It opens a design-system modal that reuses the login/signup fields and actions, supports both login and signup, and follows the email → OTP → password → profile signup sequence. A successful authentication adds and selects that account across the browser client. The account-switcher menu remains available with the current account and `Add account`, and switches only among accounts registered on that device. The switcher limit is controlled server-side by `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`, defaulting to four; this does not limit account creation.
- **Security boundary:** Accounts remain fully independent identities; there is no account-to-account link, merged profile, shared server-side security state, or cross-account data access. Device slots and account sessions are server-authoritative. Switching validates an opaque slot and its device/session state; it never trusts a client-supplied user ID, email, or username. Refresh credentials stay HttpOnly on web and in platform secure storage on mobile. Account lists expose safe display metadata only. Browser refresh locks, coordination results, and cached user metadata are slot-scoped. One origin-shared `localStorage` active slot is authoritative; adding or switching accounts updates it, and other open tabs reload to restore that selected slot. OTP completion for another account must preserve an existing `friink_device_id`; it must not replace the browser device identity and hide prior slots.
- **Compatibility:** This is an additive extension to the current one-account session path. Existing password, signup OTP, JWT, refresh rotation, terminal-versus-ambiguous failure, logout, and revocation rules remain in force. Mobile-specific requirements are deferred in `docs/archives/auth-and-session-mobile.md`.

### AUTH-R-011 — Login Route Is Signed-Out Only

- **Status:** Active
- **Effective:** 2026-09-06T20:02:37Z
- **Related units:** [account-access](units/account-access.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/login/login-client.tsx`, `web/components/side-drawer.tsx`, `web/components/login-screen.tsx`

- **What:** `/login` is a signed-out entry point. If a persisted authenticated session exists, including a demo session, the route redirects to `/home` and does not render the standalone login form. Authenticated users add another account through the in-app SideDrawer account menu, whose existing modal supports both login and signup.
- **Edge cases:** The route check runs before the standalone form is rendered to avoid an authenticated-user login flash. Account addition does not navigate through `/login`.

### AUTH-R-012 — New-Device Verification Uses One Approval Path

- **Status:** Active
- **Effective:** 2026-09-06T16:52:53Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `docs/archives/auth-and-session.md`, `api/app/routers/auth.py`, `web/lib/auth.ts`

- **What:** A new-device login submits credentials once, then completes exactly one verification path: the emailed four-minute OTP or approval from an existing signed-in session.
- **Security boundary:** Approval requests show only coarse device details and Approve/Deny actions; existing sessions never display the plaintext email OTP. The OTP is single-use, hashed, attempt-limited, rate-limited, and bound to the intended login/device.

### AUTH-R-013 — Account Switcher UX

- **Status:** Active
- **Effective:** 2026-09-26T12:53:21Z
- **Related units:** [account-access](units/account-access.md), [session-handling](units/session-handling.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web
- **File(s):** `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `web/components/side-drawer.tsx`, `web/components/modal.tsx`, `web/components/login-screen.tsx`, `web/lib/auth.ts`, `docs/archives/auth-and-session.md`

- **What:** Add account opens the existing modal with Login first and Create account below. Successful authentication activates the new or already-remembered account. The drawer exposes switching, Add account, and active-account logout. Non-current accounts have an inline right-side logout action; the current account retains its checkmark.
- **Edge cases:** With `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE=1`, the account menu and its add/switch controls are hidden while ordinary sign-in and logout remain available. Otherwise, the selector opens immediately with the cached device account list, or the current account as a safe fallback when no cache exists. While the deduplicated account refresh runs, the permanent `Switch Account` header remains unchanged and shows the shared spinner with `Updating accounts…`; a failed refresh preserves the cached/current account and shows a retry action. Logout/removal is confirmed with the selected account's profile card. Active logout selects the most recently used remaining account or returns to the public site. Deactivated and pending-deletion accounts show lifecycle messaging; after the user acknowledges that the session ended, Friink removes the unavailable account from the device list and activates the most recently used valid remembered account, or returns to public when none remain. Before adding an account, a legacy active session without a device slot is migrated into one when possible so it remains switchable. Reaching the server limit keeps Add account usable while the API remains authoritative. During an account switch, the selected row shows a spinner and all account rows, logout actions, and Add account are disabled until the request succeeds or fails. A successful add or switch selects that account client-wide; other tabs reload and restore it. Removing the active account may reload the browser after automatically switching to the most recently used remaining account.

### AUTH-R-014 — Drawer Account Controls Use Profile Menu

- **Status:** Active
- **Effective:** 2026-09-06T19:57:29Z
- **Related units:** [account-access](units/account-access.md), [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/side-drawer.tsx`, `web/components/action-menu.tsx`, `web/app/globals.css`

- **What:** The signed-in SideDrawer has a 256px expanded width and a 77px collapsed width, with fixed 16px padding on all four sides in both modes. Navigation and footer action rows use 100% width and 44px height, with 8px top/left/bottom padding, 28px icon cells, 20px-high auto-width glyphs, and 16px icon-to-label gaps. The Profile row is separate: its picture and wrapper are 44×44px with no row padding and stay at the same position in both modes; it displays the current `@username`, truncating long values with an ellipsis before the account switcher. A 16px gap separates the picture and username, Profile from navigation, and navigation rows from one another; footer action rows use the same gap. The footer stays at the drawer bottom. On mobile the expanded drawer uses the same layout as desktop, shown as a viewport-constrained overlay. The account switcher sits to the right of the Profile row when expanded and overlays the lower-right corner of the picture when collapsed; its inner cell is 14×14px with a centered 12×12px glyph. Its portaled menu uses `min(16rem, calc(100vw - 1rem))`, keeps long account labels ellipsized before fixed trailing controls, and confines row hover surfaces to its padded bounds. The menu header is `Switch Account` with a Beta badge; account rows retain the active-account checkmark and trailing logout controls for other accounts, followed by Add account. Active drawer icon color is `#111111` in light mode and `#f0f0f0` in dark mode.
- **Edge cases:** The Profile destination and current-user identity share one row, avoiding duplicate Profile navigation entries. The account-menu trigger remains separate from the Profile link. The menu only reorganizes existing web account actions; it creates no backend relationship and changes no account/session rules.

### AUTH-R-015 — Signup Creates Active Public Accounts

- **Status:** Active
- **Effective:** 2026-09-04T22:06:53Z
- **Related units:** [account-access](units/account-access.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `api/app/models/user.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`

- **What:** A completed signup creates a user with a normalized unique email, a case-insensitive unique username key with preserved display casing, display name defaulting to username when omitted, `is_private = false`, a hashed password, and `is_verified = true`. When signup OTP is enabled, completion occurs only through successful email verification.
- **Edge cases:** Signup validates username syntax and checks username availability before submission. The API remains authoritative and rejects duplicate usernames case-insensitively with `409`; the database enforces the same invariant. The direct signup endpoint is unavailable while OTP is enabled, preventing a client-side bypass.

### AUTH-R-016 — Existing Email Signup Recovery

- **Status:** Active
- **Effective:** 2026-09-07T01:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `web/lib/auth.ts`, `docs/archives/auth-and-session.md`

- **What:** When email-first signup receives an email already registered to Friink, the API creates no signup reservation or signup OTP. It sends a separate single-use, 15-minute sign-in link to the registered address while the web flow stays on the email step with neutral copy.
- **Security boundary:** The browser response must not say that the email is registered or offer account-specific recovery text. The link is delivered only to the address on file, uses the normal session path, and delivery failure does not change the neutral response. Unknown-email login remains generic and never auto-creates an account.

### AUTH-R-017 — Signup Email Ownership OTP

- **Status:** Active
- **Effective:** 2026-09-04T22:06:53Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/services/email.py`, `api/app/services/otp.py`, `api/app/config.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`, `api/tests/test_email.py`

- **Current clarification:** Existing registered emails use the separate
- **What:** With `SIGNUP_OTP_ENABLED=true`, signup uses `/auth/signup/email/start` immediately after email, followed by `/auth/signup/email/verify`, then `/auth/signup/complete`; no user row is created before successful verification. Codes are six uppercase alphanumeric characters, expire after four minutes, are single-use, and a newer code invalidates the previous code.
- **Edge cases:** Verification is limited to five attempts. The pre-verification record contains only the normalized email and hashed OTP; password/profile data is submitted after verification. New signup emails receive the OTP flow; existing emails use the separate registered-address sign-in-link rule and do not receive a signup OTP. Resend delivery is server-side only through `RESEND_API_KEY`; ordinary login remains password-only unless the separate risk-based login OTP flow is implemented.

### AUTH-R-018 — Password And Username Validation

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `api/tests/test_validation.py`

- **What:** Passwords must be at least 8 characters, contain no whitespace, and include at least one uppercase letter, lowercase letter, number, and special character. Passwords are limited to 72 UTF-8 bytes to match the current bcrypt storage format. Usernames must be 2-32 characters and may contain only letters, numbers, `.`, `_`, and `-` with no spaces. Username identity is case-insensitive: accepted usernames are canonicalized to lowercase for storage and routing, while the handle is displayed in that canonical form. Display names are optional, trimmed, and limited to 124 characters.
- **Edge cases:** Signup presents password requirements and username guidance as full-width, left-aligned helper content. Satisfied password requirements and a username meeting the complete 2–32 character allowed-character rule use the current accent color; these are client-side guidance only and server validation remains authoritative.

### AUTH-R-019 — Security Events And Login Notifications Are Durable And Idempotent

- **Status:** Active
- **Effective:** 2026-09-05T22:02:50Z
- **Related units:** [account-access](units/account-access.md), [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/security_event.py`, `api/app/models/notification_outbox.py`, `api/app/models/notification.py`, `api/app/services/security_events.py`, `api/app/routers/auth.py`, `web/components/app-shell.tsx`

- **What:** Successful fresh logins create one durable security event and one user-visible `login_security` notification. Refreshes, retries, and ordinary session activity never create duplicate fresh-login notifications. Security events may record refreshes, failed logins, logout, login challenges, and refresh-token reuse with stable event keys and server-side user/session/device context.
- **Edge cases:** Security events and notification jobs are written after authentication commits. Fresh-login in-app notification delivery then makes a best-effort synchronous outbox drain before the response is returned; provider, network, or configuration failures are swallowed, leave the durable job available for retry, and must not log the user out. Event-linked notification uniqueness and stale-processing recovery protect duplicate workers and delayed delivery. Future email delivery uses the provider-neutral outbox hook and is not required for in-app login notification success. Audit insertion uses idempotent conflict handling; after insert or conflict, the event is resolved by its unique event key.
- **Failure isolation:** Security-event recording is non-blocking with respect to the primary authentication outcome at auth-critical call sites, including login, refresh/reuse detection, bootstrap, logout, failed-login tracking, and staff actions. Fresh-login notification draining is synchronously attempted after authentication commits, but delivery or processing failures are logged loudly and swallowed; they must not alter the primary auth response or roll back the token/session decision.

### AUTH-R-020 — Minimum Signup Age

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/tests/test_validation.py`

- **What:** Signup requires users to be at least 13 years old based on `date_of_birth`.

### AUTH-R-021 — Login Lockout

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_lockout.py`

- **What:** Failed-login throttling is account-based and progressive: failures 1–2 return a generic invalid-credentials response with no cooldown, failure 3 does the same while creating one security notification, failures 4–5 use one minute, failures 6–8 use five minutes, and failures 9+ use a capped fifteen-minute cooldown. A successful login or password reset clears the state; 24 hours without another failure also clears it. Attempts during cooldown do not extend or advance the tier. A secondary hashed per-IP throttle applies across protected authentication, password-reset, OTP-verification, login-approval, and Add-account login endpoints, using an initial 100-request/10-minute baseline followed by a one-minute IP cooldown; shared-network bans are not used.
- **Security boundary:** Unknown identifiers do not create account-specific state and remain subject only to generic endpoint/IP protections. Email and username login share the same account state. Device/session throttling is explicitly out of scope; existing device recognition and risk-based OTP remain separate. Cooldowns for Add-account login apply only to the account being added and never disrupt the currently active account.
- **Notifications:** The third failure creates at most one failed-login security notification per account per rolling 24 hours. Delivery is non-blocking and cannot alter the authentication result.
- **UX:** Progressive cooldowns return `429` with server-provided remaining time and distinct retry copy. The web login form preserves the identifier, clears the password, disables submission, and maintains an accessible countdown across refreshes and tabs. It must not show attempts remaining, tier names, IP/device metadata, or full-lock copy.
- **Full lock:** A separate full account lock returns `423` with exactly `Your account is locked. Contact support.` and no reason, duration, or retry detail.

### AUTH-R-022 — Login With Email Or Username

- **Status:** Active
- **Effective:** 2026-09-05T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/app/services/auth.py`, `api/app/routers/auth.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`, `api/tests/test_auth_updates.py`

- **What:** The login identifier accepts either the account email or username. Email and username matching are case-insensitive; username lookup uses the authoritative `username_key`. The web field is labeled `Email or username`, while signup remains email-only.
- **Edge cases:** Unknown identifiers and wrong passwords return the same generic invalid-credentials result. Username login follows the same lockout, rate-limit, device-recognition, and future risk-based OTP decisions as email login. A leading `@` is accepted and stripped for username lookup. The API may accept the legacy `email` request key during client migration, but new clients send `identifier`.

### AUTH-R-023 — Permanent Email Uniqueness

- **Status:** Active
- **Effective:** 2026-09-05T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/user.py`, `api/app/services/auth.py`, `api/alembic/versions/20260905_0029_casefold_email_uniqueness.py`

- **What:** One normalized email address can belong to only one Friink account permanently. This rule applies across all accounts and remains in force when multiple-account support is added; accounts are never linked or allowed to share an email.

### AUTH-R-024 — Risk-Based Login And Device Recognition

- **Status:** Active
- **Effective:** 2026-09-05T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/auth.py`, `api/app/services/login_challenges.py`, `api/app/services/session_service.py`, `api/app/services/email.py`, `api/app/config.py`, `api/alembic/versions/20260905_0026_login_risk_challenges.py`, `api/tests/test_phase2_auth_flows.py`

- **What:** Email and username password logins use the same server-authoritative risk decision. Recognized normal devices proceed without OTP; new or suspicious devices receive a fresh four-minute email OTP when delivery is configured. The device identifier is opaque, hashed at rest, HttpOnly on web, and separate from refresh tokens and sessions.
- **Edge cases:** Missing or changed device signals trigger the challenge; successful approval records the current coarse signals. Refresh never requires OTP, and no client claim, IP address alone, or browser fingerprint alone establishes trust. Missing or unreadable device cookies are fail-closed and force the OTP path, covered by `test_risk_login_challenges_new_changed_and_recognized_devices` in `api/tests/test_phase2_auth_flows.py`. When OTP is completed for an account not yet recognized on a browser that already has a device cookie, the existing cookie is retained so device account slots survive.

### AUTH-R-025 — Account Lock And Access-Token Boundary

- **Status:** Active
- **Effective:** 2026-09-05T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/user.py`, `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/alembic/versions/20260905_0026_login_risk_challenges.py`

- **What:** Account locking blocks password login and refresh only. Already-issued short-lived access JWTs are not force-invalidated and remain valid until normal expiry; no lock-state revocation/version check is added to authenticated access-token validation.
- **Edge cases:** Lifecycle deactivation/pending deletion is intentionally a separate, stricter boundary: `get_current_user` rejects already-issued access JWTs for inactive lifecycle states while ordinary account locks do not. The paired regression is `test_deactivation_rejects_existing_access_token_but_lock_does_not` in `api/tests/test_phase2_auth_flows.py`.

### AUTH-R-026 — Username Release And Lockout Copy

- **Status:** Active
- **Effective:** 2026-09-05T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/routers/auth.py`, `packages/design/design.md`, `docs/archives/auth-and-session.md`

- **What:** Username changes require no step-up authentication. Released usernames, including high-profile usernames, are immediately available with no cooldown. Full account locks show exactly `Your account is locked. Contact support.`; progressive cooldowns show a distinct tier-specific retry message and must never use the full-lock copy.

### AUTH-R-027 — JWT Sessions

- **Status:** Active
- **Effective:** 2026-08-31T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/refresh_token.py`, `api/app/routers/auth.py`, `api/app/services/session_service.py`, `api/app/services/security.py`, `api/app/services/auth_errors.py`, `api/app/config.py`, `web/lib/auth.ts`, `api/tests/test_token_resilience.py`

- **What:** Login returns a bearer access token and sets an HTTP-only opaque refresh-token cookie. Access tokens default to 30 minutes; refresh tokens default to 30 days. Access JWT payloads are minimal and stable: `sub`, `typ`, `iat`, and `exp`, with a `kid` header identifying the signing key. Refresh tokens are stored server-side by SHA-256 hash only.
- **Edge cases:** Each login/device receives a refresh-token family. Every refresh rotates the presented token; presenting a rotated or revoked token revokes that family, records one durable `refresh_reuse_detected` security event, and returns the same generic `401`. Logout revokes only the presented family and deletes the refresh cookie with `204`. Expired refresh rows are rejected and retained for bounded reuse-detection cleanup. Token failures are classified server-side as expired, malformed, signature mismatch, schema invalid, refresh-token invalid, or session/user not found; client responses keep details generic but include a machine-readable code. Event and generic-response behavior are covered by `test_refresh_rotation_reuse_logout_legacy` in `api/tests/test_refresh_token_rotation.py`.

### AUTH-R-028 — Users Can Manage Their Active Sessions

- **Status:** Active
- **Effective:** 2026-09-01T22:30:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/auth_session.py`, `api/app/models/refresh_token.py`, `api/app/routers/auth.py`, `api/app/services/session_service.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx`

- **What:** Settings > Account lists the user's active server-managed auth sessions with best-effort device, browser, operating-system, logged-in, and last-active information. The server identifies the current session from the presented refresh cookie; the UI never supplies that identity. Users may revoke other sessions individually or revoke all other sessions while preserving the current one.
- **Edge cases:** `refresh_tokens.session_id` is nullable so existing/orphaned refresh rows remain valid and are not backfilled. Missing user-agent parsing falls back to `Unknown device`. Raw tokens, hashes, IPs, and internal UUIDs are never shown. Access tokens already issued may remain valid until their normal expiry after revocation.

### AUTH-R-029 — JWT Secret Configuration Fails Loud

- **Status:** Active
- **Effective:** 2026-08-29T12:23:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API only
- **File(s):** `api/app/config.py`, `api/app/main.py`, `api/tests/test_token_resilience.py`

- **What:** `JWT_SECRET_KEY` is required at API settings load and has no application default or generated fallback. API startup logs only an 8-character SHA256 fingerprint of the configured secret so deploys can confirm secret stability without exposing the secret.
- **Edge cases:** Missing `JWT_SECRET_KEY` prevents startup through Pydantic settings validation. Vercel web/API and staging/production secret values must be verified in deployment settings when environments share a database.

### AUTH-R-030 — Web Auth Refresh Is Silent For Expired Access Tokens

- **Status:** Superseded by AUTH-R-008
- **Effective:** 2026-08-29T12:23:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/lib/auth.ts`

- **What:** **Deprecated/Superseded by `Authoritative Web Session And Refresh Model`.** The former behavior proactively refreshed access tokens at about 80% of token lifetime and allowed per-request opt-outs. Reactive refresh after `TOKEN_EXPIRED`, one retry, and explicit-refresh-401 session clearing remain only where they conform to the authoritative model.
- **Edge cases:** The old per-tab promise deduplication and feature-specific opt-outs are no longer the session contract. Cross-tab coordination, retryable non-terminal failures, and single-origin API resolution are governed by the authoritative rule above.

### AUTH-R-031 — Current User Updates

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`

- **What:** Authenticated users may update username, display name, about text, and privacy status. Email changes require current-password confirmation followed by the dedicated new-email ownership OTP flow; direct email updates through the general profile endpoint are rejected. Settings validates username availability before submission, and the API/database remain authoritative: username/email updates reject conflicts with another user, with both identifiers compared case-insensitively.
- **Edge cases:** If no submitted value changes the user, the API returns the existing user without committing. `about` is capped at 256 characters and display name at 120.
- **Web input limit:** The Settings About textarea limits input to 128 characters and shows the live `x/128` count inside the lower-right of the field; the API's broader 256-character ceiling remains a backend safety limit.

### AUTH-R-032 — Users Can Change Their Password From Account Settings

- **Status:** Active
- **Effective:** 2026-08-31T20:57:15Z
- **Related units:** [account-access](units/account-access.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`, `web/lib/auth.ts`

- **What:** An authenticated user may change their password from `/settings/account` after providing the current password, a new password that satisfies the standard password rules, and a matching confirmation.
- **Edge cases:** The backend verifies the current password and remains authoritative for validation. Signup and Settings expose native `minLength`, `maxLength`, `pattern`, and `title` hints for password-manager/browser guidance. Focusing the New password field exposes the shared concise password checklist. Failed changes do not alter the stored password; successful changes preserve the current session.

### AUTH-R-033 — Web Settings Saves Confirm And Persist Through API

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [posts](units/posts.md), [saved-items](units/saved-items.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Not recorded in historical `RULES.md`
- **File(s):** Not recorded in historical `RULES.md`

- **What:** Web settings that update account/profile fields call the current-user API and show a success toast after saving. Profile/account fields use icon-only tick save buttons. The Private Profile toggle saves immediately through the API when toggled.
- **Edge cases:** If an API-backed save fails, the UI reverts to the last known saved value. Theme and privacy changes require an explicit tick confirmation. Direct Messages and Mentions currently use client-side draft/save controls until corresponding backend settings exist.
- **Presentation:** Each expanded setting shows its title and summary once; its input/control body must not repeat the setting title as a second visible label, while retaining an accessible control name. Every settings row uses a left setting icon, a shrinkable middle setting body, and a right-side action rail; right-side save and action controls are square icon-only controls with accessible labels/tooltips. Settings tabs are ordered General, Profile, Privacy & Safety, Account, and Subscription; Privacy & Safety groups visibility, communication, and safety controls, while Account places identity/security before metadata and lifecycle actions. Shared primary buttons use a solid accent surface, shared secondary buttons use a translucent accent surface with accent text, and this semantic treatment is independent of whether a button contains text, text plus an icon, or only an icon; contextual post actions retain their specialized treatment.

### AUTH-R-034 — Empty About Is Owner-Only Prompt

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`

- **What:** New accounts and profiles with a deleted About keep the stored About value empty. Visitors see no placeholder text; the signed-in owner sees `Add about in settings.` instead.

### AUTH-R-035 — Profile Pictures Are Optional

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Not recorded in historical `RULES.md`
- **File(s):** Not recorded in historical `RULES.md`

- **What:** Users may upload an optional profile picture through the authenticated profile settings flow. When `profile_picture_url` is null, all supported profile identity surfaces use the shared `web/public/media/profile.jpg` default profile picture.
- **Edge cases:** A profile picture is only persisted after the backend verifies the user-scoped object upload and removes the previously stored object when replacing one. Legacy flat object keys are also eligible for deletion. Missing R2 configuration produces a clear service-unavailable error; no fake storage or default credential behavior is allowed.
- **API documentation security:** FastAPI Swagger, ReDoc, and the OpenAPI schema remain available for staging diagnostics but are disabled in production. These documentation surfaces never replace authentication on protected endpoints.
- **Processing:** The client accepts JPG/JPEG, PNG, and WebP, compresses to JPEG before requesting an upload URL, rejects HEIC/HEIF and other unsupported formats, and the confirmation backstop rejects objects over 3 MB.
- **Crop and sizing:** Profile pictures require a square crop in a modal dialog before compression. Sources with a shorter edge below 128px are rejected before cropping, and crop zoom is capped at `shorterEdge / 128` so a smaller crop cannot be selected. The avatar output targets 512px square and approximately 250KB, but never upscales a crop smaller than 512px. The post-media preset targets 1024px maximum longest edge and approximately 500KB and is used by the submit-time post upload flow.
- **Preview and confirmation:** Selecting or cropping a file must not replace the visible server-confirmed avatar. The modal tick is the only post-selection upload control, and the modal closes only after the complete upload and API confirmation flow succeeds.

### AUTH-R-036 — Profile Setup Resumes Until Complete

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Not recorded in historical `RULES.md`
- **File(s):** Not recorded in historical `RULES.md`

- **What:** New accounts open the three-step profile setup flow after authentication. The flow is headed `Let's update your settings` and contains optional Profile picture, About and Location, and Friink usage-intent steps.
- **Progress:** The current setup step and completion state are persisted on the user record. Skipping a step marks that step done and advances; closing the setup preserves the current step when persistence succeeds, dismisses the local modal, and suppresses it for the current browser onboarding session. Successful logout clears that temporary dismissal so a later login may resume incomplete setup from its persisted step.
- **Completion:** The setup is complete after the usage-intent step is saved or skipped. The profile picture step reuses the shared Settings crop/upload flow. Location is user-entered profile data, while the usage intent is a private nullable preference with `professional` and `personal` values. Existing accounts migrated after this flow was introduced are treated as already complete.

### AUTH-R-037 — Preserve Sessions During Recoverable API Failures

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`, `web/app/globals.css`

- **What:** Authenticated route bootstrap may clear the local session and redirect to login only after an explicit `401 Unauthorized` response.
- **Do not:** Network failures, API `5xx` responses, deployment errors, or database migration mismatches must not be treated as proof that a user's credentials are invalid.
- **Deployment:** Additive database migrations must be applied and verified before deploying code that reads the new fields; the client-side guard remains required as a second line of protection.

### AUTH-R-038 — Web Session Persistence

- **Status:** Active
- **Effective:** 2026-09-26T11:40:24Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/lib/auth.ts`, `web/components/public-header.tsx`, `web/app/login/login-client.tsx`, `api/app/routers/auth.py`

- **What:** The web client stores only safe authenticated account metadata and remembered-account summaries in slot-scoped browser storage. Access JWTs remain in memory and in short-lived, slot-scoped HttpOnly cookies; refresh credentials remain HttpOnly cookies. One shared selected-slot key controls the active account across the browser client; adding or switching accounts updates that key, and other open tabs reload to restore the selected slot. Logout clears the current slot's cached metadata and session cookies without clearing other remembered-account summaries.
- **Edge cases:** `loadPersistedAuthSession()` intentionally ignores the local demo email `demo@friink.local` so the public landing page does not redirect for demo sessions. Slot-scoped coordination and cached summaries must not store access/refresh tokens, token hashes, passwords, OTPs, internal UUIDs, or device secrets in browser-readable storage.

### AUTH-R-040 — Session Restoration Has Explicit Recovery UX

- **Status:** Active
- **Effective:** 2026-09-26T12:37:37Z
- **Related units:** [account-access](units/account-access.md), [session-handling](units/session-handling.md), [profiles](units/profiles.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/session-recovery-screen.tsx`, `web/components/app-shell-route.tsx`, `web/components/public-route-guard.tsx`, `web/lib/auth.ts`, `api/app/routers/auth.py`, `api/app/services/auth_errors.py`, `web/app/login/login-client.tsx`, `web/components/login-screen.tsx`, `web/app/[username]/profile-client.tsx`, `web/app/posts/[postId]/post-client.tsx`, `web/app/[username]/[postId]/post-client.tsx`

- **What:** Public route content renders immediately. A non-blocking `/auth/entry-status` hint treats any non-empty access or refresh cookie, including cookies for other remembered-account slots when the selected slot is missing or stale, as a reason to attempt restoration; this hint does not establish that a session is valid. A public-site visit with no valid remembered session stays public. If one or more remembered sessions validate, Friink restores the most recently used one. Authenticated route entry validates `/auth/me` with the slot access cookie, then refreshes only when access is expired or absent. Cached safe user metadata is presentation-only; private data/actions require server validation. When a known session has ended, Friink explains the cause and waits for acknowledgment before falling back to the most recently used valid remembered session, or returning to public when none remain. Expiry or another terminal cause is also explained; Friink does not silently switch accounts. A termination notice is shown once per browser client: other open tabs wait for acknowledgment and then follow the same account or public-site result. If the tab presenting the notice closes, another tab can take over.
- **Edge cases:** Timeouts/network/CORS/5xx/malformed responses never prove that a session ended, never change account identity, and remain retryable. Ambiguous recovery retains retry, sign-in, explicit account choice, and logout actions. The account-choice list scrolls inside its modal. Refresh-token reuse detection remains active. Refresh coordination and request headers use the same captured slot; cross-tab followers validate using their own slot access cookie, and stale responses cannot replace a later active slot.
- **Verification:** Web TypeScript and API syntax checks pass. A focused API session-revocation test reached its passing assertion but pytest reported a Windows temporary-SQLite cleanup error during teardown. Multi-tab browser acceptance and staging acceptance remain pending.

### AUTH-R-039 — Profile Identity Blocks Link To Profiles

- **Status:** Active
- **Effective:** 2026-08-29T12:57:00Z
- **Related units:** [account-access](units/account-access.md), [profiles](units/profiles.md), [connections](units/connections.md), [blocking](units/blocking.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-card.tsx`, `web/components/list-row.tsx`, `web/components/connections-screen.tsx`, `web/components/notifications-screen.tsx`

- **What:** Whenever app content shows a user's profile identity, the UI should use the shared `ProfileCard` instead of separately composing avatar/name/handle. In list surfaces such as Connections and Notifications, the visible profile card links to the user's profile route.
- **Edge cases:** Row action buttons such as Accept, Reject, Cancel, Remove, and post/chat actions remain separate controls. Do not nest a profile link inside a row rendered as a button; keep interactive targets valid and distinct.

## Privacy & Connections

### CONN-R-001 — Directional Follow Relationships

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/connection.py`, `api/app/services/connections.py`, `api/app/routers/connections.py`

- **What:** Follows are directional and non-mutual. A row in `follow_requests` from `requester_id` to `recipient_id` represents the relationship or request history.
- **Edge cases:** Self-follow is rejected with `400`.

### CONN-R-002 — Home Following Feed Is Follow-Only

- **Status:** Active
- **Effective:** 2026-08-31T00:00:00Z
- **Related units:** [connections](units/connections.md), [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/routers/posts.py`, `api/app/services/posts.py`, `web/lib/auth.ts`, `web/components/home-screen.tsx`, `web/components/app-shell.tsx`, `web/app/home/[tab]/page.tsx`

- **What:** The Home `Following` tab is the canonical `/home/following` route and returns posts only from accounts the signed-in user follows through an accepted directional follow relationship.
- **Edge cases:** The feed uses the same server-side filtering for initial pages, older-page pagination, newer-post polling, and saved-position context restoration. Users without follows see an empty feed; their own posts are not included unless they explicitly follow another account that authored them. The previous `/home/connections` slug redirects to `/home/following` for compatibility.

### CONN-R-003 — Public Accounts Accept Follows Immediately

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Related units:** [account-access](units/account-access.md), [connections](units/connections.md), [media](units/media.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`

- **What:** Following a public account creates an `accepted` follow request row immediately and returns it as the active following relationship.
- **Edge cases:** If an active or pending row already exists, the existing row is returned instead of creating a duplicate.
- **Related rules:** Private Accounts Require Pending Requests; Follow Notifications

### CONN-R-004 — Private Accounts Require Pending Requests

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Related units:** [account-access](units/account-access.md), [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`, `web/components/connections-screen.tsx`

- **What:** Following a private account creates a `pending` request instead of an active follow. The recipient can accept or reject it.
- **Edge cases:** Pending requests are exposed through incoming/outgoing request endpoints and do not count as followers or following.
- **Related rules:** Request Notifications; Connections Lists Count Accepted Rows Only

### CONN-R-005 — Rejected Requests Cool Down For 24 Hours

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`

- **What:** When a pending request is rejected, the row is retained as `rejected` with `responded_at`, and the requester cannot resend to that private profile until 24 hours have passed.

### CONN-R-006 — Sender-Canceled Requests Can Trigger A Resend Lockout

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [account-access](units/account-access.md), [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`

- **What:** A requester may cancel pending requests, but after three cancellations within a rolling 3-hour cycle, another request to that private profile is blocked until 24 hours after the first cancellation in that cycle.
- **Edge cases:** One cancellation does not lock resending. The cooldown uses retained `canceled` rows where `removed_at` is null, so owner-side follower removals do not count as sender cancels.

### CONN-R-007 — Unfollow Removes The Active Edge From Counts

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`

- **What:** Either party may remove an accepted connection by setting the row to `canceled`; it no longer appears in follower/following lists or counts.
- **Edge cases:** Unfollow does not notify the target. The implementation retains the row instead of hard-deleting it.

### CONN-R-008 — Owner-Removed Followers Cool Down For 24 Hours

- **Status:** Active
- **Effective:** 2026-08-29T00:00:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`

- **What:** When an account owner removes a follower, the active row becomes `canceled` with `removed_at`, and that follower cannot follow the owner again for 24 hours.

### CONN-R-009 — Private-To-Public Auto-Accepts Pending Requests

- **Status:** Active
- **Effective:** 2026-08-29T07:15:00Z
- **Related units:** [connections](units/connections.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_auth_updates.py`

- **What:** When a user changes from private to public, all pending requests received by that user become `accepted` in the same update flow.
- **Edge cases:** Changing from public to private does not alter existing followers or following rows.
- **Related rules:** Request Accepted Notifications

### CONN-R-010 — Connections Lists Count Accepted Rows Only

- **Status:** Active
- **Effective:** 2026-08-29T12:20:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `web/components/app-shell.tsx`

- **What:** Followers and following endpoints return only users connected through `accepted` rows. Pending, rejected, and canceled rows are excluded.

### CONN-R-011 — Requests Tab Is Private-Account UI

- **Status:** Active
- **Effective:** 2026-08-29T12:15:00Z
- **Related units:** [account-access](units/account-access.md), [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/connections-screen.tsx`

- **What:** The web Connections page shows `All`, `Followers`, `Following`, and `Requests` for private signed-in accounts; public signed-in accounts see only `All`, `Followers`, and `Following`. If a public account lands on Requests, the web UI resets the filter to `All`.
- **Edge cases:** The backend request endpoints remain authenticated API routes regardless of the current user's privacy setting.

## Posts, Replies & Quotes

### POST-R-001 — One Posts Table Stores Posts, Replies, And Quotes

- **Status:** Active
- **Effective:** 2026-08-29T00:00:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/post.py`, `api/app/services/posts.py`, `api/app/schemas/posts.py`

- **What:** Posts, replies, and quotes are distinguished by `kind`. Replies set `parent_post_id`; quotes set `quoted_post_id`; ordinary posts set neither.
- **Edge cases:** Replies are excluded from the main feed query. Deleted posts are excluded from normal fetches.

### POST-R-002 — Post Content And Media Limits

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [posts](units/posts.md), [media](units/media.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/schemas/posts.py`, `api/app/services/posts.py`, `web/components/app-shell.tsx`, `web/components/composer.tsx`

- **What:** Backend post content is capped at 512 characters. Free users are limited to 256 characters; the server-resolved `longer_posts` entitlement permits up to 512 characters. Normal posts and replies require non-blank content; quote posts may be created without typed quote text when `quoted_post_id` is present. The web floating post composer also applies a frontend-only 256-character entry limit and displays an `x/256` counter.
- **Edge cases:** Media-only posts are allowed when the payload contains confirmed post-media items, and media is limited to 8 items. The API remains authoritative when a client submits more than the Free limit, and rejects the request unless the server-resolved `longer_posts` entitlement is active.

### POST-R-003 — Create Payload Must Match Post Kind

- **Status:** Active
- **Effective:** 2026-08-29T00:00:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`

- **What:** Reply posts require `parent_post_id`; non-replies may not set `parent_post_id`. Quote posts require `quoted_post_id`; non-quotes may not set `quoted_post_id`.

### POST-R-004 — Replies Preserve Their Nested Conversation Tree

- **Status:** Active
- **Effective:** 2026-09-12T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/components/feed-post.tsx`, `web/components/post-detail-screen.tsx`, `web/app/globals.css`, `docs/archives/posts.md`

- **What:** A reply is a complete post object with its own author, ID, canonical URL, visibility, reactions, and descendants. Top-level replies belong directly under the root post; nested replies remain attached to their true parent. Standalone replies are excluded from the main feed, but a reply may be shown inside a Quote when deliberately referenced.
- **Edge cases:** Logical nesting has no fixed depth limit. Branches can be collapsed and expanded independently, and large branches load through explicit `View replies` or `Open thread` controls. Reply order is chronological within each branch.

### POST-R-005 — Reply Thread Presentation Caps Visual Indentation

- **Status:** Active
- **Effective:** 2026-09-12T00:00:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web
- **File(s):** `web/components/feed-post.tsx`, `web/components/post-detail-screen.tsx`, `web/app/globals.css`, `docs/archives/posts.md`

- **What:** The first three visual reply levels use progressive indentation and a subtle connector rail. Visual indentation is capped after level three; deeper replies reuse the capped indentation and show parent context such as `Replying to @username`.
- **Edge cases:** Opening a deep reply makes that reply local level zero in focused view. Its descendants display relative depth, while the root and relevant ancestor chain remain available as compact navigable context. A focused reply view highlights the selected reply, shows its direct replies, and provides `View full conversation` back to the root thread.

### POST-R-006 — Profile Replies Are Author-Scoped Content

- **Status:** Active
- **Effective:** 2026-09-12T00:00:00Z
- **Related units:** [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/services/posts.py`, `api/app/routers/users.py`, `web/lib/auth.ts`, `web/app/[username]/profile-client.tsx`, `web/components/app-shell.tsx`, `web/components/profile-screen.tsx`

- **What:** A profile's Replies tab returns only visible replies authored by that profile, using the same server-side visibility rules as post details and reply threads. Each reply remains a reply and preserves its parent context and canonical reply URL.
- **Edge cases:** The profile Posts tab excludes replies; the Replies tab does not treat replies as normal posts or promote them into the main feed. Unavailable parents do not bypass server-side visibility checks.

### POST-R-007 — Private Post Visibility Is Enforced Server-Side

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/lib/auth.ts`

- **What:** A private author's posts are visible only to the author and accepted followers. Public-author posts are visible without an accepted-follow check.
- **Edge cases:** Unauthorized or unauthenticated post detail and reply-list access resolves as `404`-equivalent `Post not found.` for protected posts.
- **Related rules:** Reply Creation Rechecks Parent Visibility; Quote Cards Hide Protected Content

### PROFILE-R-008 — Profile Content Requests Preserve Pagination Semantics

- **Status:** Active
- **Effective:** 2026-09-16T01:32:00Z
- **Related units:** [profiles](units/profiles.md), [feed](units/feed.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/users.py`, `api/app/services/posts.py`, `web/app/[username]/profile-client.tsx`, `web/lib/auth.ts`

- **What:** Profile posts and replies pass `limit` and `cursor` to the
  author-scoped API using their named meanings. A profile route must not show a
  loaded shell while silently losing its content because pagination arguments
  were reordered.

### PROFILE-R-009 — Profile Connection Labels Use Text-Button Geometry

- **Status:** Active
- **Effective:** 2026-09-16T04:00:00Z
- **Related units:** [profiles](units/profiles.md), [connections](units/connections.md)
- **Source:** [profiles unit](units/profiles.md), [design implementation contract](../packages/design/design.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/app/globals.css`

- **What:** Profile Edit, Follow/Unfollow, and Message actions use the primary
  button treatment. Other-user profile connection actions with labels use the
  standard text-button layout and keep their icon and label on one line.
  Icon-only Message and More controls retain the shared icon-button geometry;
  Message keeps the primary semantic treatment while More remains neutral.
- **Edge cases:** The connection action remains API-state-driven and may show
  `Follow`, `Following`, or `Cancel request`; its label must not be forced into
  an icon-only grid layout.

### PROFILE-R-010 — Profile Moderation Uses Contextual Navigation

- **Status:** Active
- **Effective:** 2026-09-16T04:30:00Z
- **Related units:** [profiles](units/profiles.md), [blocking](units/blocking.md)
- **Source:** [profiles unit](units/profiles.md), [design implementation contract](../packages/design/design.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/profile-screen.tsx`, `web/components/navigationbar.tsx`

- **What:** Other-user profile moderation actions are exposed through the
  shell-owned contextual NavigationBar overflow menu. Selecting Block opens
  the shared confirmation modal for the viewed profile.
- **Edge cases:** Block is not rendered as a detached menu in the profile
  action row. Self profiles do not receive the other-user Block menu item.

### PROFILE-R-012 — Professional Badge Visibility Is User-Controlled

- **Status:** Active
- **Effective:** 2026-09-16T21:51:28Z
- **Related units:** [profiles](units/profiles.md), [settings](units/settings.md)
- **Platform:** Web/API
- **Source:** Current implementation
- **File(s):** `api/app/models/user.py`, `api/app/schemas/auth.py`, `api/app/services/auth.py`, `api/app/routers/auth.py`, `api/alembic/versions/20260917_0049_professional_badge.py`, `web/components/account-screens.tsx`, `web/components/profile-card.tsx`, `web/components/profile-badge.tsx`, `web/components/profile-screen.tsx`, `web/components/side-drawer.tsx`, `web/lib/auth.ts`, `web/app/globals.css`

- **What:** A user may enable `Show you are a professional on Profile` only
  when their private `How I use Friink` preference is `For professional
  networking`. The public profile then renders a `Professional` badge
  immediately next to the displayed name. The preference is off by default.
- **Edge cases:** Selecting `For personal connection` hides the setting and
  clears the stored badge visibility. The API rejects attempts to enable the
  badge without the professional-networking preference. Badge visibility does
  not award professional status, register credentials, grant directory access,
  or change subscription entitlements. The same effective value is returned
  for data-backed profile-card surfaces so the badge remains consistent
  wherever that user is represented. Professional and Friink Registered use
  the shared accent-colored compact pill treatment, including in the side
  drawer; both remain icon-only with accessible labels.

### POST-R-008 — Reply Creation Rechecks Parent Visibility

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`

- **What:** A user cannot reply to a post unless the API confirms that user can view the parent post.
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### POST-R-009 — Visible Private Posts May Be Quoted

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`

- **What:** A Quote may reference any visible post or reply, including content owned by a private account when the quoting user is authorized to view it.
- **Edge cases:** Existing quotes remain when an account becomes private. Viewers who retain access see the embedded original; viewers without access see the quote post with the embedded original marked unavailable. New quotes are rejected unless the quoting user can currently view the original.

### POST-R-010 — Quote Cards Hide Protected Content

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `web/components/feed-post.tsx`

- **What:** If a quoted post is deleted or unavailable, the quote payload is marked unavailable. If the quoted post's author is private and the viewer cannot view it, the Quote remains visible while the embedded content is replaced by `Content not available`.
- **Edge cases:** An inaccessible private post exposes no author, text, media, or navigable original link. Deleted or missing quoted posts use `Original post unavailable.` The Quote itself remains subject to its own visibility and reaction rules.
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### POST-R-011 — Feed Pagination And Updates

- **Status:** Active
- **Effective:** 2026-08-29T10:05:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/components/home-screen.tsx`

- **What:** `GET /posts` returns cursor-paginated non-reply feed pages ordered newest first, with a default limit of 20 and maximum limit of 100. `GET /posts/updates` returns posts newer than a supplied top-feed anchor. `GET /posts/context/{post_id}` returns an anchor-centered slice for restoring reading position.
- **Edge cases:** Invalid cursors return `400`. Context for a missing, reply, or unauthorized anchor returns no context and the router reports `404`.

### POST-R-012 — Web Home Feed Restores Reading Position

- **Status:** Active
- **Effective:** 2026-08-29T10:05:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/home-screen.tsx`

- **What:** The web Home feed stores the top visible post id in `localStorage` and attempts to restore around that anchor on the next load.
- **Edge cases:** If the saved anchor fails to load, the client clears it and falls back to a normal feed load. Polling for newer posts runs only while the document is visible and uses a 10-second interval.

### POST-R-013 — Canonical Post URLs Use Author Username And Post ID

- **Status:** Active
- **Effective:** 2026-08-29T10:20:00Z
- **Related units:** [account-access](units/account-access.md), [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/[username]/[postId]/page.tsx`, `web/app/posts/[postId]/page.tsx`, `web/lib/post-path.ts`

- **What:** Canonical post-detail URLs use `/{username}/{postId}`. The legacy `/posts/{postId}` route fetches the post and redirects to the canonical author-scoped URL.
- **Edge cases:** If the username segment is stale or mismatched, the canonical route permanently redirects to the current author username while preserving query parameters.

### POST-R-014 — Web Post Cards Navigate And Expand Text Locally

- **Status:** Active
- **Effective:** 2026-08-30T00:00:00Z
- **Related units:** [posts](units/posts.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/feed-post.tsx`, `web/app/globals.css`

- **What:** Clicking a non-interactive area of a web post card opens the canonical post detail page. `Show more...` appears only when the body text exceeds four visible lines and expands that card in place instead of navigating.
- **Edge cases:** Profile links, reply/quote/like/share, Save, overflow, and the `Show more...` button keep their own click behavior and do not trigger card navigation.

### POST-R-015 — Post Utility Controls Use Plain Accent States

- **Status:** Active
- **Effective:** 2026-09-16T03:15:00Z
- **Related units:** [feed](units/feed.md), [posts](units/posts.md)
- **Source:** [feed unit](units/feed.md), [design implementation contract](../packages/design/design.md)
- **Platform:** Web only
- **File(s):** `web/components/feed-post.tsx`, `web/app/globals.css`

- **What:** FeedPost Share and More utilities use compact, transparent,
  borderless icon-control geometry rather than standard button dimensions. They
  sit in a Share-then-More pair at the right content inset with a 12px gap and
  use the current accent color on hover, focus, and press.
- **Edge cases:** The utilities have no decorative border or outline and do not
  inherit the shared `.icon-button` minimum dimensions. The lower Comment,
  Quote, Like, and Save actions use the same accent interaction states; Like
  and Save retain the accent color while active.

## Notifications

### NOTIF-R-001 — In-App Notifications Are Fetchable And Readable

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/models/notification.py`, `api/app/services/notifications.py`, `api/app/routers/notifications.py`, `web/lib/auth.ts`, `web/components/notifications-screen.tsx`

- **What:** Authenticated users can fetch a paginated notification feed, fetch an unread count, mark one notification read, or mark all their notifications read. The web Notifications screen provides `All` and `Security` views plus an unread-only filter and an explicit mark-all action.
- **Edge cases:** Notification feed pages default to 20 items and clamp to a maximum of 100. The bell shows a green dot when unread count is positive, displays the actual count up to `99+`, and shows unread items only, up to four initially with scrolling for more. With zero unread notifications it shows the shared `Nothing to show.` state; read notifications never populate the dropdown. The web app polls the unread count every 4 seconds through a transport boundary, pauses polling while hidden, resumes immediately on focus/visibility recovery, and refreshes the full list while the Notifications screen is open. Opening the bell or selecting a dropdown item does not mark anything read. Opening the Notifications screen does not mark every item read; a notification becomes read only when it is meaningfully visible in the full list or through explicit mark-all. Dropdown activation, destination navigation, and inline action completion do not replace the full-list read rule. Existing unread items establish a silent baseline; a toast is reserved for a genuinely new important notification and the same notification cannot repeatedly trigger it. While a read mutation is pending, stale count/list poll responses must not restore the bell dot or reclassify that item as unread. Informational notifications navigate to their canonical destinations, while pending private follow and chat requests expose inline Accept/Decline actions in both notification surfaces. Unknown notification types render safely with generic API/client-provided copy and must not cause unsafe navigation. Failed refreshes retain the last known list/count and failed actions preserve the item with recoverable feedback. Marking another user's notification read returns `404`. See `docs/archives/notifications.md` for the complete contract.

### NOTIF-R-002 — Follow Notifications

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [connections](units/connections.md), [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`

- **What:** Following a public profile creates `follow_sent_public` for the actor and `new_follower` for the target.
- **Edge cases:** Unfollowing is silent for the target.

### NOTIF-R-003 — Request Notifications

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [connections](units/connections.md), [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`

- **What:** Sending a private follow request creates `request_sent` for the actor and `request_received` for the target.
- **Edge cases:** Canceling a request is silent for the target. Rejecting a request is silent for the requester.

### NOTIF-R-004 — Request Accepted Notifications

- **Status:** Active
- **Effective:** 2026-08-29T13:10:00Z
- **Related units:** [connections](units/connections.md), [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/services/auth.py`, `api/app/models/notification.py`

- **What:** Accepting a pending follow request creates `request_accepted` for the requester. Private-to-public auto-accept uses the same notification type.

### NOTIF-R-005 — Mention Notifications

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/models/notification.py`, `api/alembic/versions/20260901_0012_add_mention_notification.py`, `web/components/mention-text.tsx`, `web/components/feed-post.tsx`, `web/components/notifications-screen.tsx`, `web/components/app-shell.tsx`

- **What:** A post mentioning an existing username creates one `mention` notification for each distinct mentioned user other than the author. The notification identifies the author and links to the canonical post containing the mention.
- **Edge cases:** Repeated mentions in one post are deduplicated. Unknown usernames and self-mentions do not create notifications. Mention text is linked to the referenced profile in post and quoted-post views.

### NOTIF-R-006 — Composer Mentions Resolve To Editable Identity Tokens

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [profiles](units/profiles.md), [notifications](units/notifications.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/mention-input.tsx`, `web/components/composer.tsx`, `web/components/mention-text.tsx`, `api/app/services/posts.py`

- **What:** In post, reply, and quote composers, typing a valid `@username` followed by a space resolves that user and displays an editable inline token with their small profile picture and `@username`.
- **Edge cases:** Unknown usernames remain ordinary text and cannot create mention notifications. Editing a resolved token unwraps it to ordinary text so mistakes can be corrected. In rendered posts, mentions remain compact clickable `@username` profile links without repeating the avatar.

### NOTIF-R-007 — Manual Subscription Changes Notify The Recipient

- **Status:** Active
- **Effective:** 2026-09-22T12:33:44Z
- **Related units:** [subscriptions](units/subscriptions.md), [notifications](units/notifications.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/notification.py`, `api/app/services/subscriptions.py`, `api/alembic/versions/20260922_0052_subscription_notifications.py`, `web/components/app-shell.tsx`, `web/lib/auth.ts`

- **What:** A staff grant, plan change, or return-to-Free mutation creates one unread in-app notification for the affected user. The notification identifies the resulting access state and links to the Subscription settings tab. The entitlement mutation remains successful if external delivery is unavailable; the in-app record is part of the mutation transaction.
- **Edge cases:** Indefinite access is identified as having no expiration. Replacing an active assignment uses the changed-access notification; revocation identifies the previous plan and the resulting Friink Free state. Staff reasons are not exposed to the user. Notification read state remains governed by `NOTIF-R-001`.

## Web Navigation & Client Behavior

### CLIENT-R-001 — Profile Message Action Opens Direct Chat

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [chat](units/chat.md), [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/chat/chat-client.tsx`

- **What:** On another user's profile, the paper-plane Message action is an active button that navigates to the username-scoped `/{username}/chat` route. The self-profile variant continues to show Edit instead.
- **Edge cases:** The chat route and API enforce the mutual accepted-follow policy; navigation itself does not bypass authorization. The profile message action must not be rendered as a decorative or inert control.

### CLIENT-R-002 — Profile Connection State Resolves Before Actions

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [profiles](units/profiles.md), [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `web/components/app-shell.tsx`, `web/components/profile-screen.tsx`, `api/app/routers/connections.py`, `api/app/services/connections.py`

- **What:** When an other-user profile resolves, its Follow/Following/request action must resolve from the authenticated connection-status API rather than retaining the self-profile state from the initial loading render.
- **Edge cases:** While status is loading, the profile may temporarily show the neutral Follow action; failures fall back to the actionable neutral state. The self-profile continues to show Edit. The Message action still routes to chat, whose API enforces mutual accepted follows.

### CLIENT-R-003 — Incoming Requests Are Available In The Owner's Connections

- **Status:** Superseded by [CONN-R-011](#conn-r-011--requests-tab-is-private-account-ui)
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `web/components/app-shell.tsx`, `web/components/connections-screen.tsx`, `api/app/routers/connections.py`, `api/app/services/connections.py`

- **What:** The former contract always exposed Requests to the signed-in account, including public accounts. It was replaced by the privacy-aware Connections rule so the UI matches the account's follow semantics.
- **Edge cases:** The authenticated request endpoints remain available as API contracts; this superseded client rule did not authorize exposing another user's request queue.

### CLIENT-R-004 — Floating Post Composer Expands Above Its Controls

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [posts](units/posts.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/composer.tsx`, `web/components/mention-input.tsx`, `web/app/globals.css`

- **What:** The floating post composer has no field background or border. Once typing begins, its text editor occupies the full-width top row and grows upward to eight lines; longer drafts scroll within the editor. Attachment, character count, and send controls remain in the bottom row.
- **Edge cases:** Empty composers retain the compact single-row layout. Chat composers are not changed by the post-composer expansion behavior. Profile pages do not render the standalone new-post composer, but do render a contextual composer after Reply or Quote is selected on a profile post.

### CLIENT-R-005 — Composer Text Is Session-Local

- **Status:** Active
- **Effective:** 2026-09-22T23:41:02Z
- **Related units:** [feed](units/feed.md), [posts](units/posts.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/composer.tsx`, `web/components/app-shell.tsx`, `web/app/posts/[postId]/post-client.tsx`, `web/app/[username]/[postId]/post-client.tsx`

- **What:** Composer text is held in the owning screen's in-memory state only. The shared Composer does not read or write browser storage, so unmounting a feed, post, reply, quote, or chat composer clears its text.
- **Edge cases:** Failed submissions still preserve the current mounted draft for retry; successful submissions continue to clear it through the existing submit flow.

### CLIENT-R-017 — Profile Posts Open Contextual Reply And Quote Composition

- **Status:** Active
- **Effective:** 2026-09-22T23:44:25Z
- **Related units:** [profiles](units/profiles.md), [posts](units/posts.md)
- **Source:** Current implementation
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/profile-screen.tsx`, `web/components/feed-post.tsx`

- **What:** Reply and Quote controls on visible profile posts invoke the shared AppShell composer with the selected post as context. The contextual composer is shown on the profile surface and submits through the existing authenticated post flow.
- **Edge cases:** Profile pages still hide the standalone new-post composer; clearing the context returns to the profile without opening an empty composer.

### CLIENT-R-005 — API Origin Resolution

- **Status:** Active
- **Effective:** 2026-08-29T10:40:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/lib/api-origin.ts`, `web/lib/auth.ts`

- **What:** Web API calls use `NEXT_PUBLIC_API_BASE_URL` when configured. Localhost browsing falls back to `http://localhost:8000`. Deployed browser contexts without an API origin throw a configuration error instead of silently calling localhost.
- **Edge cases:** If the configured origin is `https://staging-api.friink.com` and a network-level fetch fails for a safe read (`GET`, `HEAD`, or `OPTIONS`), the client retries `https://api.friink.com`. Mutations are never retried across origins because replaying them could duplicate or misroute user data.

### CLIENT-R-006 — Public Pages Use Explicit Session Routing

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/page.tsx`, `web/app/subscriptions/page.tsx`, `web/components/public-header.tsx`, `web/lib/auth.ts`

- **What:** The public landing page checks for an existing non-demo session before rendering its content. A successful refresh routes authenticated visitors to `/home`; confirmed signed-out visitors may remain on the landing page. `/subscriptions` remains accessible without authentication.
- **Edge cases:** The landing route shows explicit loading and recoverable-error states during session checking; it does not silently treat network, timeout, CORS, or server failures as signed out. Demo sessions are not treated as signed-in public sessions.

### CLIENT-R-007 — Public Header Uses Signed-In Account Menu

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [account-access](units/account-access.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/public-header.tsx`, `web/components/action-menu.tsx`, `web/lib/auth.ts`

- **What:** The shared public header shows `Get started` linking to the feature-flagged progressive `/start` entry and a secondary legacy `Login` action linking to `/login` to signed-out visitors. Both actions remain visible on desktop and mobile; narrow screens use compact sizing rather than hiding either action. Authenticated visitors see the signed-in user's profile picture instead. Clicking the picture opens the reusable account menu directly below the picture with a 2px gap and 2px right offset; it shows the user's profile information, Feed (`/home`), Settings (`/settings`), and Log out.
- **Edge cases:** If progressive login is disabled, `/start` falls back to `/login`. The Friink logo remains the public landing-page link; the public header does not add a redundant Home link. Logout clears the persisted client session and leaves the user on the public site.

### CLIENT-R-008 — Internal Account Identifiers Are Not User-Facing

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/account-screens.tsx`

- **What:** Database UUIDs and other internal implementation identifiers are not displayed in the normal Settings > Account screen.
- **Edge cases:** If support tooling later needs an account identifier, it should be provided through a deliberate support/advanced flow rather than the default account settings surface.

### CLIENT-R-009 — Public Plans Are Informational Until Billing Exists

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [subscriptions](units/subscriptions.md), [feed](units/feed.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/page.tsx`, `web/app/subscriptions/page.tsx`, `web/app/landing.module.css`

- **What:** The public landing page includes a concise Plans section and links to `/subscriptions` for the full Free, Pro, and Pro+ comparison. Free signup links to `/login`; paid plan cards display `Coming soon` until billing and checkout are implemented.
- **Edge cases:** This page does not create subscriptions, process payments, or grant paid entitlements. The displayed plan benefits and prices are marketing content and must be updated with the subscription implementation before paid launch.

### CLIENT-R-010 — Subscription Settings Shows The Server-Resolved Plan And Available Plans

- **Status:** Active
- **Effective:** 2026-09-01T00:00:00Z
- **Related units:** [subscriptions](units/subscriptions.md), [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/account-screens.tsx`, `web/app/settings/[tab]/page.tsx`, `web/app/subscriptions/page.tsx`, `web/app/globals.css`

- **What:** Authenticated Settings includes a dedicated `/settings/subscription` tab showing the server-resolved effective plan's name, price, status, and expiry (or no expiration), followed by divider-bounded Free, Pro, and Pro+ plan rows. The active plan is marked `Current`; paid plan actions display disabled `Coming soon` states while billing is inactive. Plan rows present the implemented PRD benefits: Free includes unlimited posts/replies/quotes, mutual-follower chat, and professional use; Pro adds message requests, profile view count, 512-character posts, and directory listing for registered professionals; Pro+ adds profile/post analytics, feed profile boost, and fewer ads. Billing and self-service plan changes are not active.
- **Edge cases:** The comparison is presentation-only even though the API entitlement foundation exists; this tab does not process upgrades, payments, cancellations, or paid access. The authenticated screen does not repeat the public availability note because each paid row already communicates `Coming soon`.

### CLIENT-R-011 — Landing Newsletter Uses Zoho Form Submission

- **Status:** Active
- **Effective:** 2026-08-18T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/app/subscribe-form.tsx`, `web/app/page.tsx`

- **What:** The landing-page subscribe form submits the `Email` field to the configured Zoho Forms endpoint through a hidden iframe target and then disables the form with a submitted state.
- **Edge cases:** The submitted state is deferred briefly so the native form submission includes the email input.

### CLIENT-R-012 — Chat Uses REST With Polling Delivery

- **Status:** Active
- **Effective:** 2026-09-01T16:00:00Z
- **Related units:** [chat](units/chat.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/chat.py`, `api/app/models/user.py`, `api/app/models/notification.py`, `api/app/routers/chat.py`, `api/app/services/chat.py`, `api/app/schemas/chat.py`, `api/alembic/versions/20260902_0016_add_chat_requests_and_settings.py`, `web/lib/auth.ts`, `web/lib/chat-transport.ts`, `web/app/[username]/chat/chat-client.tsx`, `web/components/screens.tsx`

- **What:** Chat uses authenticated REST endpoints for conversation discovery, conversation creation, message history, message sending, request acceptance, per-user settings, read-cursor updates, and the persisted read-receipt privacy preference. Mutual accepted follows enable immediate chat. A user with the server-resolved `message_requests` entitlement may initiate a non-mutual request with a maximum of eight requester-authored messages while pending; the receiver accepts by button or reply, and a reply automatically unlocks two-way chat. Active conversations and the `/chats` conversation list poll every 4 seconds through guarded transport/state loops; both pause while the document is hidden and resume immediately on focus/visibility recovery.
- **Edge cases:** Pending requests appear in Requests for both participants and move to All Chats only after acceptance; declined requests leave Requests and are unavailable. The receiver's pending composer says `Reply to accept.`; the requester is disabled after eight messages with `Request pending.`; free non-mutual users are disabled with a generic placeholder; blocked or no-longer-mutual accepted chats are read-only with `Chat unavailable.`. Message history is incremental and cursor-based, messages are deduplicated by server ID, server timestamps determine ordering, and sends include a client message ID. Mute suppresses chat notifications for that user while preserving the current tab; archive moves the chat to Archived and implies mute, with explicit mute surviving unarchive. The composer must not be disabled merely because transport or history loading failed. Subscription checkout/billing remains future work; blocking and profile access enforcement are governed by their active rules. See `docs/archives/chat-behavior.md`.

### CLIENT-R-013 — Chat Read Receipts Use Per-User Cursors

- **Status:** Active
- **Effective:** 2026-09-02T00:00:00Z
- **Related units:** [chat](units/chat.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `api/app/models/chat.py`, `api/app/models/user.py`, `api/app/routers/chat.py`, `api/app/services/chat.py`, `api/app/schemas/chat.py`, `api/alembic/versions/20260902_0017_add_chat_read_receipts.py`, `web/lib/auth.ts`, `web/lib/chat-transport.ts`, `web/app/[username]/chat/chat-client.tsx`, `web/components/screens.tsx`, `web/app/globals.css`, `docs/archives/read-receipts.md`

- **What:** Chat exposes sent, delivered, and read states. A visible app-level inbox sync or the full conversation endpoint records delivery; the visible conversation advances the viewer's read cursor through an idempotent endpoint. Polling returns receipt metadata even without new messages, so tick state can change on the existing 4-second cycle.
- **Edge cases:** Unread counts include only incoming messages; a user's own outgoing messages are never unread for that user. Counts appear in the conversation-row state line plus an in-conversation unread separator. Pending requests use the same receipt rules without treating read as acceptance. A visible inbox sync marks discovered incoming messages delivered, but only viewport visibility/scroll advances read state. Read cursors advance monotonically across earlier messages and receipt/unread state synchronizes across refreshes, devices, and browser tabs. Mute and archive do not change receipt state. Blocked conversations do not advance or expose delivery/read receipts while the block is active. Read receipts use mutual privacy: both users must have the preference enabled; disabling the setting hides both participants' read state while delivery remains visible. The preference is persisted and editable in Settings > Privacy. Chat messages are limited to 2,048 Unicode characters.

### CLIENT-R-014 — Chat List Refreshes Through Visibility-Aware Polling

- **Status:** Active
- **Effective:** 2026-09-02T00:00:00Z
- **Related units:** [chat](units/chat.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/screens.tsx`, `web/lib/auth.ts`, `docs/archives/chat-behavior.md`

- **What:** The `/chats` conversation-list screen refreshes `GET /chat/conversations` every 4 seconds while visible. Each response refreshes previews, latest-activity ordering, unread counts, unread styling, and the row state for the currently selected All, Muted, Requests, or Archived tab.
- **Edge cases:** Polling pauses without requests or timer rescheduling while the document is hidden, resumes immediately on visibility or focus recovery, prevents overlapping requests, and cleans up its timer and listeners on unmount. The server remains authoritative for filtering and unread counts; no database migration or separate unread-count endpoint is required.

### CLIENT-R-014A — Chat Rows Separate Identity From Conversation State

- **Status:** Active
- **Effective:** 2026-09-21T00:00:00Z
- **Related units:** [chat](units/chat.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web/API
- **File(s):** `api/app/schemas/chat.py`, `api/app/services/chat.py`, `web/lib/auth.ts`, `web/components/screens.tsx`, `web/app/globals.css`

- **What:** Conversation rows render one full ProfileCard identity on the left. A flexible middle column shows the latest message preview for up to two lines with ellipsis truncation, followed by the relative date and unread/receipt state. States with dedicated tabs—Muted, Requests, and Archived—are represented by those tabs only and must not be repeated as row metadata elsewhere. Mute, Archive, and Block are exposed through one overflow action menu.

### CLIENT-R-014B — Direct Chat Uses Document Scrolling

- **Status:** Active
- **Effective:** 2026-09-21T00:00:00Z
- **Related units:** [chat](units/chat.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web only
- **File(s):** `web/app/[username]/chat/chat-client.tsx`, `web/app/globals.css`, `web/components/app-shell.tsx`

- **What:** Username-scoped conversation pages use the document viewport as their only vertical scroll surface for message history. The participant header remains fixed below the global top bar and aligned to the centered `ContentBox` chat column; on desktop, its opaque background spans the full main panel so the message list cannot show through beside the capped column. The message list must not create a nested scroll container or widen beyond the shared content cap. Shared shell bottom padding does not compound the chat message-list reservation. The fixed contextual composer remains clear of the final message with a consistent 1rem gap across viewport sizes, and read-state visibility uses the document viewport.

### CLIENT-R-014C — Direct Chat Restores Session On Refresh

- **Status:** Active
- **Effective:** 2026-09-22T11:19:27Z
- **Related units:** [chat](units/chat.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web only
- **File(s):** `web/app/[username]/chat/chat-client.tsx`, `web/components/app-shell-route.tsx`, `web/lib/auth.ts`

- **What:** Username-scoped conversation pages restore the authenticated session through the shared refresh flow when a full browser refresh clears the in-memory access session. A successful refresh keeps the user on the requested conversation; terminal refresh failures route to login.

### CLIENT-R-014D — Chat Media Reuses Post Compression

- **Status:** Active
- **Effective:** 2026-09-23T01:20:00Z
- **Related units:** [chat](units/chat.md), [media](units/media.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web/API
- **File(s):** `web/lib/image-compression.ts`, `web/lib/auth.ts`, `web/app/[username]/chat/chat-client.tsx`, `web/components/chat-media-gallery.tsx`, `web/app/globals.css`, `api/app/routers/chat.py`, `api/app/models/chat.py`

- **What:** Chat messages accept up to eight JPEG-normalized images using the post-media preparation target of a 1024px maximum longest edge and approximately 500KB per image. The API confirms authenticated chat-media keys before associating them with a message; text-only and media-only messages are valid. Attached images render in a bounded deterministic gallery: one image preserves its aspect ratio in a contained frame, two to four images use balanced tiles, and the fourth tile shows a `+N` overflow indicator. Selecting a tile opens the shared full-screen viewer with previous/next/close controls, keyboard navigation, and a counter.

### CLIENT-R-014E — Chat Uses Canonical Conversation-ID Routes

- **Status:** Active
- **Effective:** 2026-09-23T20:40:24Z
- **Related units:** [chat](units/chat.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/chat.py`, `api/app/services/chat.py`, `web/lib/auth.ts`, `web/app/chats/[conversationId]/page.tsx`, `web/app/chats/new/page.tsx`, `web/app/chat/new/page.tsx`, `web/app/[username]/chat/chat-client.tsx`

- **What:** Existing conversations use `/chats/{conversation_id}` as the canonical web route, and the API authorizes `GET /chat/conversations/{conversation_id}` against the authenticated participant. `/{username}/chat` and `/chats/{username}` remain compatibility entry points and redirect to the canonical ID route when the username resolver returns an existing conversation. `/chat` redirects to `/chats`, `/chat/new` redirects to `/chats/new`, and bare `/{conversation_id}` remains in the profile namespace.
- **Edge cases:** Username routes remain available when no conversation exists yet so request creation still follows the existing first-message policy. An unauthorized or unknown conversation ID is returned as not found by the API. `/chats/new` hosts the one-person discovery modal; group selection remains unavailable.

### CLIENT-R-014F — New Chat Discovery Uses Server-Filtered Suggestions

- **Status:** Active
- **Effective:** 2026-09-23T21:21:33Z
- **Related units:** [chat](units/chat.md), [search](units/search.md), [connections](units/connections.md), [blocking](units/blocking.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** Web/API
- **File(s):** `api/app/routers/chat.py`, `api/app/services/chat.py`, `api/app/schemas/chat.py`, `web/app/chats/new/page.tsx`, `web/components/new-chat-screen.tsx`, `web/lib/auth.ts`, `web/app/globals.css`

- **What:** `/chats/new` searches after two characters through `GET /chat/people`, matching active profiles by username or display name. The API excludes the viewer, blocked profiles, inactive/deleted profiles, and private profiles unless the viewer has an accepted follow relationship to them. Suggestions show profile picture, display name, and username. Selecting one person checks eligibility through the read-only `GET /chat/people/{username}/eligibility` endpoint; `Next` repeats that check and uses the authenticated chat resolver before navigation. Existing conversations use `/chats/{conversation_id}`, while a new eligible request continues through the username route until the first message creates its conversation.
- **Edge cases:** Results are debounced and bounded to 20. Search loading, empty, and retryable error states are explicit. Ineligible or inaccessible identities use neutral unavailable copy. Account switching clears the query, results, selection, and validation state. Closing the modal returns to `/home`. Only one person can be selected; group creation remains unavailable.

### CLIENT-R-014G — Chat Access And Shared Behavior Use Active Memberships

- **Status:** Active
- **Effective:** 2026-09-23T21:44:20Z
- **Related units:** [chat](units/chat.md), [search](units/search.md), [blocking](units/blocking.md), [notifications](units/notifications.md)
- **Source:** [chat unit](units/chat.md)
- **Platform:** API
- **File(s):** `api/app/models/chat.py`, `api/app/services/chat.py`, `api/app/routers/chat.py`, `api/app/routers/search.py`

- **What:** Active `conversation_members` rows authorize conversation access and drive conversation lists, direct-chat resolution, message and media reads, read state, search visibility, and notification fan-out. New direct conversations create a membership row for each participant; legacy pair columns remain compatibility fields for direct chats. Group APIs and group reads require `GROUP_CHAT_ENABLED`, which defaults to false; group conversations are omitted from search while disabled.
- **Edge cases:** Departed members lose conversation access. Group receipt state is `read` only after all active recipients read and `delivered` only after all active recipients receive the message. Per-member read-receipt preferences and mute/archive settings apply. Enabling group chat remains gated on product approval and migration/release verification.

### CLIENT-R-015 — Appearance And Sidebar Preferences Use Cookies

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Related units:** [settings](units/settings.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/account-screens.tsx`

- **What:** The web app stores appearance (`light`, `dark`, or `system`) and desktop sidebar collapsed state in cookies for one year.

### CLIENT-R-016 — Profile Identity And Actions Are Client-Mapped

- **Status:** Active
- **Effective:** 2026-08-26T00:00:00Z
- **Related units:** [profiles](units/profiles.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/profile-client.tsx`

- **What:** The web profile screen treats the signed-in user's profile as self and other username routes as other-user profiles. Self-profile shows Edit; other-user profiles show follow/request/following state plus a message icon.
- **Edge cases:** Counts include accepted connections only, matching the Connections endpoints; pending, rejected, and canceled relationships are excluded. Self-profile Connections shows the signed-in user's data and request behavior; `/{username}/connections` is the canonical username-scoped route for the requested user's directory.
- **URL State:** Connections uses the username-scoped route `/{username}/connections`, with `/{username}/connections/followers`, `/{username}/connections/following`, and `/{username}/connections/requests` for filtered tabs. Selecting `All` returns to the base route. Legacy `/connections` routes remain compatibility entry points only.

## Infrastructure & Deployment

### INFRA-R-001 — Current Web And API Runtime Baseline

- **Status:** Active
- **Effective:** 2026-09-09T20:55:02Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `package.json`, `web/package.json`, `web/tsconfig.json`, `api/requirements.txt`

- **What:** The web runtime baseline is Next.js 16.3.4 with React 19.3.0 and asynchronous App Router `params`/`searchParams`. The currently installed API baseline is FastAPI 0.141.1 with Uvicorn; `api/requirements.txt` remains intentionally unpinned.
- **Compatibility:** Local Windows development may use Next's `--webpack` fallback when the native SWC binding is unavailable. This is a tooling accommodation and does not change the production deployment contract.

### INFRA-R-002 — Staging And Production Use Separate Databases

- **Status:** Active
- **Effective:** Not recorded
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Not recorded in historical `RULES.md`
- **File(s):** Not recorded in historical `RULES.md`

- **What:** `api-staging` uses the existing staging Neon database and `api-production` uses its separate production Neon database. The production database is currently hosted temporarily on Neon and is planned to move to the Droplet later. The web projects do not receive `DATABASE_URL`; they receive only their environment-specific `NEXT_PUBLIC_API_BASE_URL`.
- **Do not:** Treat rows, object keys, sessions, or media URLs from one deployed environment as available in the other environment. Do not add a media bucket/environment identifier column as a workaround for the old shared-database topology.
- **Deployment:** Apply the full Alembic chain to a new production database before deploying production API code. A fresh production database must reach the repository head and pass `alembic check`; staging migrations and data remain independent.

### INFRA-R-003 — Media Storage Follows The API Environment

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [connections](units/connections.md), [media](units/media.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Not recorded in historical `RULES.md`
- **File(s):** Not recorded in historical `RULES.md`

- **What:** Avatar and post-media upload services use the active API environment's `R2_BUCKET_NAME`; public delivery uses its configured `R2_PUBLIC_URL`. Staging uses `friink-staging`; production uses `friink-prod-media` with `https://media.friink.com`.
- **Edge cases:** Media rows are safe across environments because the databases are separate. New profile-picture records store an object key, while existing post-media records retain their key and URL fields. Browser viewing requires readable delivery URLs; a private-bucket deployment must use short-lived signed download URLs while upload may continue using presigned `PUT` URLs. No bucket/environment column is required while database isolation is maintained.

### INFRA-R-004 — FastAPI Uses Sync SQLAlchemy Sessions

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/db.py`, `api/alembic/env.py`, `api/requirements.txt`, `api/api/index.py`

- **What:** The backend uses FastAPI with synchronous SQLAlchemy sessions and psycopg3 database URLs. Alembic migrations define the database schema.

### INFRA-R-005 — Deployment-Neutral Database Connection Management

- **Status:** Active
- **Effective:** 2026-09-10T01:00:00Z
- **Related units:** [connections](units/connections.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API/infrastructure
- **File(s):** `api/app/db.py`, `api/app/config.py`, the environment-specific API files, `README.md`, `docs/archives/auth-and-session.md`

- **What:** Database connection management must remain portable across Neon and the planned Ubuntu deployment. Pool behavior is configured by environment, not by platform-specific application branches. The default is a small SQLAlchemy pool (3 base connections plus 2 overflow connections, with pre-ping, LIFO reuse, recycling, and a bounded checkout timeout); pooling can be disabled explicitly when a runtime requires short-lived connections.
- **Edge cases:** Neon Free has scale-to-zero and connection limits, so a small pool must not be treated as a promise to keep the database warm. Ubuntu values may be increased only after accounting for API worker count and PostgreSQL `max_connections`; total connections across workers and processes are the controlling limit. The local post-pooling sample improved switch completion to approximately 1.0–1.7 seconds, but account-list refresh still reached approximately 12 seconds; continue treating refresh latency as a separate investigation.

### INFRA-R-006 — CORS Allows Configured Frontend And Local Development

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/main.py`, `api/app/config.py`

- **What:** The API allows CORS from `FRONTEND_URL`, `http://localhost:3000`, `http://127.0.0.1:3000`, and explicitly `https://staging.friink.com`.

### INFRA-R-007 — Development Uses An Isolated Database And Branch Flow

- **Status:** Active
- **Effective:** 2026-09-08T22:33:11Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `README.md`, the environment-specific API files, `api/alembic/`

- **What:** The `development` branch is the local implementation and rehearsal
- **Do not:** Commit `.env.development`, `.env.staging`, or secrets. Do not use
- **Migration:** Bring a fresh development database to the Alembic head and

### INFRA-R-008 — Database Health Endpoint Checks Connectivity Only

- **Status:** Active
- **Effective:** 2026-08-27T00:00:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `api/app/main.py`

- **What:** `GET /` returns the minimal public service response `{"service":"friink-api","status":"ok"}`. `GET /health` returns the dependency-free liveness response `{"status":"ok"}`. `GET /health/db` opens a psycopg connection and runs `SELECT 1`, returning `{"database": true}` on success.
- **Edge cases:** This endpoint does not verify ORM schema compatibility; ORM-backed endpoint checks are still needed after migrations.

### INFRA-R-009 — Account Lifecycle Uses Owner-Verified State Transitions

- **Status:** Active
- **Effective:** 2026-09-05T22:32:26Z
- **Related units:** [account-access](units/account-access.md), [account-lifecycle](units/account-lifecycle.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** All
- **File(s):** `docs/archives/account-lifecycle.md`, `docs/archives/auth-and-session.md`

- **What:** Accounts may be `active`, `deactivated`, `pending_deletion`, or `deleted`. Deactivation requires current-password confirmation only; deletion requires current-password confirmation plus OTP when the API OTP master switch is enabled. Reactivation requires valid credentials plus fresh OTP when that switch is enabled and creates only one new session; prior sessions and remembered device credentials are not restored. The product UI is owner-only, while staff retain protected backend recovery capability.
- **Edge cases:** Deactivation revokes all sessions and refresh families and immediately rejects access for the inactive account. The account's email and username remain reserved until permanent deletion; the account is removed from directories/search, standard notifications are suppressed, and it cannot send or receive new messages. Existing chats remain readable and read-only, and retained identity renders as `Friink User` with the real username and default avatar. Deletion is cancellable for 32 days, including the final hour before the deletion transaction, then removes public/user-generated content while retaining restricted UUID tombstones, identity history, required billing/security records, and chats as `Account Deleted`.
- **Billing:** The contract requires deactivation not to pause/cancel subscriptions and deletion to cancel billing immediately; the billing-provider adapter is not yet wired, so this behavior must not be represented as verified until that integration is delivered. Reactivation must not resume a cancelled subscription.
- **Cooldown:** After reactivation, the same account cannot be deactivated again for 8 minutes (480 seconds). A blocked attempt returns `429`, and the web UI surfaces the server-provided remaining time in a live countdown toast.
- **Security:** Inactive-account failed logins never send email and use only minimal restricted internal events. Unknown identifiers and wrong passwords remain lifecycle-state agnostic. Valid credentials for deactivated or pending-deletion accounts enter only the narrowly scoped reactivation flow; they do not create a normal session until the required confirmation and OTP succeed. Successful reactivation creates one new session and does not restore previous sessions or remembered-device credentials.

### INFRA-R-010 — Resend Uses One Verified Domain With Centralized Sender Aliases

- **Status:** Active
- **Effective:** 2026-09-06T23:30:00Z
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API
- **File(s):** `api/app/config.py`, `api/app/services/email.py`, the environment-specific API files

- **What:** The API configures one verified `RESEND_FROM_DOMAIN` and generates sender addresses centrally by message purpose: `noreply` for OTP, `hello` for welcome messages, and `security` for security messages. `RESEND_API_KEY` remains server-side only.
- **Edge cases:** The domain must be verified in Resend, sender aliases must not be repeated across environment variables or email methods, and the full sender address must never be supplied by the frontend. Staging and production configure their own provider credentials and verified sender domain.

### INFRA-R-011 — Blocking Is Bilateral And Irreversible For Relationships

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [account-access](units/account-access.md), [connections](units/connections.md), [blocking](units/blocking.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web/API
- **File(s):** `docs/archives/blocking.md`, `api/app/services/blocking.py`, `api/app/routers/users.py`, `api/app/services/chat.py`

- **What:** A signed-in user can block another user from that user's profile overflow menu regardless of follow state, chat state, or subscription tier. Blocking removes accepted and pending follow relationships in both directions transactionally. Unblocking never restores them. Both users lose profile access, follow access, and message sending, while existing chats remain readable and read-only.
- **Edge cases:** Blocking is confirmed in the shared modal. Pending chat requests remain in Requests but become read-only; a blocked pending request freezes its requester-message count and does not reset or extend the eight-message cap. Existing notifications and messages are retained, and blocking creates no notification. The blocked-people settings action provides case-insensitive database-backed search, opaque-cursor loading, and confirmed unblocking. Blocked-list profile cards remain clickable but resolve to the neutral `Profile unavailable.` state. Direct profile URLs behave the same way. Block access checks are bilateral and server-authoritative; self-blocking is rejected.

### INFRA-R-012 — OTP And Approval Paths Are Mutually Exclusive In The UI

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** Web
- **File(s):** `web/components/login-screen.tsx`, `docs/archives/auth-and-session.md`

- **What:** The login screen may offer emailed OTP and existing-session approval for the same challenge, but once OTP entry begins, approval-status polling must stop. A late approval status cannot overwrite OTP validation, submission, or successful navigation.
- **Edge cases:** Editing the OTP clears stale approval messaging. Polling must not run during OTP submission. The backend remains authoritative for whether the submitted OTP is valid or expired.

### INFRA-R-013 — Login Challenge Completion Is Server-Authoritative

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API/Web
- **File(s):** `api/app/services/login_challenges.py`, `api/app/routers/auth.py`, `api/app/schemas/auth.py`, `web/lib/auth.ts`, `web/components/login-screen.tsx`

- **What:** OTP verification, existing-session approval, and denial compete on one login challenge. The API serializes transitions, preserves the first terminal outcome, and reports `otp_verified` when OTP consumed the challenge without approval winning.
- **Edge cases:** A delayed status response must not turn a completed OTP challenge into `expired`; the frontend may defensively ignore stale responses, but correctness belongs to the API. Completion remains single-use and must preserve add-account/device-slot behavior.

### INFRA-R-014 — Do Not Overstate OTP Concurrency Verification

- **Status:** Active
- **Effective:** Not recorded
- **Related units:** [account-access](units/account-access.md)
- **Source:** [archived RULES.md](archives/RULES.md)
- **Platform:** API/Web
- **File(s):** `docs/archives/auth-and-session.md`, `docs/archives/latency.md`, `api/tests/`

- **What:** A successful single-browser OTP redirect verifies the normal challenge flow only. It is not evidence that concurrent OTP, approval, or duplicate completion requests were serialized correctly.
- **Edge cases:** Documentation and release notes must distinguish normal-flow staging evidence from direct API status assertions and backend concurrency tests. The concurrency gate remains open until those tests exist and pass.

## Unit rule cross-reference

The unit documents also carry local rule IDs for detailed traceability. These entries are implementation-backed where the source unit marks them as active; they are indexed here so agents can discover them from one place. The unit document remains the canonical home for the full wording and evidence.

| Unit | Rule ID | Summary |
|---|---|---|
| [account-access](units/account-access.md) | ACCESS-R-001 | Email ownership is the signup verification boundary. |
| [account-access](units/account-access.md) | ACCESS-R-002 | Completed signup creates a normalized unique email, |
| [account-access](units/account-access.md) | ACCESS-R-003 | API and database constraints are authoritative for identity |
| [account-access](units/account-access.md) | ACCESS-R-004 | OTP configuration is API-owned; production keeps the master |
| [account-access](units/account-access.md) | ACCESS-R-006 | Email and username matching is case-insensitive; a leading |
| [account-access](units/account-access.md) | ACCESS-R-007 | Passwords require at least eight characters, upper/lowercase |
| [account-access](units/account-access.md) | ACCESS-R-008 | Failed-login behavior follows the active schedule in |
| [account-access](units/account-access.md) | ACCESS-R-009 | Ordinary account locking blocks password login and refresh; |
| [account-access](units/account-access.md) | ACCESS-R-010 | Risk is server-authoritative; recognized devices may proceed |
| [account-access](units/account-access.md) | ACCESS-R-011 | OTP and approval cannot both complete one challenge. |
| [account-access](units/account-access.md) | ACCESS-R-012 | Existing sessions never display plaintext OTP or sensitive |
| [account-access](units/account-access.md) | ACCESS-R-014 | Access tokens use the current 30-minute implementation |
| [account-access](units/account-access.md) | ACCESS-R-015 | Refresh tokens are opaque, HttpOnly on web, stored by hash, |
| [account-access](units/account-access.md) | ACCESS-R-016 | Presenting a rotated/revoked token revokes its family and |
| [account-access](units/account-access.md) | ACCESS-R-017 | Refresh is reactive and occurs only after `TOKEN_EXPIRED`. |
| [account-access](units/account-access.md) | ACCESS-R-018 | Ambiguous refresh failures preserve local access state. |
| [account-access](units/account-access.md) | ACCESS-R-019 | Logout revokes only the relevant session/family. |
| [account-access](units/account-access.md) | ACCESS-R-020 | Users may inspect or revoke only their own sessions. |
| [account-access](units/account-access.md) | ACCESS-R-021 | The current session is protected and survives revoke-others. |
| [account-access](units/account-access.md) | ACCESS-R-022 | Missing device metadata renders an explicit fallback. |
| [account-access](units/account-access.md) | ACCESS-R-023 | Ordinary revocation does not promise retroactive invalidation |
| [account-access](units/account-access.md) | ACCESS-R-024 | Remembered accounts are device-scoped slots, not account |
| [account-access](units/account-access.md) | ACCESS-R-025 | Switching validates opaque slot, device, session, and |
| [account-access](units/account-access.md) | ACCESS-R-026 | The default slot limit is four; the operational range is |
| [account-access](units/account-access.md) | ACCESS-R-027 | Adding an already remembered account reuses its slot. |
| [account-access](units/account-access.md) | ACCESS-R-028 | Switching refreshes account-scoped shell, feed, |
| [account-access](units/account-access.md) | ACCESS-R-029 | Failed list, add, switch, logout, refresh, or slot operations |
| [account-access](units/account-access.md) | ACCESS-R-030 | Active logout selects the most-recent remaining valid slot |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-001 | Profile setup resumes until complete; optional steps remain |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-002 | Deactivation requires the current password, ends all |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-003 | Deletion requires current-password confirmation followed by a |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-004 | Reactivation and pending-deletion cancellation require the |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-005 | Existing access tokens are rejected for inactive lifecycle |
| [account-lifecycle](units/account-lifecycle.md) | LIFE-R-006 | Lifecycle operations are owner-verified, idempotent where |
| [blocking](units/blocking.md) | BLOCK-R-001 | A signed-in user may block another user from that user's |
| [blocking](units/blocking.md) | BLOCK-R-002 | Blocking removes accepted and pending follow relationships |
| [blocking](units/blocking.md) | BLOCK-R-003 | Unblocking never restores removed relationships. |
| [blocking](units/blocking.md) | BLOCK-R-004 | Blocking is bilateral for profile, follow, and message access. |
| [blocking](units/blocking.md) | BLOCK-R-005 | Existing chats and pending requests remain readable but are |
| [blocking](units/blocking.md) | BLOCK-R-006 | Blocking creates no notification and self-blocking is rejected. |
| [blocking](units/blocking.md) | BLOCK-R-007 | Server-side checks are authoritative for direct URLs and API |
| [chat](units/chat.md) | CHAT-R-001 | Mutual accepted follows enable ordinary direct chat. |
| [chat](units/chat.md) | CHAT-R-002 | A user with the server-resolved message_requests entitlement may initiate a non-mutual request. |
| [chat](units/chat.md) | CHAT-R-003 | Pending requests appear in Requests; accepted conversations |
| [chat](units/chat.md) | CHAT-R-004 | Read receipts are tracked per user with server-authoritative |
| [chat](units/chat.md) | CHAT-R-005 | Visible-app polling is adaptive and pauses while hidden; |
| [chat](units/chat.md) | CHAT-R-006 | Transport failure must remain distinct from policy-disabled |
| [chat](units/chat.md) | CHAT-R-007 | Blocked or no-longer-mutual chats remain readable but read-only |
| [chat](units/chat.md) | CHAT-R-009 | Conversation rows render identity once and use the secondary |
| [chat](units/chat.md) | CHAT-R-011 | Direct chats restore the session after a full browser refresh. |
| [connections](units/connections.md) | CONNECTIONS-R-001 | Relationships are directional; accepted rows count as |
| [connections](units/connections.md) | CONNECTIONS-R-002 | Public accounts accept follows immediately. |
| [connections](units/connections.md) | CONNECTIONS-R-003 | Private accounts require pending requests and expose a |
| [connections](units/connections.md) | CONNECTIONS-R-004 | Rejected and owner-removed requests observe the active |
| [connections](units/connections.md) | CONNECTIONS-R-005 | Changing a private account to public auto-accepts |
| [connections](units/connections.md) | CONNECTIONS-R-006 | Follow counts include accepted relationships only. |
| [connections](units/connections.md) | CONNECTIONS-R-007 | Connection actions resolve from authenticated API |
| [discovery](units/discovery.md) | DISCOVERY-R-003 | The Directory UI uses All and Friink Registered tabs; the |
| [discovery](units/discovery.md) | DISCOVERY-R-004 | Friink registration and credential review are staff-owned API workflows; |
| [feed](units/feed.md) | FEED-R-001 | Home has Explore and Following tabs; Explore is the default. |
| [feed](units/feed.md) | FEED-R-002 | Following contains posts strictly from accounts the viewer |
| [feed](units/feed.md) | FEED-R-003 | Feed pagination and updates use server-authoritative cursors |
| [feed](units/feed.md) | FEED-R-004 | Home restores reading position where the current web contract |
| [feed](units/feed.md) | FEED-R-005 | Profile feeds use the viewed author's scoped collection, not |
| [feed](units/feed.md) | FEED-R-006 | Feed failures preserve usable content and expose retry rather |
| [feed](units/feed.md) | FEED-R-007 | The shared post action row anchors its four actions from the left |
| [feed](units/feed.md) | FEED-R-008 | Post action controls change to the current accent color on hover |
| [media](units/media.md) | MEDIA-R-001 | Post images remain local until submit; up to eight JPEG images |
| [media](units/media.md) | MEDIA-R-002 | Post preparation targets a 1024px maximum longest edge, |
| [media](units/media.md) | MEDIA-R-003 | Profile pictures accept JPG/JPEG, PNG, and WebP, require a |
| [media](units/media.md) | MEDIA-R-004 | The API validates authenticated ownership and key namespace; |
| [media](units/media.md) | MEDIA-R-005 | Failed post submission cleans up uploaded objects and does |
| [media](units/media.md) | MEDIA-R-006 | Successfully associated media is rendered through the shared |
| [media](units/media.md) | MEDIA-R-007 | The last confirmed profile image remains visible until the |
| [navigation](units/navigation.md) | NAV-R-008 | Hover temporarily expands the collapsed drawer on non-touch pointers at tablet and desktop widths. |
| [navigation](units/navigation.md) | NAV-R-009 | Without a saved drawer preference, desktop and tablet start collapsed; mobile always starts collapsed. |
| [navigation](units/navigation.md) | NAV-R-010 | The tablet/desktop drawer remains vertically scrollable while hiding its scrollbar indicator. |
| [notifications](units/notifications.md) | NOTIFY-R-001 | In-app notifications are fetchable, readable, and marked |
| [notifications](units/notifications.md) | NOTIFY-R-002 | Unread count is server-authoritative and uses adaptive |
| [notifications](units/notifications.md) | NOTIFY-R-003 | The header dropdown shows unread items only, is empty at |
| [notifications](units/notifications.md) | NOTIFY-R-004 | The full surface supports All/Security views, unread-only |
| [notifications](units/notifications.md) | NOTIFY-R-005 | Important events are duplicate-safe and delivery failure |
| [notifications](units/notifications.md) | NOTIFY-R-006 | Notification content must not expose secrets, internal IDs, |
| [posts](units/posts.md) | POSTS-R-001 | One posts model stores posts, replies, and quotes; kind and |
| [posts](units/posts.md) | POSTS-R-002 | Post content and media limits are enforced by client hints |
| [posts](units/posts.md) | POSTS-R-003 | Replies preserve their nested conversation tree while visual |
| [posts](units/posts.md) | POSTS-R-004 | Private post visibility is enforced server-side, including |
| [posts](units/posts.md) | POSTS-R-005 | Visible private posts may be quoted by authorized viewers; unavailable quoted originals |
| [posts](units/posts.md) | POSTS-R-006 | Canonical post URLs use author username plus authoritative |
| [posts](units/posts.md) | POSTS-R-007 | Likes and Saves are unique durable reactions per user/content |
| [posts](units/posts.md) | POSTS-R-008 | A post card's non-interactive area navigates to detail; |
| [profiles](units/profiles.md) | PROFILE-R-001 | Usernames are case-insensitive identities and accepted |
| [profiles](units/profiles.md) | PROFILE-R-002 | An unknown username renders `Does not exist or unavailable.` |
| [profiles](units/profiles.md) | PROFILE-R-003 | Profile identity blocks use the shared `ProfileCard` and |
| [profiles](units/profiles.md) | PROFILE-R-004 | Self-profile and other-user profile actions are distinct; |
| [profiles](units/profiles.md) | PROFILE-R-005 | Public profile tabs include posts, replies, and likes only |
| [profiles](units/profiles.md) | PROFILE-R-006 | Empty About text shows no visitor-facing placeholder; the |
| [profiles](units/profiles.md) | PROFILE-R-007 | Profile pictures are optional and retain the last |
| [profiles](units/profiles.md) | PROFILE-R-008 | Profile content requests preserve the API pagination contract. |
| [profiles](units/profiles.md) | PROFILE-R-009 | Other-user connection labels use text-button geometry. |
| [profiles](units/profiles.md) | PROFILE-R-010 | Profile moderation uses the contextual navigation overflow. |
| [profiles](units/profiles.md) | PROFILE-R-011 | Profile bootstrap exposes restoration and retry states. |
| [profiles](units/profiles.md) | PROFILE-R-012 | Professional badge visibility is user-controlled; shared profile badges use the accent-colored compact pill treatment. |
| [search](units/search.md) | WEB-R-018 | Search sort and date refinements are URL-backed and scope-aware. |
| [saved-items](units/saved-items.md) | SAVED-R-001 | Saves are private to the saving user and have no actor list. |
| [saved-items](units/saved-items.md) | SAVED-R-002 | Deleted, private, blocked, or inaccessible content is omitted |
| [saved-items](units/saved-items.md) | SAVED-R-003 | One user has at most one active Save per content object. |
| [saved-items](units/saved-items.md) | SAVED-R-004 | Saved-post navigation uses `/saved/posts`; legacy roots redirect. |
| [settings](units/settings.md) | SETTINGS-R-001 | Settings uses ordered addressable tabs: General, Profile, |
| [settings](units/settings.md) | SETTINGS-R-002 | Profile fields Name, Username, About, and private Date of |
| [settings](units/settings.md) | SETTINGS-R-003 | Username availability is a hint; API/database validation |
| [settings](units/settings.md) | SETTINGS-R-004 | Privacy changes use draft values and save explicitly; a |
| [settings](units/settings.md) | SETTINGS-R-005 | Sessions are listed using server-derived metadata and |
| [settings](units/settings.md) | SETTINGS-R-006 | Appearance and accent preferences are device-local; |
| [settings](units/settings.md) | SETTINGS-R-007 | Successful saves provide clear success feedback. |
| [settings](units/settings.md) | SETTINGS-R-008 | Professional badge setting is conditional on the professional-networking preference. |
| [staff-admin](units/staff-admin.md) | STAFF-R-001 | `is_staff` controls discoverability only; it does not |
| [staff-admin](units/staff-admin.md) | STAFF-R-002 | Effective permissions are the union of assigned role |
| [staff-admin](units/staff-admin.md) | STAFF-R-003 | The server authorizes every protected operation regardless of |
| [staff-admin](units/staff-admin.md) | STAFF-R-004 | Missing or expired privileged access invokes a shared |
| [staff-admin](units/staff-admin.md) | STAFF-R-005 | Staff actions and security operations are audited with |
| [staff-admin](units/staff-admin.md) | STAFF-R-006 | The panel exposes Overview, Staff, Users, Security & Sessions, |
| [staff-admin](units/staff-admin.md) | STAFF-R-007 | Staff sessions have a separate privileged timeout and can be |
| [subscriptions](units/subscriptions.md) | SUBS-R-001 | Public plans are informational until billing exists. |
| [subscriptions](units/subscriptions.md) | SUBS-R-002 | Entitlements are resolved server-side from one assignment; |
| [subscriptions](units/subscriptions.md) | SUBS-R-003 | Settings shows a compact server-resolved current plan and compares |
| [subscriptions](units/subscriptions.md) | SUBS-R-004 | Paid plan cards show non-action `Coming soon` states until |
| [subscriptions](units/subscriptions.md) | SUBS-R-005 | Subscription status must not bypass account, connection, |

## Rule history

This section is limited to decisions that were deferred, superseded, or retired after being considered as product rules. It is not a backlog. New proposals and work in progress belong in the relevant unit document.

| ID | Status | Decision | Recorded |
|---|---|---|---|
| AUTH-R-030 | Superseded by AUTH-R-008 | The former proactive web access-token refresh contract was replaced by reactive refresh after `TOKEN_EXPIRED`, coordinated across tabs. | 2026-09-21T00:00:00Z |
| CHAT-R-013 | Deferred design proposal | Conversation-list rows may omit the redundant username, especially on narrow screens, to give the latest message more room; the username remains available in the conversation header and profile view. | 2026-09-23T02:06:46Z |

## Maintenance

When a new behavior is implemented, add one active entry under the relevant area, assign the next stable ID, record its effective UTC timestamp, link affected units, and link its verification evidence. Do not delete old entries; mark them superseded or retired and preserve the replacement link. Keep planning notes, unresolved questions, and unimplemented behavior out of this file.
