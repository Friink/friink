# Friink Design

## Product Direction

Friink is a calm, people-first social space centered on meaningful conversations and connection.

## Brand Assets

- The platform uses the six canonical SVG assets in `brand/`: black, white, and
  brand-color mark variants plus the matching full lockups.
- The web-served copies live in `web/public/brand/` and must remain byte-for-byte
  synchronized with `brand/`.
- These assets use tight viewboxes without the legacy surrounding padding. Keep
  logo alignment in the consuming component's layout and size the mark and full
  lockup according to their intrinsic proportions (`96×97` and `304×175`).
- Use mark assets for compact identity surfaces and full lockups for headers,
  authentication, lifecycle, and other branded wordmark surfaces. Select the
  black/white variants for light/dark public surfaces and the brand-color variant
  for authenticated application surfaces.
- Public marketing surfaces use an optical size adjustment for the tight-viewbox
  assets: the header full lockup is `2.5rem` high and footer mark is `1.75rem`
  high. This preserves the established production visual scale; do not reuse
  authenticated-shell logo dimensions for the public site.
- The authenticated topbar uses the tight-viewbox full lockup at `5rem` wide.
  This shared rule applies at desktop and mobile breakpoints so the app header
  keeps the same compact optical scale across responsive layouts.
- Authentication and lifecycle screens use the full lockup at `13.5rem` wide
  and the fixed home mark at `1.75rem × 2rem`. These optical sizes compensate
  for the tight viewboxes and keep login, reset-password, and recovery surfaces
  aligned with the established production scale.

## Layout

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

- **Desktop Shell**: Uses a persistent/collapsible navigation sidebar (`SideDrawer`, `16rem` expanded / `4.5rem` collapsed) and a main content panel.
- **Top Headers**:
  - Desktop uses the top `Header` (`4rem` height) containing the sidebar toggle hamburger button, full brand logo, inline search control, Chat link (`/chats`), and Notifications bell (`/notifications`).
  - Mobile and sub-pages use `NavigationBar` (`2rem` height) containing a history-aware Back button, current page title, and a three-dot overflow button triggering `ActionMenu`.
- **Persistent Contextual Surface**: The bottom `FloatingBar` (`3.5rem` height) hosts the reusable `Composer` as the app-wide quick post surface and seamlessly expands as post text needs multiple lines. The direct chat route also uses this shared surface for its message composer and keeps it visible while changing enabled state and placeholder according to the chat policy contract.
- **Profile Composer Rule**: The shared floating composer is not rendered on profile pages. Profile pages remain focused on identity, profile actions, and profile content; the app-wide post composer remains available on feed and other explicitly supported surfaces.
- **Feed & Content Layout**: App page content uses the shared `ContentBox` as a fluid, responsive content surface. On tablet and desktop, the visible content surface is capped at `720px` via `--space-content-col` and centered within the available panel so very wide monitors do not stretch primary app content into unreadable layouts. The shared content inset is applied outside that cap as an available-width gutter, and `ContentBox` owns bottom spacing. Child screens should fit that container responsively instead of re-adding competing page-level horizontal padding. Page containers reserve bottom spacing (`padding-bottom: calc(var(--space-floating-bar-height) + 2rem)`) to prevent persistent bar overlap.
- **Floating Bar Rail Rule**: The persistent `FloatingBar` is rendered inside a fixed rail covering the same main-panel area as `ContentBox`: full viewport width on mobile, and from the desktop sidebar edge to the viewport edge on tablet and desktop. The rail uses the shared content gutter (`16px` on desktop and `8px` on mobile); the bar itself is fluid up to the same `--space-content-col` cap (`720px`) as `ContentBox` and is centered with flex alignment and `margin: auto`. Its contextual composer therefore aligns with the content surface after the side drawer.
- **Page Gutter Ownership Rule**: The shared content container owns app-page horizontal gutters outside the visible `ContentBox`/`FloatingBar` width cap. Screen-level wrappers such as Home, Settings, Notifications, Connections, Chat list, and similar primary app surfaces must not add their own page-width centering, fixed max-width narrowing, or duplicate horizontal padding unless a documented component contract explicitly declares an exception.
- **Shared Content Inset Rule**: Primary in-app list and card surfaces use one common horizontal inset token of `1rem` (`--space-content-inset-inline`) on desktop and `0.5rem` on mobile, with a standard top row/block inset of `0.75rem` (`--space-content-inset-block`). `ListRow`, `FeedPost`, and settings rows must align to this same left/right content edge unless a surface has an explicit documented exception.
- **Chat Access Rule**: Direct chat is available only between users who follow each other and have accepted follow relationships in both directions. This chat-specific rule does not change the directional semantics of the broader following system.
- **Chat Composer Availability Rule**: Mutual accepted follows and accepted paid requests render an enabled composer with `Write a message...`. A pending receiver sees an enabled `Reply to accept.` composer; a paid requester is capped at eight requester-authored messages and then sees disabled `Request pending.`. Free non-mutual users see a disabled generic composer, and blocked or no-longer-mutual accepted chats see disabled `Chat unavailable.`. Transport/history failures must remain separate from policy state and must not disable the composer by leaving conversation state null.
- **Profile Connection Action Rule**: Other-user profile Follow/Following/request actions are resolved from the authenticated connection-status API after the profile loads; they must not retain the self-profile Edit state during that transition.
- **Incoming Requests Rule**: The signed-in account's Connections surface always includes a Requests tab. Pending incoming requests render Accept and Reject actions from API-backed data; cached privacy state must not hide or reset this tab.
- **Component-Level Fix Rule**: Global UI behavior and layout fixes must land in shared components, shell state owners, shared CSS selectors/tokens, or documented component contracts. Do not solve recurring UI issues with inline styles, page-only spacing overrides, or route-specific quick fixes.
- **Deployment-Neutral Database Connection Rule**: Database connection management is infrastructure configuration, not product behavior. The API uses environment-configurable SQLAlchemy pool settings that work with Neon and a future Ubuntu-hosted PostgreSQL deployment. The default is a conservative 3 base connections plus 2 overflow connections with pre-ping, LIFO reuse, bounded checkout, and recycling; Ubuntu may use a larger pool based on worker count and PostgreSQL `max_connections`. Pooling can be disabled explicitly for runtimes that require short-lived connections. Do not encode Neon-only branching in application features.
- **Web Styling Ownership Rule**: The logged-in web app owns one shared styling surface in `web/app/globals.css`, backed by tokens from `web/theme.config.ts`. Components use semantic classes and must not emit JSX `style` props. Runtime-calculated geometry may be expressed through documented CSS custom properties when a static class cannot represent the value. The public site is excluded from this rule.
- **Web Surface Boundary**: Friink has three product-surface layers: the public marketing site, app-owned authentication/workflow surfaces, and the authenticated web app. Login, signup, OTP, password recovery/reset, account-deleted recovery, and similar transactional screens belong to the app-owned product surface and use the shared app button system even when they do not render the authenticated shell. The public marketing site remains the only surface with separate landing-page button styling.
- **Absolute Inline CSS Ban**: Never use inline CSS in `web/`. This means no JSX `style` props, HTML `style` attributes, or component-level inline CSS declarations—regardless of how small or convenient the change appears. Static styling belongs in `web/app/globals.css`; runtime values must use a documented shared class/state or CSS custom-property mechanism. Do not make exceptions for quick fixes. The public site is outside this contract.
- **Absolute Page-Specific CSS Ban**: Never create or introduce page-specific CSS for the logged-in web app. Do not add CSS Modules, route-only stylesheets, or page-only style sections. All app styling must use semantic classes and shared rules in `web/app/globals.css`, backed by `web/theme.config.ts` tokens. The existing public-site `web/app/landing.module.css` is outside this contract and must not be changed as part of app work.
- **Absolute TSX Design Ban**: Never define or modify visual design in logged-in web-app TSX components. TSX is limited to structure, semantic class names, state, behavior, and accessibility. Colors, spacing, sizing, positioning, typography, borders, shadows, and layout must be changed only in `web/app/globals.css` using canonical tokens from `web/theme.config.ts`. This is a styling ownership rule; it does not prohibit TSX state or behavior changes and does not govern the public site.
- **Exclusive Design File Rule**: For the logged-in web app, design changes may be made only in `web/theme.config.ts` and `web/app/globals.css`. `theme.config.ts` is the sole owner of canonical token values; `globals.css` is the sole owner of generated variables and shared visual/layout rules. Never add design rules to TSX, page-specific CSS, CSS Modules, route stylesheets, or any other web-app file. The public site remains outside this contract.
- **Settings Sections**: Settings uses the shared `Tabs` strip for General, Profile, Account, and Privacy & Safety. Profile edits own public `Name`, `Username`, and `About` as separate rows with separate update actions; Account edits login/account identifiers such as email and password. Internal database UUIDs are not shown in the normal Account screen.
- **Control Panel Sections**: Control Panel uses one side-drawer entry and a shared `Tabs` strip inside `/cp`, with `Overview`, `Staff`, `Users`, `Security & Sessions`, `Audit Log`, and `Public site` sections. The side-drawer entry is discoverability only. For the current rollout, `Users` is the only functional section; the other sections render explicit placeholders. Staff users with no roles see a calm no-access empty state; users see only tabs allowed by their effective permissions. Multiple roles are presented as one combined access view, while additive per-user grants appear separately as `Additional access`. Loading, denied, expired, retry, and access-lost states are explicit; no protected area renders as a blank panel. Missing or expired privileged access is presented in the shared `Modal` as a staff-verification step-up; closing it returns to the prior screen while keeping the ordinary Friink session active. A future role such as `marketer` may expose the `Public site` tab without exposing unrelated staff areas.
- **Authentication Copy Surfaces**: The login identifier field is labeled `Email or username`; signup remains email-first and shows the verification-code screen before password/profile fields. If the submitted signup email is already registered, the flow stays on the email step, sends no OTP, and shows only the same neutral `If the signup details can be accepted, verification instructions will be sent.` copy; it must not show account-existence, login, or different-email recovery text. Email changes first confirm the current password, then verify ownership of the new address with an OTP. Password recovery is email-only and always uses neutral `If an account exists for that email, password-reset instructions have been sent.` copy; valid, expired, used, invalid, and successful reset states follow `docs/forget-password.md` and never expose tokens or account existence. A full account lock shows exactly `Your account is locked. Contact support.` with no reason or duration. Progressive failed-login throttling allows failures 1–3 without cooldown, then uses one-minute, five-minute, and capped fifteen-minute cooldown tiers at failures 4–5, 6–8, and 9+. Cooldown copy uses the server-provided remaining time, never shows attempts remaining or tier names, and must never be presented as a full account lock. The login form preserves the identifier, clears the password, disables submission during cooldown, and exposes an accessible countdown that survives refreshes and tabs. Deliberate session invalidation uses `For your security, your session ended. Please sign in again.` and is distinct from generic expiry or recoverable API failure.
- **Existing Email Sign-in Link Rule**: When signup receives an existing email, the browser stays neutral while the registered address receives a single-use, 15-minute sign-in link. Consuming the link creates the same normal session as password login; it never creates a new account or exposes the raw token in the UI.
- **OTP Configuration Surface**: OTP behavior is controlled by the API-owned `OTP_ENABLED` master setting, which defaults to `true`. An explicit `OTP_ENABLED=false` may be used for local, test, or staging validation and removes OTP prompts across signup, login-risk, reactivation, deletion, and email-change flows. Production must keep OTP enabled; the API refuses to start with the master switch disabled. The frontend must follow API response state and must not render an OTP step when verification is disabled.
- **About Empty State**: A profile with no About text renders no visitor-facing About copy. The signed-in owner sees `Add about in settings.` as the only placeholder.

## Account Switcher

- **Remembered Accounts**: The account caret lists server-provided device slots in recency order, followed by `Add account` and `Manage accounts`. The active account remains usable until a new account session and slot are fully established.
- **Async Refresh**: Opening the selector renders the cached device-scoped list immediately while one deduplicated background refresh runs. The menu always begins with a permanent `Switch Account` header; while refreshing, the shared compact loader appears on the header’s right side, and the header text remains unchanged. The loader disappears when refresh completes; no transient `Updating accounts…` row replaces the header. Keep the current account visible and usable instead of showing a blank state.
- **Refresh Completion**: Add-account, switch, and logout actions trigger an immediate asynchronous list refresh. Display names and usernames come from the API summary; never derive a username from an email address. A failed refresh preserves the cached list and current account and exposes a retryable message.
- **Limit State**: When the configured device-slot limit is reached, `Add account` does not start authentication; it opens account management with a clear remove-before-adding message.
- **Fallback**: Active logout returns to the most-recent remaining account. Deactivation uses `Go Back` for the same fallback and returns to the public site only when no remembered account remains.
- **Failure State**: Failed list, switch, logout, or add-account requests preserve the active account and expose a retryable message. For a failed account-list refresh, the header keeps `Switch Account`, the loader disappears, and a right-side `Retry` action is shown. Reload derives the active identity from the validated session rather than stale local account state.
- **Busy State**: During a switch, the selected row shows the shared spinner and competing account, logout, and Add account actions are disabled until the operation settles. Success updates/remounts the app shell in place without a browser-level reload.

## Navigation

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

Navigation is partitioned across dedicated functional surfaces rather than a single flat list:

1. **FloatingBar (Core Post Action)**:
   - Post composer (`Composer`) submits posts directly from the floating bar.
2. **SideDrawer (Personal Identity & Network)**:
   - Signed-in User Identity Block (`ProfileCard` at top) with a dedicated account caret; expanded drawers place the caret to the right of the identity block, while collapsed desktop drawers overlay it at the avatar's bottom-right corner.
   - The account caret opens the shared `ActionMenu`: all remembered accounts in server-provided order, then Add account and Manage accounts.
   - Profile (`fa-user` → `/[username]`)
   - Home (`fa-house` → `/home`)
   - Connections (`fa-user-group` → `/connections`)
   - Saved (`fa-star` → `/saved/posts`)
   - Footer: Settings (`fa-gear` → `/settings`), Log out (`fa-right-from-bracket`)
3. **Header (Global Utilities)**:
   - Search (`fa-magnifying-glass` opens an inline header search box with text-only suggestions; submit routes to `/search/{searched-string}`)
   - Chat (`fa-regular fa-envelope` → `/chats`) sits between Search and Notifications and shows a green dot when any conversation has unread messages; activating it opens the Chat list.
  - Notifications (`fa-regular fa-bell`) opens a floating recent-notifications dropdown with up to four items, a green unread indicator on the bell, an unread-count pill, and an `All Notifications` link to `/notifications`.
  - Freshness: the Chat unread dot and notification unread count use 4-second adaptive polling that pauses while the document is hidden and resumes on focus/visibility recovery; the full notification list refreshes while `/notifications` is open.

### Tab URL Contract

- Every tab is addressable by its own path segment so tabs can be bookmarked, refreshed, and navigated with browser history.
- Home uses `/home/explore` and `/home/connections`.
- Connections uses `/connections/all`, `/connections/followers`, `/connections/following`, and `/connections/requests`; another user's directory uses `/{username}/connections/{tab}`.
- Chat list opens at `/chats`; its filter tabs remain addressable at `/chat/all`, `/chat/muted`, `/chat/requests`, and `/chat/archived`; conversation routes use `/{username}/chat`. The legacy `/chat` root redirects to `/chats`.
- Chat read receipts use single/double tick states, a 4-second visible-app inbox sync, a numeric unread pill in conversation rows, and an `Unread messages` separator before the first unread message. Inbox sync marks discovered messages delivered; viewport scrolling marks messages read. Consecutive chat bubbles retain the shared 4px rhythm.
- The `/chat` conversation list refreshes its server-authoritative previews, ordering, unread pills, and row state every 4 seconds while visible; hidden documents pause polling and focus/visibility recovery resumes it immediately.
- Settings uses `/settings/general`, `/settings/profile`, `/settings/account`, and `/settings/privacy`.
- Settings > Privacy includes the shared toggle/save pattern for Read receipts; the copy explains that visibility is mutual.
- Profile content uses `/{username}/posts` and `/{username}/replies`.
- Saved uses `/saved/posts` and `/saved/profiles`; `/saved` redirects to `/saved/posts`. Posts contains the current user's private saved posts, while Profiles is reserved for future profile saving.
- Legacy tab roots remain compatibility entry points and redirect to the corresponding canonical tab path.

### Chat receipt presentation
- Receipt ticks use a circular theme-surface badge. Sent/delivered ticks use theme muted gray; read ticks use the accent. Consecutive outgoing bubbles reduce the joining top-right radius to the same 4px lower-right radius.
- The visible app inbox sync may change a message to delivered; opening and scrolling through the conversation changes messages to read. The UI keeps these states distinct.

## Feed Behavior

> Updated to match shipped behavior as of 2026-08-26 — see CHANGELOG.md entry 2026-08-26

- **Home Timeline**: Offers two primary tabs: `Explore` (default public feed) and `Following` (posts strictly from accounts the signed-in user follows).
- **Connections Directory**: A dedicated people management view with `All`, `Followers`, `Following`, and `Requests` filters.
- **Saved Feed**: A preset saved-post view containing only saved posts at `/saved/posts`. The sibling `/saved/profiles` route is reserved for future profile saving and currently shows a coming-soon empty state.
- **Saved Posts**: Saved posts display the brand-colored filled star icon (`fa-solid fa-star`).
- **Post Reactions**: Shared `FeedPost` cards expose public Like and Save counts in the counted action row. Signed-in users can toggle the outlined heart/star controls for posts; active reactions use filled glyphs. Clicking the Like count opens the shared responsive actor modal, while the Save count is display-only because Save actors are private. Replies do not render reaction controls.
- **Liked Posts**: Profile tabs include `Likes` at `/{username}/likes` when the profile's Like visibility permits it. The tab reuses `FeedPost` and cursor-paginated API data; unavailable/deleted posts are omitted.
- **Post Card Navigation Rule**: Clicking a non-interactive area of a post card opens the canonical post detail page.
- **Post Text Expansion Rule**: `Show more...` appears only when post body text overflows four visible lines on feed or post detail surfaces. Activating it expands that post card in place to show the full text; it does not navigate.
- **Quote Placement Rule**: When a feed card includes a quoted-post block, the `Show more...` link is rendered below the quoted block, not between the main post body and the quoted content.

## Visual Language

- Primary brand color is used for active states, selected tabs, links, and important actions.
- Ink and muted gray provide the primary text hierarchy.
- Thin lines separate navigation, tabs, feed posts, and directory rows.
- Settings should follow the same divider-based row rhythm as chat and notifications; avoid individual boxed cards around every setting item unless a future component contract explicitly calls for a standalone card.
- The in-app General settings surface includes an Accent color row. It accepts a six-digit hex code (`#RRGGBB`), previews the color, and applies it to the app shell's `--color-accent` token only; the public site remains on the fixed Friink brand color. Accent-derived soft, background, hover, and focus colors must be computed from `--color-accent`. Invalid values keep the update action disabled.
- Avatars use circular shapes and soft color variations.
- Controls should remain compact, clear, and usable on narrow screens.
- **Async Button Loading Rule**: Every button that starts an asynchronous operation must show a visible loading state from activation until the operation completes, whether it succeeds or fails. The loading state must prevent duplicate activation while work is in progress and must not disappear early while the underlying operation is still pending.
- Typography should feel soft, human, and modern; Nunito is used for headings and action-driven text.
- The brand should feel safe, trustworthy, and quietly premium rather than loud or overly techy.

## Error State

Fallback and error screens should be quiet, centered, and branded.

- Full Friink logo centered above the message.
- Message text: "there appears to be something wrong"
- Error code line beneath: "Error code: xxx"
- Everything vertically and horizontally centered.
- Small abstract brand mark in the upper-left corner that links back to the home route.
- Background remains light and neutral to match the browser theme, with subtle brand color accents.

## Components

Standard app surfaces should be reusable components. Page-specific markup/content may remain local when it is not reused elsewhere, but logged-in app design rules must never be page-specific; they belong only in `web/theme.config.ts` and `web/app/globals.css`.

- **Modal** (`web/components/modal.tsx`): Global modal primitive with an accessible dialog, dimmed backdrop dismissal, Escape dismissal, an optional left-side back-arrow control, a centered title, a top-right cross close control, and a bottom action ribbon for adjacent actions. The header uses fixed back/title/close columns so the title remains centered even when the back control is absent. The modal portals to `document.body`, and its backdrop is the topmost application layer (`z-index: 10000`) so dialogs and their controls remain above navigation, floating bars, menus, and toasts regardless of the caller's stacking context. Dialogs use a responsive desktop/tablet/mobile viewport-constrained shell defined once in `web/app/globals.css`; the themed header, body background, and action ribbon are global, while body content/layout remains contextual. Modal text actions use the shared `.button-primary` / `.button-secondary` primitive at 3rem height with `0.75rem 1.25rem` padding; icon-only settings controls must not be used for text actions. The body owns overflow scrolling while the header and action ribbon remain visible. The back arrow is shown only when `onBack` is provided and must perform the flow's previous-step action without replacing the close control.
- **ProfileSetupWizard** (`web/components/profile-setup-wizard.tsx`): Authenticated two-step setup flow mounted by `AppShell`. It uses the shared themed `Modal`, accent progress treatment, icon-led step headings, helper copy, ProfileCard identity preview, optional Profile picture and About steps, and persists step/completion state through the authenticated setup endpoint.
- **ProfilePictureCropModal** (`web/components/profile-picture-crop-modal.tsx`): Shared square crop interaction used by Settings and ProfileSetupWizard; it owns the crop modal presentation while callers own upload/confirmation state.
- **PostLikesModal** (`web/components/post-likes-modal.tsx`): Shared responsive `Modal` for Like actors. It uses `ListRow` and `ProfileCard`, server-side search, opaque-cursor pagination, duplicate suppression, and privacy/block filtering supplied by the API.
- **FeedPost reactions** (`web/components/feed-post.tsx`): The shared post surface owns optimistic Like/Save state, server-authoritative count reconciliation, rollback/error feedback, and the Like-count modal entry point. Reaction presentation stays in the shared app CSS.

---

## Tokens

The following design tokens are locked hard values extracted directly from the codebase implementation and changelog decisions.

### Corner Radius
- **Buttons and Single-Line Inputs**: `8px` (`--radius-sm: 8px`). Per 2026-08-17 changelog decision, buttons, single-line inputs, search fields, toggle pills, and option menus use an `8px` corner radius, NOT a pill shape.
  - *Codebase `--radius-pill` status*: In `web/app/globals.css` and `web/theme.config.ts`, `--radius-pill` is hard-aliased to `8px` (`:root { --radius-pill: 8px; }`).
  - *Remaining usage of `--radius-pill`*: The token variable `var(--radius-pill)` is still referenced in CSS class selectors (`.settings-toggle-pill`, `.appearance-toggle`, `.message-search`, `.composer input`, `.input-with-prefix`, `.post-submit`, `.floating-bar`, `.floating-bar-item`), but resolves strictly to `8px`. Ordinary app buttons use the shared `8px` action radius directly.
- **Radius Scale**:
  - `--radius-sm`: `8px` (Buttons, inputs, cards, dropdowns, floating bar)
  - `--radius-md`: `12px`
  - `--radius-lg`: `16px`
  - `--radius-pill`: `8px` (Hard-aliased to 8px; legacy token name)
  - Circular (`50%`): Avatars (`.user-avatar`, `.profile-card-avatar`), and legacy/specialized circular action icons where explicitly required. Standard app icon controls use the shared `8px` radius (`.icon-button`).
  - Landing CTA buttons: `4px` (`border-radius: 4px`)

### Colors
- **Brand Colors**:
  - `--color-brand`: `#33aa55` (Fixed public brand color)
  - `--color-accent`: `#33aa55` by default (In-app primary actions, active states, indicators, and focus rings)
  - `--color-accent-soft`: Accent-derived surface tint (light and dark mode)
  - `--color-accent-background`: Accent-derived subtle interaction background
  - `--color-accent-focus`: Accent-derived translucent focus ring
  - `--color-accent-hover`: Accent-derived translucent hover background
- **Neutral & Surface Colors**:
  - `--color-ink`: `#111111` (Primary text; Dark mode: `#f5f5f5`)
  - `--color-muted`: `#8a908c` (Secondary text, inactive icons, handles, dates; Dark mode: `#c4c4c4`)
  - `--color-line`: `#e3e6e3` (Borders, dividers; Dark mode: `#555555`)
  - `--color-paper`: `#ffffff` (Card and panel backgrounds, floating bar; Dark mode: `#161616`)
  - `--color-background`: `#f2f5f1` (App background; Dark mode: `#111111`)
  - `--color-chrome`: `#111111` (Header/shell dark surfaces)
  - `--color-danger`: `#ed8c6b` / `#b54444` (Error states and destructive actions)
- **Avatar Tone Palette**:
  - Coral: `--color-avatar-coral`: `#f4b3a4`
  - Sage: `--color-avatar-sage`: `#bfdbbd`
  - Sun: `--color-avatar-sun`: `#f6d77c`
  - Mint: `--color-avatar-mint`: `#a9dbba`

### Typography
- **Font Families**:
  - Body / user-authored content: `'Inter', sans-serif` (`--font-body`)
  - Display and action text: `'Nunito Local'`, sans-serif (`--font-display`)
  - Brand Mark: `Georgia, 'Times New Roman', serif` (`--font-logo`)
- **App Typography Rule**: In-app headings, buttons, tabs, navigation labels, and other action-driven controls use `--font-display` (`'Nunito Local'`). Post text, About text, messages, and input content remain on `--font-body` (`'Inter'`) for sustained readability.
- **Font Sizes**:
  - `--text-xs`: `0.6875rem` (11px)
  - `--text-sm`: `0.8125rem` (13px)
  - `--text-base`: `0.9375rem` (15px)
  - `--text-lg`: `1.125rem` (18px)
  - `--text-xl`: `1.5625rem` (25px)

### Layout & Dimensions
- **Sidebar Width**: `16rem` (256px, `--space-sidebar-width`) / Collapsed: `4.5rem` (72px, `--space-sidebar-collapsed-width`)
- **Topbar Height**: `4rem` (64px, `--space-topbar-height`)
- **Floating Bar Height**: `3.5rem` (56px, `--space-floating-bar-height`)
- **Mobile Navigation / Tabs Height**: `2rem` for `NavigationBar`; top tab strips are `1.98rem` and start immediately after the navigation bar with no visual gap.
- **Content Column**: Shell content boxes and the contextual floating composer are fluid (`width: 100%`) and responsive to the available app panel, with one primary tablet/desktop cap of `720px` (`--space-content-col`) for logged-in app content. Avoid per-screen hardcoded page max-width rules for primary app content; the shared container owns this constraint.
- **Shared Inset Tokens**:
  - `--space-content-inset-inline`: `1rem` desktop, `0.5rem` mobile
  - `--space-content-inset-block`: `0.75rem`
- **Ownership Rule for Inset Tokens**:
  - `ContentBox` and `.floating-bar-rail` apply `--space-content-inset-inline` outside the visible `--space-content-col` cap.
  - Row/card components such as `ListRow` and `FeedPost` may use the same token for their internal left/right content inset.
  - Screen wrapper components must not also add a second outer gutter with the same token unless a contract explicitly calls for nested inset behavior.
- **Desktop Breakpoint**: `768px` (`--breakpoint-desktop`: `768px`, `@media (max-width: 767px)` for mobile behaviors)

---

## Component Contracts

Every shared/reusable component in the codebase must strictly satisfy the contracts below.

### 1. ProfileCard (`web/components/profile-card.tsx`)
- **Purpose**: Canonical identity block displaying avatar, display name, handle, and optional date. Whenever a user's profile identity is shown in app content or app lists, use `ProfileCard`; if the identity is meant to open a profile, pass `href` so the whole identity block links to that profile route.
- **Fixed Internal Layout Order**:
  1. Horizontal flex container (`gap: 0.75rem`, `align-items: center`).
  2. Avatar (`.profile-card-avatar`): `2.5rem` x `2.5rem`, circular (`50%` radius). Render `imageUrl` when present; otherwise render the shared `/media/profile.jpg` default image as a full-bleed `object-fit: cover` image. The `tone` prop remains available for surfaces that later opt into a tinted non-image avatar.
  3. Info Cluster (`.profile-card-info`): Vertical column (`align-items: flex-start`, `gap: 0.12rem`).
     - Display Name (`strong`): `0.95rem`, `font-weight: 700`, `color: var(--color-ink)`.
     - Handle (`span.profile-card-handle`): `0.8rem`, `color: var(--color-muted)`.
     - Optional Date (`span.profile-card-date`): `0.7rem`, `color: var(--color-muted)`.
- **Feed Date Placement Rule**: In feed posts (`FeedPost`), the post date is rendered on its own dedicated line **below** the `ProfileCard` block, left-aligned under the avatar/identity cluster (per 2026-08-26 changelog).
- **Props Contract**:
  - `name: string` (required)
  - `handle: string` (required)
  - `tone?: string` (optional, default `'mint'`)
  - `initials?: string` (optional, falls back to computed initials)
  - `date?: string` (optional)
  - `href?: string` (optional; when provided, wraps the whole card in a profile link)
  - `imageUrl?: string | null` (optional; profile picture URL, with `/media/profile.jpg` fallback when null)

### 2. ActionMenu (`web/components/action-menu.tsx`)
- **Purpose**: Reusable contextual popover menu for page-level and composer actions. It is triggered by the three-dot overflow button in `NavigationBar` and by the post composer plus button.
- **Fixed Internal Layout Order**:
  - Popover card (`.action-menu`, `role="menu"`).
  - Vertical list of menu items (`.action-menu-item`, `role="menuitem"`), each containing an icon (`fa-solid`) and a label.
- **Default Items Contract**:
  1. Share profile (`fa-share-nodes`)
  2. Copy link (`fa-link`)
  3. Mute updates (`fa-bell-slash`)
  4. Report (`fa-flag`)
- **Dismissal Behavior**: Must close on outside pointer click (`pointerdown`) and `Escape` keypress.
- **Props Contract**:
  - `open: boolean` (required; renders `null` when `false`)
  - `items?: ActionMenuItem[]` (optional contextual item list)
  - `ariaLabel?: string` (optional menu label)
  - `anchorRef: RefObject<HTMLElement>` (required trigger reference)
  - `align?: 'start' | 'end'` (optional horizontal alignment, default `'end'`)
  - `onClose?: () => void` (optional dismissal callback)
- Account-switcher menus may use disabled items for the active account and `dividerBefore` on the first management action. The divider groups account selection and Add account from Manage accounts using the shared thin-line treatment. Account switching remains device-session behavior; this menu does not create account relationships.
- **Viewport Placement Rule**: Renders through a document-body portal with fixed positioning. It measures the trigger and menu, flips above when below-space is insufficient, clamps to the viewport edges, and recalculates on resize and scroll.

The composer attachment menu uses `Add media` (`fa-image`) and `Add link` (`fa-link`). `Add media` selects up to eight local images; images upload only when the user submits the post, while `Add link` remains reserved for a future link flow.

### 3. FloatingBar (`web/components/floating-bar.tsx`)
- **Purpose**: Persistent contextual bottom surface providing navigation or screen-specific composer actions.
- **Fixed Sizing & Positioning**:
  - `position: fixed`, `bottom: max(1rem, env(safe-area-inset-bottom))`, `left: 1rem`, `right: 1rem` on desktop, with `0.5rem` mobile left/right insets and `1rem` mobile bottom spacing.
  - `height: 3.5rem` (`var(--space-floating-bar-height)`).
  - Lives in a fixed `.floating-bar-rail` covering the same available area as the main content panel: full viewport width on mobile, and from the desktop sidebar edge to the viewport edge on tablet and desktop. The rail centers the bar with `display: flex` and `justify-content: center`. The bar uses `width: 100%`, `max-width: var(--space-content-col)` (720px), and `margin: 0 auto`; the rail owns only the responsive horizontal gutter.
  - Border radius: `8px`, border: `1px solid var(--color-line)`, background: `var(--color-paper)`, box shadow: `0 0.75rem 2rem rgba(24, 44, 31, 0.12)`.
- **Variants & Layout Modes**:
  1. **Default Navigation Mode** (`children` is null/undefined/false):
     - Width: Compact natural width constrained by the shared rail (`width: min(max-content, 100%)`), horizontally centered (`margin: 0 auto`).
     - Fixed Navigation Item: Post (`fa-pen`).
     - Active item highlighted with `color: var(--color-accent)` and `background: var(--color-accent-soft)`.
  2. **Contextual Composer Mode** (`children` is provided):
     - Width: Spans the shared content rail, not the full viewport (`width: 100%` within the centered floating shell).
     - Hosts contextual composers (`Composer`).
- **Layout Constraints**:
  - Page content containers reserve bottom space via `padding-bottom: calc(var(--space-floating-bar-height) + 2rem)` so the persistent bar never obscures page content.
  - Floating composer textareas expand with content without triggering nested page scroll containers.
- **Props Contract**:
  - `activeScreen: Screen` (required)
  - `onNavigate: (screen: Screen) => void` (required)
  - `children?: ReactNode` (optional; when provided, activates contextual mode)

### 4. ProfileScreen (`web/components/profile-screen.tsx`)
- **Purpose**: Profile view for both signed-in user self-profile and browsable other-user profiles.
- **Profile Resolution State**: The route waits for the requested username to resolve before rendering profile content. While pending it shows `Loading profile...`; if the username cannot be resolved, it renders `Does not exist or unavailable.` and must not synthesize a demo identity.
- **Fixed Internal Layout Order**:
  1. Profile Summary (`.profile-summary`): A single section inside `ContentBox` containing identity, about text, statistics, and profile actions with standard block spacing and no custom outer gutter.
  2. Top Identity Block (`.profile-intro`): `ProfileCard` with user name, handle, and avatar (`5rem` large avatar, twice the standard `2.5rem` profile-card avatar).
  3. Bio Text (`.profile-bio`): Left-aligned under identity block, `max-width: 34rem`.
  4. Profile Meta Row (`.profile-meta-row`): A single-column grid with statistics first and profile actions on the next row, using the shared `ContentBox` inset rather than custom profile gutters.
     - Statistics (`.profile-stats`): Left-aligned and inline, displaying API-backed following and follower counts. Each complete number-and-label statistic is an ununderlined link that opens the matching Connections tab through username-scoped routes for both self and other profiles. Hover and focus color the complete link, including the number.
     - Actions (`.profile-actions`): Left-aligned on a dedicated row below the inline statistics on all viewports.
  5. Section Tabs (`Tabs`): Two tabs — `Posts` and `Replies`.
  6. Profile Feed / Empty State.
- **Variants & Action Rules**:
  - **Self-Profile Variant** (`isOwnProfile = true`): Renders the **Edit** action button (`.profile-action-edit`, icon `fa-pen-to-square` + text "Edit", right-aligned) and routes to Settings > Profile.
  - **Other-User / Dummy Profile Variant** (`isOwnProfile = false`): Renders the **Compose / Send Message** icon button (shared `.button-secondary.icon-button`, icon `fa-paper-plane`, right-aligned) and routes to `/{username}/chat` when activated.
  - *These are the only two variants.*
- **State Invariant**: Sidebar navigation highlight ONLY tracks the signed-in user's profile (`sidebarActiveScreen`). When browsing another user's dummy profile via `/[username]`, the sidebar profile navigation item must NOT be highlighted.
- **Props Contract**:
  - `user: AuthUser` (required)
  - `posts: Post[]` (required)
  - `isOwnProfile?: boolean` (optional, default `true`)

### 5. FeedPost (`web/components/feed-post.tsx`)
- **Purpose**: Post card in feed timelines.
- **Fixed Internal Layout Order**:
  1. Post Header (`.feed-post-heading`):
     - `ProfileCard` linked to `/[username]`.
     - Right action cluster (`.feed-post-options`) containing Share and More buttons with a visible fixed gap.
     - Share (`.feed-post-share`, `fa-share-nodes`) and More (`.feed-post-more`, `fa-ellipsis-vertical`) are compact plain icon controls: `1.75rem` square, transparent, borderless, and without accent hover/focus treatment. They are intentionally exempt from the shared bordered `.icon-button` treatment.
  2. Date Row (`.feed-post-date`): Rendered on a separate line **below** the identity block, left-aligned under avatar/name/handle.
  3. Post Body (`.feed-post-body`): Text content.
  4. Quoted Post Block (`.feed-post-quote`, optional): When the original post is available, the entire block is a link to that post's canonical detail page; unavailable originals remain a non-clickable status block.
     - The quoted post identity uses the original author's display name, username, and profile picture when available, with the shared avatar fallback otherwise.
  5. Show More Button (`.feed-post-show-more`): Rendered only when body text exceeds four visible lines. Expands the post card in place to reveal the full body text. When a quoted-post block exists, this button sits beneath that block.
  6. Post Action Bar (`.feed-post-actions`): Comment (`fa-comment`) with reply count, Quote (`fa-quote-right`) with quote count, Like (`fa-heart`), and Save (`fa-star`) controls. Save is operated from this lower action row; there is no redundant header Save control.
  - **Post Card Navigation Rule**: Clicking a non-interactive area of the card opens the canonical post detail page. Interactive controls, profile links, and available quoted-post links keep their own behavior.
  - **Mention Rule**: Recognized `@username` mentions in post and quoted-post text are links to the mentioned profile, use the current app accent, and do not display an underline in any interaction state. Mention notification copy links to the canonical post that contains the mention.
- **Show More Styling Rule**: `Show more...` uses regular weight and muted color by default; it should read as a lightweight local expansion control rather than a primary CTA.
- **Spacing Rule**: Uses the shared surface inset tokens: horizontal padding `var(--space-content-inset-inline)` and top padding `var(--space-content-inset-block)`.
- **Save state**: Active Save uses the brand filled star icon (`fa-solid fa-star`); inactive Save uses the outline star (`fa-regular fa-star`). The adjacent Save count is display-only because Save actors are private.
- **Props Contract**:
  - `post: Post` (required)
  - `highlightedStar?: boolean` (optional, default `false`)

### 6. Header (`web/components/header.tsx`) & NavigationBar (`web/components/navigationbar.tsx`)
- **Desktop `Header`**:
  - Fixed top bar (`height: 4rem`, `--space-topbar-height`).
  - Left: Single sidebar toggle hamburger button (`fa-bars`) + Full Brand Logo (`/brand/logoFullBrand.svg`).
  - Right: Search button (`fa-magnifying-glass`) opens an inline header search input with the search submit icon before the close (`fa-xmark`) button. Chat link (`fa-regular fa-envelope`) sits between Search and Notifications, routes to `/chats`, and shows a green dot whenever any conversation has an unread message. Search, Chat, and Notifications use equal `2rem` action cells with a shared centered icon box and equal column spacing; their glyphs use the outlined treatment visible in the header. On mobile, the active search input and floating dropdown span the available viewport width with `8px` left/right inset. The floating suggestions dropdown uses the shared `ContextualDropdown`, appears `8px` below the search input, matches the input width, uses text-only rows without leading icons, shows up to four rows, and includes an `Open Search` link to `/search`; it stays naturally sized without a scrollbar when four or fewer rows are present.
  - Search submission: Clicking the right-side search button or pressing Enter navigates to `/search/{searched-string}`.
  - Notifications bell button (`fa-regular fa-bell`) matches search icon height, stays aligned at the right edge of the header actions, and opens a floating dropdown anchored to the bell. The dropdown shows up to four recent notifications, an `x new` pill using the actual unread count (`99+` when above 99), and an `All Notifications` link to `/notifications`. The bell shows a small green dot only when unread notifications exist; the dot is hidden at `0`. Header spacing must reserve room so the indicator is not clipped at the viewport edge.
  - Both header dropdowns use the shared `ContextualDropdown`, including the same bordered footer-bar treatment for `Open Search` and `All Notifications`, and render a centered `Nothing to show.` empty state with whitespace when their item list is empty.
  - The reusable portaled `ActionMenu` must resolve app-shell light/dark theme state even though it renders under `document.body`; app menus use the selected app surface, foreground, border, and secondary-text colors rather than relying on inherited `.app-shell` variables. The public account menu remains explicitly themed as a public surface.
  - *Invariant*: Header owns sidebar toggling; drawer does not duplicate hamburger button.
- **Mobile / Sub-page `NavigationBar`**:
  - Height is `2rem`.
  - Left: History-aware Back button (`fa-arrow-left`) + Page Title (`.navigationbar-title`).
  - Right: Overflow menu button (`fa-ellipsis-vertical`) controlling `ActionMenu`.
  - Page title uses bold compact uppercase sizing.
  - *Back Button Rule*: Back navigation is history-aware (`router.push`), disabled when on Home or without history (`window.history.length <= 1`). In-content back buttons are removed to prevent duplication.

### 7. SideDrawer (`web/components/side-drawer.tsx`)
- **Purpose**: Primary desktop sidebar and mobile navigation drawer.
- **Fixed Internal Layout Order**:
  1. Top identity: `ProfileCard` for signed-in user (`.sidebar-profile`) with a separate caret trigger (`.sidebar-account-menu-button`) for account actions. The ProfileCard itself is not the account-menu trigger; the drawer's Profile navigation item remains the profile destination.
  2. Main navigation links (`.sidebar-nav`): Profile (`fa-user`), Home (`fa-house`), Connections (`fa-user-group`), Saved (`fa-star`). Chat is owned by the global Header instead of the drawer. Route-based drawer items are real anchors with destination `href` values so browsers can preview their URLs on hover; client navigation remains intercepted for SPA behavior.
  3. Staff action, when `AuthUser.isStaff` is true: Control panel (`fa-shield-halved`) linking to `/cp`. This is a discoverability control only; server-side authorization remains authoritative. The protected panel uses the shared app-shell theme and exposes Overview, Staff, Users, Security & Sessions, Audit Log, and Public site sections. Only Users is functional in the current rollout; the remaining sections are explicit placeholders until their requirements are refined. It shows a calm step-up state when privileged access is absent, retains the ordinary session during verification expiry, and shows only permission-authorized areas and actions.
  4. Footer actions (`.sidebar-footer`): Settings (`fa-gear`) and Log out (`fa-right-from-bracket`). Account switching, Add account, and Manage accounts live in the profile-card account menu. The switcher remains a device-session convenience, not an account-linking surface.
- **Responsive Behavior**:
  - Desktop: Persistent, collapsible between `16rem` and `4.5rem`.
  - Mobile (`<768px`): Overlay drawer, auto-collapses on outside click or focus loss. The shared header hamburger stops its pointer/focus events from reaching outside-dismiss handling so it can explicitly open and close the drawer.

### 8. Composer (`web/components/composer.tsx`)
- **`Composer`**:
  - Default layout: Plain attachment button (`fa-plus`, transparent and borderless) on the far left, single-line text field in the middle, and Send/Post button (`fa-arrow-up`, `8px` radius, disabled when empty) on the far right. The composer attachment control is intentionally exempt from the shared bordered `.icon-button` treatment and has no accent hover/focus treatment.
  - Floating post composer enforces a frontend-only `256` character limit and shows a live `x/256` counter.
  - Quote mode may submit without typed text when a quoted post is selected; normal posts and replies still require text.
  - Floating post multiline mode: Starts in the same single-line layout, then moves the text editor to a full-width top row as soon as typing begins. It grows upward with the draft to a maximum of eight lines (`10rem`); additional content scrolls inside the editor while attachment, count, and send/post controls remain bottom-aligned.
  - Submission state: When a composer is busy posting, its editor keeps the normal contextual placeholder (including `Write a post...` and `Add your quote...`); the spinner and button label communicate progress. `disabledPlaceholder` is reserved for a composer that is unavailable for interaction, not one temporarily disabled during submission.
  - Chat request state: The chat route supplies policy-derived `disabled` and `disabledPlaceholder` values from the API context. `Reply to accept.`, `Request pending.`, and `Chat unavailable.` are intentional disabled-state copy; loading failures must not be converted into these states.
  - Chat visual mode: Chat uses the same multiline editor and mention-input variant as post composition so the shared embedded layout remains consistent. Chat does not inherit the post-only `256` character limit or post-media upload flow.
  - Chat message limit: Chat always shows a `count/2048` counter and enforces the 2,048-character limit; it does not inherit the post-only `256` limit or post-media upload flow.
  - Chat bubble rhythm: Consecutive message bubbles use a `4px` vertical gap so adjacent messages remain visually distinct without changing bubble grouping or alignment.
  - Chat receipts: Own messages render a single tick while sent, double grey ticks when delivered, and double accent-colored ticks when read. Receipt color is paired with tick count and accessible status text; unread counts use the shared accent pill treatment.
  - Floating post textbox: Borderless and transparent for a modern embedded look while retaining readable `var(--color-ink)` text in light and dark themes.
  - Mention input: Post composers resolve an exact `@username` when the user types a space, replacing the recognized text with an editable inline token containing the user's small profile picture and `@username`. Editing the token unwraps it back to ordinary text. Rendered posts remain compact text with clickable `@username` profile links; avatars are not repeated in post bodies.
  - Reply/quote context: When a composer is replying to or quoting a post, the referenced preview uses the target post author's resolved profile-picture URL, and a top-right close control removes the context and returns to a normal post composer. Clearing an empty mention editor normalizes leftover browser placeholder nodes and blurs it so refocusing places the caret before, not after, the visual placeholder.
  - Draft behavior: Composer text is persisted best-effort in browser local storage under a user/context-specific key and restored when returning to that composer. Empty drafts are removed; drafts are never written to the database. The mention editor exposes its empty state explicitly so its placeholder returns after all text is deleted, including when the browser leaves an empty contenteditable node.
  - Post media controls: The post composer action menu's `Add media` item opens a multiple-image picker for up to eight client-side images. Selected images appear as a horizontally scrollable thumbnail strip between the `+` control and character count in the expanded composer toolbar; thumbnails can be reordered before submission. Selecting a thumbnail opens the post crop tool directly with a `3:5` frame, Reset and Apply controls, and previous/next overlay arrows when multiple images are attached. While the post/media request runs, the Post button is disabled and shows the spinner animation. Files remain local until Post is pressed, then upload through the authenticated submit flow. Failed submission preserves the text and attachments for retry; successful submission resets them. Published media is rendered by the shared Post Media Gallery contract below.

### 8a. Post Media Gallery (`web/components/post-media-gallery.tsx`)
- **Purpose**: Shared Instagram-style display for successfully associated post images in feed posts, post detail, replies, and quoted-post blocks.
- **Layout**: Galleries with multiple images use a horizontal scroll slider. Every multi-image slide uses the same nominal height (`24rem` on desktop and `15rem` on compact screens) and a default `3:4` frame. A single-image gallery uses the image's natural aspect ratio, constrained by the available content width and the same responsive maximum height, so it does not leave a trailing empty track. Scroll snap aligns multi-image slides to the gallery edge, and all associated images remain available instead of being hidden behind a count overlay.
- **Surface**: The gallery uses the shared line/background tokens, a small platform radius, an `8px` gap between multi-image slides, and full-width mobile bleed aligned to the content inset. Multi-image frames are rounded with the shared `8px` radius and use `object-fit: cover` within the default `3:4` frame; single-image frames preserve the complete image with `object-fit: contain` and no visible trailing gallery background. Images load lazily after the first image.
- **Accessibility**: The gallery exposes its image count through an accessible label, and every image receives an author-specific position-aware alt description.
### 9. Tabs (`web/components/tabs.tsx`)
- **Purpose**: Reusable tab bar with animated sliding indicator line.
- **Layout**: Horizontal tab pill row (`.tabs__pill`, `role="tab"`) with sliding underline indicator (`.tabs__indicator`). Top app tab strips are `1.98rem` tall and sit directly below `NavigationBar` without a gap. The tab row scrolls horizontally when its items exceed the available width, with the scrollbar hidden to preserve the sleek strip appearance.
- **Props Contract**: `tabs?: Tab[]`, `activeId?: string`, `onChange?: (id: string) => void`, `ariaLabel?: string`, `className?: string`.
- **Overflow Controls**: When tabs overflow at any viewport width, a right chevron appears at the edge and scrolls the strip forward by one tab per activation; it remains visible but disabled at the end. A left chevron appears only after the strip has moved away from its initial position and scrolls back one tab per activation; it disappears at the initial position. The controls are conditional, do not appear when all tabs fit, and work consistently on mobile, tablet, and desktop.
- **Scroll Rule**: Touch, trackpad, mouse-wheel, and drag-based horizontal scrolling move the tab strip itself without changing the selected tab. Vertical page scrolling remains available.

### 10. Form Inputs & Username Prefix Pattern (`InputField`, `account-screens.tsx`)
- **Username Prefix Rule**: In username fields (login, signup, and settings), the `@` prefix is rendered as an explicit inline/prefixed element outside the entered text (with dedicated left padding `2.6rem`), **NEVER** overlapping typed characters.
- **Signup Identity Guidance**: Signup visibly explains the username rule: 2–32 characters using letters, numbers, `.`, `_`, and `-`. The optional display-name field accepts up to 124 characters; leading and trailing whitespace is normalized away before submission.
- **Single-Line Inputs**: Height `2.5rem` to `3rem`, corner radius strictly `8px` (`border-radius: 8px !important`).
- **In-App Button System** (`Button`):
  - The app has two action styles: `primary` (`.button-primary`) for the main action and `secondary` (`.button-secondary`) for supporting, reversible, or cancel actions. Both use `3rem` minimum height, `0.75rem 1.25rem` padding, `8px` radius, shared typography, focus, disabled, and loading behavior.
  - Text-only, icon-and-text, and icon-only content are compositions, not additional button types. Icon-only controls use `.icon-button`, with a minimum `2.75rem` square hit area, an accessible label, and the same neutral utility treatment wherever they appear in fields, settings, navigation, or feed actions.
  - Width is contextual rather than a button variant: the canonical action layout is intrinsic-width buttons aligned to the end of their action row. This applies to modal, auth, add-account, reset-password, and wizard actions. On narrow screens, action rows may stack buttons vertically; stacking is a responsive layout decision, not a separate button style.
  - Low-emphasis navigation or optional actions use `.text-link`, not a third button type. Tabs, toggles, menus, and reaction controls remain specialized controls because their interaction model differs from ordinary actions.
  - Every asynchronous button disables duplicate activation, preserves its layout width, and shows a visible loading state until the operation completes. Destructive intent changes the semantic color treatment without creating a third button type.
  - The public landing-page button styles remain separate; this contract applies to the authenticated web app and all app-owned auth/workflow surfaces.

### 10a. Login & Signup Screen (`web/components/login-screen.tsx`)
- **Responsive Width Rule**: The auth form fills the available viewport width, caps at `31rem` on larger screens, and must remain shrinkable on narrow devices without horizontal overflow.
- **Dark Mode Rule**: When the system prefers dark mode, the auth screen background is `#161616`.
- **Mobile Action Rule**: At widths up to `480px`, auth action groups are right-aligned, while the Forgot password control remains left-aligned.
- **Login Flow Rule**: Login uses progressive disclosure across two screens. The first screen contains one required text field labeled `Email or username`, with `autocomplete="username"`, and a `Continue` action. The second screen preserves the identifier, provides the required password field with `autocomplete="current-password"`, a visible password toggle, Forgot password action, and clear Back/Change identifier control before `Login`. The API is called only after the password step. The flow accepts either identifier case-insensitively. Signup keeps its separate email-only field and OTP sequence.
- **Progressive Entry Rule**: The feature-flagged `/start` route begins with neutral `Login or create account` copy and reuses the shared `LoginScreen` rather than changing `/login`. Identifier submission uses the opaque server flow token from `POST /auth/progressive/start`; continuation uses `POST /auth/progressive/continue` before rendering either the existing password step or the existing signup-email OTP step. The identifier step must not reveal account existence. Back from an unverified progressive signup OTP returns to the progressive identifier step and starts a fresh server-authoritative branch; it must not fall through to the legacy login-email step. Abandoned signup retains the existing reservation/OTP expiry and replacement behavior, and creates no account or session.
- **Signup Email Verification Rule**: When signup OTP is enabled, signup shows a verification-code step immediately after the email step, before password and profile details. The six-character code field uses the shared input treatment, `autocomplete="one-time-code"`, uppercase alphanumeric normalization, and a clear `Verify email` action. Expiry, attempt limits, replacement, single use, and account creation timing remain server-controlled.
- **Add-account Modal Rule**: The authenticated side-drawer `Add account` action opens an in-app themed modal variant of this flow, not the standalone full-page auth surface. The modal starts with `Email or username`, then reveals `Password`, exposes `Sign up` on the left and `Continue`/Login on the right using the shared Button primitive, and reuses the signup/login fields, validation, OTP flow, loading states, errors, and accessibility treatment from this screen. A successful login or signup adds the independently authenticated account to the device session list and may activate it; an add-account failure must not log out or replace the currently active account. No account relationship is created. Non-current remembered accounts expose a logout action directly in the account selector; the current account retains its checkmark and cannot be logged out through that selector action.
- **Account Selector Logout Rule**: Each non-current remembered account keeps its selectable account row and exposes a separate right-side logout icon action on that same row. The logout icon opens the existing confirmation dialog, which must show the selected account's profile card before the destructive action. The current account retains its right-side checkmark and has no selector logout action; the drawer's primary Log out control remains unchanged.
- **Account Selector Loading Rule**: Opening the account selector displays the cached device-scoped account list immediately while an asynchronous refresh runs. The menu always shows a permanent `Switch Account` header; the shared spinner appears on the header’s right side only during refresh and disappears when the refresh settles. No transient `Updating accounts…` status row replaces the header. Refresh requests are deduplicated, and the cache is replaced with the server list when complete. The list also refreshes after account add, switch, and logout operations. A failed refresh keeps the cached/current account usable and changes the header’s right-side affordance to a subtle `Retry` action. While an account switch is in flight, the menu stays open, its selected row shows a spinner, and all account rows, logout actions, and Add account are disabled to prevent competing authentication requests. A successful switch updates the app shell in place and remounts it for the new user instead of performing a browser-level reload.

### Password Reset Screen (`web/app/reset-password/page.tsx`)
- Uses the shared password field treatment: visible placeholders, visibility toggles, the shared `PasswordCriteria` checklist, and readable dark-mode text tokens. The shared centered auth-form structure keeps forgot-password, reset-password, and reset-success states aligned across viewport sizes. Suspicious-login reset links require a different password; ordinary recovery may reuse the current password.

### 11. ToastStack (`web/components/toast-stack.tsx`)
- **Purpose**: App-level notification stack for logged-in errors that should not appear inline in page content.
- **Desktop Placement**: Fixed lower-right, above the floating bar, stacking vertically with newest toast appended at the bottom.
- **Mobile Placement**: Fixed bottom center, above the floating bar, stacking upward from the bottom while center-aligned.
- **Content Contract**: Each toast shows a message, timestamp, and dismiss icon button. Structured errors may additionally show a plain-language title, stable error code, and smaller muted detail summary. End-user detail must describe what happened and the next user action in plain language; deployment, API, storage, and framework terminology must not appear in the primary or detail copy.

### 12. Settings Rows (`web/components/account-screens.tsx`, `web/components/list-row.tsx`)
- **Purpose**: Settings uses a shared `SettingsRow` wrapper around `ListRow` for every setting so spacing, dividers, typography, leading icons, field content, and right-side actions stay consistent.
- **Grouping Rule**: Settings items are grouped in divider-bounded sections, not rendered as isolated outlined cards per item.
- **Content Rule**: Simple settings may use title/subtitle/trailing only; richer settings may place forms or control groups in the `ListRow` body area below the subtitle.
- **Expanded Row Rule**: An expanded setting renders its title and summary once in the shared row header; the control body must not repeat the setting title as a second visible field label. Inputs remain accessible through native labels or `aria-label` attributes.
- **Profile Tab Rule**: `Name`, `Username`, `About`, and the private `Date of birth` field live in the Profile tab as distinct rows, each with its own dedicated update control and status messaging. Date of birth is editable for the existing server-side age requirement but is not shown on the public profile in this phase. Username changes check availability before submission; username identity is case-insensitive and stored/displayed canonically in lowercase.
- **Joined Field Rule**: Settings > Account includes a read-only `Joined` field showing the account’s server-side creation date and time. The value is not editable, is sourced from the account creation timestamp rather than the browser clock, and is formatted consistently for the user’s locale/time zone.
- **Subscription Tab Rule**: Settings includes a dedicated Subscription tab showing the current `Friink Free` plan and a `View plans` link to `/subscriptions`. Paid billing and entitlement management are not active yet.
- **Inline Field Rule**: Single-line editable profile fields such as `Name` and `Username` place their update button on the same row as the input. Multi-line fields such as `About` may keep their action below the field.
- **Settings Action Rail Rule**: Editable controls render below the title/description, while the save tick remains in the row's right-side action rail. About and other multiline fields reserve horizontal space for that rail.
- **Settings Three-Column Rule**: Every settings row uses three columns: a `3rem × 3rem` rounded setting icon on the far left, the shared `ListRow` title/summary/body content in the middle, and a `3rem × 3rem` right-side action control. The leading icon and right-side action align to the same top edge and height; the middle column is shrinkable so fields and descriptions do not push the action rail off-screen.
- **Settings Toggle Rule**: Privacy settings use the shared two-option toggle with `On` on the left and `Off` on the right in the middle content column; the selected state is highlighted and the save tick remains alone in the right-side action rail.
- **About Field Rule**: The About textarea enforces a 128-character frontend limit and displays an `x/128` counter inside the lower-right corner of the field.
- **Save Control Rule**: Editable settings use an icon-only check action with an accessible label and tooltip in a `3rem × 3rem`, `8px` radius box. Other right-side actions, including Upload, View plans, blocked-people access, and session logout, use the same square icon-only control sizing with accessible labels/tooltips.
- **Privacy Toggle Rule**: Privacy toggles use draft values and require the right-side tick to save; API-backed Private Profile changes revert to the last saved value if saving fails.
- **Save Feedback Rule**: Every successful settings save, including tick-button saves and API-backed toggles, shows a success toast.
- **Spacing Rule**: Settings rows align to the same `--space-content-inset-inline` token used by `FeedPost` and base list rows.
- **Profile Picture Rule**: Settings > Profile includes an optional profile-picture picker with a circular preview, an icon-only Upload control in the shared right-side action rail, and visible loading/error feedback. The preview must remain the last server-confirmed image until the complete crop, processing, transfer, and API confirmation flow succeeds. The crop modal's labeled `Upload` confirmation action is the sole upload action after file selection; it closes only after successful confirmation. The existing default avatar remains the fallback when no picture URL exists. Upload failures must identify the failed stage (API start, R2 transfer, or API confirmation) and include an actionable configuration or session hint when the failure is environment-related.
- **Password Change Rule**: Settings > Account includes a password-change row with Current password, New password, and Confirm new password fields. Password fields are empty in React state on entry, use the same accessible eye visibility controls as Login/Signup, and the current-password field uses the standard `autocomplete="current-password"` contract so password managers can offer saved credentials. New-password fields provide native `minLength`, `pattern`, and `title` hints matching the signup policy. Focusing New password reveals the shared concise checklist: at least 8 characters, a mix of letters/numbers/symbols, and no spaces; satisfied rules use the brand state. The action is disabled until the new password meets the full server-aligned complexity rules and both new-password fields match; the backend remains authoritative and requires the current password before replacing the stored hash. A successful change keeps the current session active and clears the password fields.
- **Session Management Rule**: Settings > Account includes a Sessions section using the shared settings-row pattern. It lists active server-managed sessions with device, browser, operating system, logged-in time, last-active time, and a server-derived current-session state. The current session has no revoke action; other sessions can be logged out individually or through a confirmed `Log out other sessions` action. Missing device metadata is rendered as an unknown/fallback value, and raw tokens, hashes, IPs, and internal UUIDs are never shown.
- **Profile Picture Processing Rule**: The picker accepts JPG/JPEG, PNG, and WebP inputs, rejects source images whose shorter edge is below 128px before opening the cropper, and presents the draggable/zoomable square crop step in an accessible modal dialog with backdrop, title, cancel, and icon-only tick confirmation controls. The file-selection action is labeled `Upload`, while the subsequent upload action is labeled `Upload profile picture`. The cropper maximum zoom is calculated as `shorterEdge / 128`. It then displays a processing state while normalizing the crop to JPEG at the shared avatar compression preset before upload. HEIC/HEIF and other formats are rejected with a specific message; transparent pixels flatten to white. The avatar preset targets 512px square and ~250KB without upscaling smaller crops. The crop dialog must not introduce horizontal overflow or a bottom scrollbar.
- **Post Media Compression Rule**: The shared compression utility's `postMedia` preset targets a maximum 1024px longest edge, preserved aspect ratio, JPEG output, and ~500KB. The submit flow uses this preset before direct R2 upload; the API independently verifies JPEG content and the 500KB ceiling.

### Public Header and Plans (`web/components/public-header.tsx`, `web/app/page.tsx`, `web/app/subscriptions/page.tsx`)
- Public marketing surfaces are governed by the same light/dark theme contract: every explicit light-theme foreground, background, border, and interactive-state color must have a matching dark-mode override.
- The landing page and `/subscriptions` reuse `Header`; public pages must not duplicate site navigation markup.
- `Header` detects the persisted authenticated session on the client. Signed-out users see a Login CTA; signed-in users see their current profile picture as an account-menu trigger. The shared `ActionMenu` positions the public account menu directly below the avatar with a 2px gap and 2px right offset, stays above the public header, and uses explicit light/dark public-surface colors. Its menu header shows the display name and secondary `@username`, followed by Feed (`fa-house` → `/home`), Settings (`fa-gear` → `/settings`), and Log out (`fa-right-from-bracket`). Public headers do not show a redundant Home link because the Friink logo already links to `/`.
- The progressive-login rollout may later change the public primary CTA to `Get started` linking to `/start`, while the explicit `Login` action continues linking to `/login`. Until staging verification is complete, the public CTA remains unchanged and `/start` stays feature-flagged.
- The `/subscriptions` page uses the same landing-page surface and dark-mode treatment as the landing page, including the shared navigation, cards, borders, text colors, and backgrounds.
- Public plan-card text, including feature lists and prices, must use the dark-theme foreground token in dark mode; no light-theme hardcoded foreground may remain visible on dark card surfaces.
- Public plan links, including hover and keyboard-focus states, must remain readable against dark-mode surfaces.
- The landing page includes a concise three-card Plans section with a `Compare all plans` link to `/subscriptions`.
- Landing section order is Hero, Development progress, Our vision, Plans, then Newsletter so visitors understand Friink before seeing pricing.
- `/subscriptions` is the full public plan-comparison surface for Friink Free, Friink Pro, and Friink Pro+.
- Paid cards use a non-action `Coming soon` state until billing exists; the Free card links to `/login`.
- Plan cards use the landing visual language: `8px` corners, shared green brand accent, responsive one-column-to-three-column layout, and dark-mode equivalents.

### 13. Profile Identity Rows (`web/components/list-row.tsx`, `web/components/connections-screen.tsx`, `web/components/notifications-screen.tsx`)
- **Purpose**: List-style surfaces that show people or profile actors must reuse `ProfileCard` for the visible identity block instead of separately composing avatar, display name, and handle.
- **Click Rule**: In Connections and Notifications, the visible `ProfileCard` links to `/[username]` through its `href` prop. Row-level actions such as Accept, Reject, Cancel, and Remove remain separate controls.
- **Hover Rule**: Profile names inside `ListRow` identity links must not change color on hover or focus; only the row background and focus outline provide the interaction affordance.
- **HTML Rule**: Do not nest a profile link inside a row rendered as a button. If a row needs a different primary click target, keep profile navigation and row navigation as separate valid interactive elements.
- **Search Results Rule**: Search result pages must use `PageSurface` with shared `ListRow` rows and reusable identity blocks instead of bespoke result cards.

### 14. PageSurface (`web/components/page-surface.tsx`)
- **Purpose**: Shared first-level screen wrapper used inside `ContentBox` so app pages inherit one layout contract instead of owning custom outer spacing.
- **Ownership Rule**: `PageSurface` may define screen display mode such as stacked sections or list flow, but it must not introduce page-level side gutters, custom max-widths, or competing centering. List surfaces use a shrinkable `minmax(0, 1fr)` track so wide media content cannot expand beyond the shared `ContentBox`.
- **Variant Rule**: Use the list variant for row/feed surfaces and the stack variant for forms or mixed vertical sections.
- **Enforcement Rule**: Logged-in screens should mount a `PageSurface` directly inside `ContentBox` instead of hand-rolling a bespoke outer wrapper.
- **Reuse Rule**: Prefer extending an existing shared layout primitive such as `PageSurface`, `ContentBox`, `ListRow`, or `FloatingBar` before creating a new wrapper component for a one-off page need.

### 15. ContentBox (`web/components/content-box.tsx`)
- **Purpose**: Canonical app-page content wrapper for primary logged-in surfaces.
- **Ownership Rule**: Owns the visible content column and default bottom breathing room; its width calculation preserves the page-level horizontal gutter outside the content cap.
- **Tablet/Desktop Width Rule**: Caps primary logged-in content at `720px` via `--space-content-col` and centers it within the main panel. The contextual floating composer uses the same token and cap.
- **Do Not Duplicate Rule**: Child screen wrappers must not add a second page-level left/right gutter, center themselves with a narrower default width, or compete with `ContentBox` over the outer responsive inset unless an explicit contract documents why.
- **Allowed Responsibility Split**:
  - `ContentBox`: outer available-width gutter, visible desktop width cap, centering, and bottom page spacing.
  - `PageSurface`: first-level screen flow only.
  - Child screens and rows: internal composition only, such as row grouping, cards, sections, and local vertical rhythm.
- **Strict Prohibition Rule**: Do not patch page alignment with inline styles, targeted per-screen spacing overrides, or duplicate one-off wrapper components when the issue can be solved by updating the shared layout primitives and their documented contracts.

---

## Current Implementation Notes

- Runtime baseline: the web app now uses Next.js 16.3.4 and React 19.3.0. App
  Router route and metadata request props use the async `params`/
  `searchParams` contract. This is an implementation detail and does not alter
  the visual or interaction contracts documented here. Local Windows testing
  may use Next's Webpack fallback when the native SWC binding is unavailable.
- Post media currently uses the fixed 3:5 crop flow described above. Final crop width, height, and aspect ratio are not persisted in the database; freeform crop bounds and first-image carousel-ratio locking are not implemented.
- Deployment boundary: staging and production use separate Neon databases and separate R2 buckets. The production database is temporarily hosted on Neon with a planned future move to the Droplet; the production R2 delivery domain is `media.friink.com`. Web deployments receive only their environment-specific API origin, and no media bucket/environment identifier is part of the application data model.
- Media delivery: profile-picture keys are resolved against the active environment's configured public media URL; post-media uploads use the active environment's configured bucket and public URL. Cross-environment media sharing is not a supported behavior.
- The logged-in app has no known design-contract violations in the current working tree. Deployment configuration, R2 health, and end-to-end browser verification remain release checks outside this design contract.
- Account lifecycle UX must use calm, explicit confirmation surfaces. Deactivation must explain all-session logout, continued subscription billing, reactivation availability, and read-only chats. Reactivation and pending-deletion screens must require OTP before restoring access, distinguish cancellation of deletion from ordinary login, and provide clear loading, error, retry, focus, and keyboard-accessible states across viewport sizes.
- Security notifications use the shared Notifications surface with the shield icon and a settings action link for reviewing sessions. Login-security copy must not expose internal UUIDs, device identifiers, IP addresses, or other sensitive session metadata.

- Account lifecycle controls use calm, explicit settings rows. Deactivation
  requires the current password and ends all sessions; deletion requires the
  current password followed by a fresh email OTP. The logged-out deactivation
  and deletion screens explain continued billing/deletion grace respectively.
  Login must distinguish reactivation from pending-deletion cancellation and
  require OTP before creating the single new session.
  The post-reactivation deactivation cooldown is 8 minutes and its remaining
  time is presented in a live-updating toast.

- ### Blocking surfaces
- Profile overflow uses the shared `ActionMenu` and `Modal` for block confirmation.
- Privacy > Blocked people uses the shared `Modal`, `ListRow`, and `ProfileCard`; search is API-backed and loading uses an opaque cursor.
- A blocked profile, including a direct URL, renders the neutral `Profile unavailable.` state. Existing chats remain visible but read-only.

### Account switcher slice

The agreed interaction uses the existing Modal, LoginScreen, ProfileCard, and
row patterns: Login is the first Add-account view, Create account is below it,
and Manage Accounts places the active ProfileCard first with logout actions on
other rows only.

New-device approval uses the existing Settings row treatment: coarse device
details, an explicit Approve action, and a Deny action. The approval surface
never displays the email OTP.

The implemented web slice also publishes login-approval requests through the
existing Notifications surface, shows a security toast when a new request is
detected, and reloads account-scoped state when another open tab switches the
active account. Mobile secure-storage behavior remains a platform contract.

Profile setup uses the same themed Modal surface and design tokens as the rest
of the authenticated app: accent progress, calm helper copy, ProfileCard
identity preview, icon-led steps, and responsive actions. Optional setup work
must remain skippable and preserve the existing saved-progress behavior.

### Account switcher slice

The authenticated drawer may show `Add account` and, once two safe
server-provided account summaries exist, `Change account` entries. Each
remembered-account entry uses the account's server-provided profile picture as
its leading circular avatar, falling back to the shared default profile image;
the active entry retains a trailing checkmark. Entries continue to show
username only as their text identity. The existing
Add-account modal is implemented for the web slice; mobile remains a platform
contract.

The setup-wizard restyle is build-verified in the working tree. Live staging
visual acceptance remains pending deployment because the current staging tab
still shows the older plain wizard presentation.

The current account-switcher and setup-wizard contracts are web-only for this
release. Native mobile visual and interaction requirements are maintained in
`docs/auth-and-session-mobile.md` and are deferred until a mobile client exists.

Account authentication must preserve the existing device session when OTP is
completed for another account in the same browser. A new device identifier is
created only when no device cookie exists; OTP must not make remembered
accounts disappear by replacing an existing device identity.
