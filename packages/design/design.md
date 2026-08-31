# Friink Design

## Product Direction

Friink is a calm, people-first social space centered on meaningful conversations and connection.

## Layout

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

- **Desktop Shell**: Uses a persistent/collapsible navigation sidebar (`SideDrawer`, `16rem` expanded / `4.5rem` collapsed) and a main content panel.
- **Top Headers**:
  - Desktop uses the top `Header` (`3.75rem` height) containing the sidebar toggle hamburger button, full brand logo, inline search control, and Notifications bell (`/notifications`).
  - Mobile and sub-pages use `NavigationBar` (`2rem` height) containing a history-aware Back button, current page title, and a three-dot overflow button triggering `ActionMenu`.
- **Persistent Contextual Surface**: The bottom `FloatingBar` (`3.5rem` height) hosts the reusable `Composer` as the app-wide quick post surface and seamlessly expands as post text needs multiple lines.
- **Profile Composer Rule**: The shared floating composer remains available on profile pages. On another user's profile, the default post draft is prefilled with `@username ` as a removable suggestion so posting in-profile naturally supports mentions without forcing them.
- **Feed & Content Layout**: App page content uses the shared `ContentBox` as a fluid, responsive content surface. On desktop, the content surface is capped at `1024px` width and centered within the available panel so very wide monitors do not stretch primary app content into unreadable layouts. `ContentBox` owns the standard page-side gutter and bottom spacing, so child screens should fit that container responsively instead of re-adding competing page-level horizontal padding. Page containers reserve bottom spacing (`padding-bottom: calc(var(--space-floating-bar-height) + 2rem)`) to prevent persistent bar overlap.
- **Floating Bar Rail Rule**: The persistent `FloatingBar` follows the same centered content rail as `ContentBox` instead of using a wider independent viewport width. It sits inset horizontally by `16px` on desktop and `8px` on mobile, with `16px` bottom spacing on all viewports, so its effective max width is `calc(1024px - 2rem)` on desktop and `calc(1024px - 1rem)` on mobile.
- **Page Gutter Ownership Rule**: The shared `ContentBox` is the only default owner of app-page horizontal gutters. Screen-level wrappers such as Home, Settings, Notifications, Connections, Chat list, and similar primary app surfaces must not add their own page-width centering, fixed max-width narrowing, or duplicate horizontal padding unless a documented component contract explicitly declares an exception.
- **Shared Content Inset Rule**: Primary in-app list and card surfaces use one common horizontal inset token of `1rem` (`--space-content-inset-inline`) on desktop and `0.5rem` on mobile, with a standard top row/block inset of `0.75rem` (`--space-content-inset-block`). `ListRow`, `FeedPost`, and settings rows must align to this same left/right content edge unless a surface has an explicit documented exception.
- **Component-Level Fix Rule**: Global UI behavior and layout fixes must land in shared components, shell state owners, shared CSS selectors/tokens, or documented component contracts. Do not solve recurring UI issues with inline styles, page-only spacing overrides, or route-specific quick fixes.
- **Settings Sections**: Settings uses the shared `Tabs` strip for General, Profile, Account, and Privacy & Safety. Profile edits own public `Name`, `Username`, and `About` as separate rows with separate update actions; Account edits login/account identifiers such as email and user ID.
- **About Empty State**: A profile with no About text renders no visitor-facing About copy. The signed-in owner sees `Add about in settings.` as the only placeholder.

## Navigation

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

Navigation is partitioned across dedicated functional surfaces rather than a single flat list:

1. **FloatingBar (Core Post Action)**:
   - Post composer (`Composer`) submits posts directly from the floating bar.
2. **SideDrawer (Personal Identity & Network)**:
   - Signed-in User Identity Block (`ProfileCard` at top)
   - Profile (`fa-user` → `/[username]`)
   - Home (`fa-house` → `/home`)
   - Connections (`fa-user-group` → `/connections`)
   - Chat (`fa-envelope` → `/chat` — labeled "Chat", route `/chat`)
   - Starred (`fa-star` → `/starred`)
   - Footer: Settings (`fa-gear` → `/settings`), Log out (`fa-right-from-bracket`)
3. **Header (Global Utilities)**:
   - Search (`fa-magnifying-glass` opens an inline header search box with text-only suggestions; submit routes to `/search/{searched-string}`)
  - Notifications (`fa-bell`) opens a floating recent-notifications dropdown with up to four items, a green unread indicator on the bell, an unread-count pill, and an `All Notifications` link to `/notifications`.

### Tab URL Contract

- Every tab is addressable by its own path segment so tabs can be bookmarked, refreshed, and navigated with browser history.
- Home uses `/home/explore` and `/home/connections`.
- Connections uses `/connections/all`, `/connections/followers`, `/connections/following`, and `/connections/requests`; another user's directory uses `/{username}/connections/{tab}`.
- Chat uses `/chat/all`, `/chat/muted`, and `/chat/requests`.
- Settings uses `/settings/general`, `/settings/profile`, `/settings/account`, and `/settings/privacy`.
- Profile content uses `/{username}/posts` and `/{username}/replies`.
- Legacy tab roots remain compatibility entry points and redirect to the corresponding canonical tab path.

## Feed Behavior

> Updated to match shipped behavior as of 2026-08-26 — see CHANGELOG.md entry 2026-08-26

- **Home Timeline**: Offers two primary tabs: `Explore` (default public feed) and `Following` (posts strictly from accounts the signed-in user follows).
- **Connections Directory**: A dedicated people management view with `All`, `Followers`, `Following`, and `Requests` filters.
- **Starred Feed**: A preset saved-post view containing only starred posts. It uses the shared `ListRow` summary pattern instead of full feed cards, with post detail opening the full post surface.
- **Starred Posts**: Starred posts display the brand-colored filled star icon (`fa-solid fa-star`).
- **Post Card Navigation Rule**: Clicking a non-interactive area of a post card opens the canonical post detail page.
- **Post Text Expansion Rule**: `Show more...` appears only when post body text overflows four visible lines on feed or post detail surfaces. Activating it expands that post card in place to show the full text; it does not navigate.
- **Quote Placement Rule**: When a feed card includes a quoted-post block, the `Show more...` link is rendered below the quoted block, not between the main post body and the quoted content.

## Visual Language

- Primary brand color is used for active states, selected tabs, links, and important actions.
- Ink and muted gray provide the primary text hierarchy.
- Thin lines separate navigation, tabs, feed posts, and directory rows.
- Settings should follow the same divider-based row rhythm as chat and notifications; avoid individual boxed cards around every setting item unless a future component contract explicitly calls for a standalone card.
- Avatars use circular shapes and soft color variations.
- Controls should remain compact, clear, and usable on narrow screens.
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

Standard app surfaces should be reusable components. Page-specific content may remain local when it is not reused elsewhere.

- **Modal** (`web/components/modal.tsx`): Global modal primitive with an accessible dialog, dimmed backdrop dismissal, Escape dismissal, an optional left-side back-arrow control, a top-right cross close control, and a bottom action ribbon for adjacent actions. The back arrow is shown only when `onBack` is provided and must perform the flow's previous-step action without replacing the close control.
- **ProfileSetupWizard** (`web/components/profile-setup-wizard.tsx`): Authenticated two-step setup flow mounted by `AppShell`. It uses `Modal` with the title `Let's update your settings`, supports optional Profile picture and About steps, and persists step/completion state through the authenticated setup endpoint.
- **ProfilePictureCropModal** (`web/components/profile-picture-crop-modal.tsx`): Shared square crop interaction used by Settings and ProfileSetupWizard; it owns the crop modal presentation while callers own upload/confirmation state.

---

## Tokens

The following design tokens are locked hard values extracted directly from the codebase implementation and changelog decisions.

### Corner Radius
- **Buttons and Single-Line Inputs**: `8px` (`--radius-sm: 8px`). Per 2026-08-17 changelog decision, buttons, single-line inputs, search fields, toggle pills, and option menus use an `8px` corner radius, NOT a pill shape.
  - *Codebase `--radius-pill` status*: In `web/app/globals.css` and `web/theme.config.ts`, `--radius-pill` is hard-aliased to `8px` (`:root { --radius-pill: 8px; }`).
  - *Remaining usage of `--radius-pill`*: The token variable `var(--radius-pill)` is still referenced in CSS class selectors (`.settings-toggle-pill`, `.appearance-toggle`, `.message-search`, `.composer input`, `.profile-action-button`, `.input-with-prefix`, `.post-submit`, `.floating-bar`, `.floating-bar-item`), but resolves strictly to `8px`.
- **Radius Scale**:
  - `--radius-sm`: `8px` (Buttons, inputs, cards, dropdowns, floating bar)
  - `--radius-md`: `12px`
  - `--radius-lg`: `16px`
  - `--radius-pill`: `8px` (Hard-aliased to 8px; legacy token name)
  - Circular (`50%`): Avatars (`.user-avatar`, `.profile-card-avatar`), circular action icons (`.post-option`, `.topbar-menu`, `.feed-post-star`, `.messages-toolbar .icon-plain`)
  - Landing CTA buttons: `4px` (`border-radius: 4px`)

### Colors
- **Brand Colors**:
  - `--color-brand`: `#33aa55` (Primary actions, active states, indicators, focus rings)
  - `--color-brand-soft`: `#eaf5ed` (Light mode tint; Dark mode: `#244d30`)
- **Neutral & Surface Colors**:
  - `--color-ink`: `#111111` (Primary text; Dark mode: `#f5f5f5`)
  - `--color-muted`: `#8a908c` (Secondary text, inactive icons, handles, dates; Dark mode: `#c4c4c4`)
  - `--color-line`: `#e3e6e3` (Borders, dividers; Dark mode: `#555555`)
  - `--color-paper`: `#ffffff` (Card and panel backgrounds, floating bar; Dark mode: `#161616`)
  - `--color-background`: `#f2f5f1` (App background; Dark mode: `#111111`)
  - `--color-background-accent`: `#e7f2e9` (Subtle accent; Dark mode: `#161616`)
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
- **Topbar Height**: `3.75rem` (60px, `--space-topbar-height`)
- **Floating Bar Height**: `3.5rem` (56px, `--space-floating-bar-height`)
- **Mobile Navigation / Tabs Height**: `2rem` for `NavigationBar`; top tab strips are `1.98rem` and start immediately after the navigation bar with no visual gap.
- **Content Width**: Shell content boxes are fluid (`width: 100%`) and responsive to the available app panel, with a primary desktop cap of `1024px` for logged-in app content. Avoid per-screen hardcoded page max-width rules for primary app content; the shared container owns this constraint.
- **Shared Inset Tokens**:
  - `--space-content-inset-inline`: `1rem` desktop, `0.5rem` mobile
  - `--space-content-inset-block`: `0.75rem`
- **Ownership Rule for Inset Tokens**:
  - `ContentBox` owns the outer page gutter via `--space-content-inset-inline`.
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
- **Viewport Placement Rule**: Renders through a document-body portal with fixed positioning. It measures the trigger and menu, flips above when below-space is insufficient, clamps to the viewport edges, and recalculates on resize and scroll.

The composer attachment menu uses `Add media` (`fa-image`) and `Add link` (`fa-link`). These controls are UI-only in the current flow: they close the menu but do not upload or persist attachments.

### 3. FloatingBar (`web/components/floating-bar.tsx`)
- **Purpose**: Persistent contextual bottom surface providing navigation or screen-specific composer actions.
- **Fixed Sizing & Positioning**:
  - `position: fixed`, `bottom: max(1rem, env(safe-area-inset-bottom))`, `left: 1rem`, `right: 1rem` on desktop, with `0.5rem` mobile left/right insets and `1rem` mobile bottom spacing.
  - `height: 3.5rem` (`var(--space-floating-bar-height)`).
  - Follows the shared `ContentBox` centering rail with an additional `16px` desktop horizontal inset or `8px` mobile horizontal inset, producing a maximum effective width of `calc(1024px - 2rem)` on desktop and `calc(1024px - 1rem)` on mobile.
  - Border radius: `8px`, border: `1px solid var(--color-line)`, background: `var(--color-paper)`, box shadow: `0 0.75rem 2rem rgba(24, 44, 31, 0.12)`.
- **Variants & Layout Modes**:
  1. **Default Navigation Mode** (`children` is null/undefined/false):
     - Width: Compact natural width constrained by the shared rail (`width: min(max-content, 100%)`), horizontally centered (`margin: 0 auto`).
     - Fixed Navigation Item: Post (`fa-pen`).
     - Active item highlighted with `color: var(--color-brand)` and `background: var(--color-brand-soft)`.
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
  - **Other-User / Dummy Profile Variant** (`isOwnProfile = false`): Renders the **Compose / Send Message** icon button (`.profile-message-icon`, icon `fa-paper-plane`, right-aligned).
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
     - Right action cluster (`.feed-post-options`) containing Star and More buttons with a visible fixed gap.
     - Star button (`.feed-post-star`, right-aligned) uses the same button and icon box height as `NavigationBar` overflow.
     - More options button (`.feed-post-more`, `fa-ellipsis-vertical`) uses the same button and icon box height as `NavigationBar` overflow.
  2. Date Row (`.feed-post-date`): Rendered on a separate line **below** the identity block, left-aligned under avatar/name/handle.
  3. Post Body (`.feed-post-body`): Text content.
  4. Quoted Post Block (`.feed-post-quote`, optional): When the original post is available, the entire block is a link to that post's canonical detail page; unavailable originals remain a non-clickable status block.
     - The quoted post identity uses the original author's display name, username, and profile picture when available, with the shared avatar fallback otherwise.
  5. Show More Button (`.feed-post-show-more`): Rendered only when body text exceeds four visible lines. Expands the post card in place to reveal the full body text. When a quoted-post block exists, this button sits beneath that block.
  6. Post Action Bar (`.feed-post-actions`): Comment (`fa-comment`) with reply count, Quote (`fa-quote-right`) with quote count, Like (`fa-heart`), Share (`fa-share-nodes`).
  - **Post Card Navigation Rule**: Clicking a non-interactive area of the card opens the canonical post detail page. Interactive controls, profile links, and available quoted-post links keep their own behavior.
  - **Mention Rule**: Recognized `@username` mentions in post and quoted-post text are links to the mentioned profile. Mention notification copy links to the canonical post that contains the mention.
- **Show More Styling Rule**: `Show more...` uses regular weight and muted color by default; it should read as a lightweight local expansion control rather than a primary CTA.
- **Spacing Rule**: Uses the shared surface inset tokens: horizontal padding `var(--space-content-inset-inline)` and top padding `var(--space-content-inset-block)`.
- **Variants**:
  - `highlightedStar = true`: Brand filled star icon (`fa-solid fa-star`, `.feed-post-star-highlighted`).
  - `highlightedStar = false`: Outline star icon (`fa-regular fa-star`).
- **Props Contract**:
  - `post: Post` (required)
  - `highlightedStar?: boolean` (optional, default `false`)

### 6. Header (`web/components/header.tsx`) & NavigationBar (`web/components/navigationbar.tsx`)
- **Desktop `Header`**:
  - Fixed top bar (`height: 3.75rem`).
  - Left: Single sidebar toggle hamburger button (`fa-bars`) + Full Brand Logo (`/brand/logoFullBrand.svg`).
  - Right: Search button (`fa-magnifying-glass`) opens an inline header search input with the search submit icon before the close (`fa-xmark`) button. On mobile, the active search input and floating dropdown span the available viewport width with `8px` left/right inset. The floating suggestions dropdown uses the shared `ContextualDropdown`, appears `8px` below the search input, matches the input width, uses text-only rows without leading icons, shows up to four rows, and includes an `Open Search` link to `/search`; it stays naturally sized without a scrollbar when four or fewer rows are present.
  - Search submission: Clicking the right-side search button or pressing Enter navigates to `/search/{searched-string}`.
  - Notifications bell button (`fa-bell`) matches search icon height, stays aligned at the right edge of the header actions, and opens a floating dropdown anchored to the bell. The dropdown shows up to four recent notifications, an `x new` pill using the actual unread count (`99+` when above 99), and an `All Notifications` link to `/notifications`. The bell shows a small green dot only when unread notifications exist; the dot is hidden at `0`. Header spacing must reserve room so the indicator is not clipped at the viewport edge.
  - Both header dropdowns use the shared `ContextualDropdown`, including the same bordered footer-bar treatment for `Open Search` and `All Notifications`, and render a centered `Nothing to show.` empty state with whitespace when their item list is empty.
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
  1. Top identity: `ProfileCard` for signed-in user (`.sidebar-profile`).
  2. Main navigation links (`.sidebar-nav`): Profile (`fa-user`), Home (`fa-house`), Connections (`fa-user-group`), Chat (`fa-envelope`), Starred (`fa-star`). Route-based drawer items are real anchors with destination `href` values so browsers can preview their URLs on hover; client navigation remains intercepted for SPA behavior.
  3. Footer actions (`.sidebar-footer`): Settings (`fa-gear`), Log out (`fa-right-from-bracket`).
- **Responsive Behavior**:
  - Desktop: Persistent, collapsible between `16rem` and `4.5rem`.
  - Mobile (`<768px`): Overlay drawer, auto-collapses on outside click or focus loss. The shared header hamburger stops its pointer/focus events from reaching outside-dismiss handling so it can explicitly open and close the drawer.

### 8. Composer (`web/components/composer.tsx`)
- **`Composer`**:
  - Default layout: Attachment button (`fa-plus`, `8px` radius) on the far left, single-line text field in the middle, and Send/Post button (`fa-arrow-up`, `8px` radius, disabled when empty) on the far right.
  - Floating post composer enforces a frontend-only `256` character limit and shows a live `x/256` counter.
  - Quote mode may submit without typed text when a quoted post is selected; normal posts and replies still require text.
  - Floating post multiline mode: Starts in the same single-line layout, then expands vertically as text wraps or new lines are added. Once expanded, text occupies the full top row while attachment and send/post controls remain bottom-aligned.
  - Floating post textbox: Borderless and transparent for a modern embedded look while retaining readable `var(--color-ink)` text in light and dark themes.
### 9. Tabs (`web/components/tabs.tsx`)
- **Purpose**: Reusable tab bar with animated sliding indicator line.
- **Layout**: Horizontal tab pill row (`.tabs__pill`, `role="tab"`) with sliding underline indicator (`.tabs__indicator`). Top app tab strips are `1.98rem` tall and sit directly below `NavigationBar` without a gap.
- **Props Contract**: `tabs?: Tab[]`, `activeId?: string`, `onChange?: (id: string) => void`, `ariaLabel?: string`, `className?: string`.
- **Mobile Swipe Rule**: On mobile widths, horizontal swipes on the tab strip move one tab at a time: right-to-left selects the next tab, left-to-right selects the previous tab. Vertical scroll gestures must not trigger tab changes.

### 10. Form Inputs & Username Prefix Pattern (`InputField`, `account-screens.tsx`)
- **Username Prefix Rule**: In username fields (login, signup, and settings), the `@` prefix is rendered as an explicit inline/prefixed element outside the entered text (with dedicated left padding `2.6rem`), **NEVER** overlapping typed characters.
- **Single-Line Inputs**: Height `2.5rem` to `3rem`, corner radius strictly `8px` (`border-radius: 8px !important`).
- **Button Primitives** (`Button`):
  - Height `3rem`, corner radius `8px` (`.pill-button`).
  - Variants: `brand` (`.pill-button-brand`, background `#33aa55`, color white), `quiet` (`.pill-button-quiet`, background `#eaf5ed`, color ink), and hollow outline (`.signup-back-button`).

### 10a. Login & Signup Screen (`web/components/login-screen.tsx`)
- **Responsive Width Rule**: The auth form fills the available viewport width, caps at `31rem` on larger screens, and must remain shrinkable on narrow devices without horizontal overflow.
- **Dark Mode Rule**: When the system prefers dark mode, the auth screen background is `#161616`.
- **Mobile Action Rule**: At widths up to `480px`, auth action groups are right-aligned, while the Forgot password control remains left-aligned.

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
- **Profile Tab Rule**: `Name`, `Username`, and `About` live in the Profile tab as distinct rows, each with its own dedicated update control and status messaging.
- **Subscription Tab Rule**: Settings includes a dedicated Subscription tab showing the current `Friink Free` plan and a `View plans` link to `/subscriptions`. Paid billing and entitlement management are not active yet.
- **Inline Field Rule**: Single-line editable profile fields such as `Name` and `Username` place their update button on the same row as the input. Multi-line fields such as `About` may keep their action below the field.
- **Settings Action Rail Rule**: Editable controls render below the title/description, while the save tick remains in the row's right-side action rail. About and other multiline fields reserve horizontal space for that rail.
- **Settings Toggle Rule**: Privacy settings use the shared two-option toggle with `On` on the left and `Off` on the right; the selected state is highlighted and the save tick remains beside it in the same top-aligned action rail.
- **About Field Rule**: The About textarea enforces a 128-character frontend limit and displays an `x/128` counter inside the lower-right corner of the field.
- **Save Control Rule**: Editable settings use a labeled action button with a check icon and contextual `Update …` text in a minimum `3rem`-high, `8px` radius box, matching the shared platform button height. The profile-picture Upload action uses the same right-side rail and labeled-control pattern.
- **Privacy Toggle Rule**: Privacy toggles use draft values and require the right-side tick to save; API-backed Private Profile changes revert to the last saved value if saving fails.
- **Save Feedback Rule**: Every successful settings save, including tick-button saves and API-backed toggles, shows a success toast.
- **Spacing Rule**: Settings rows align to the same `--space-content-inset-inline` token used by `FeedPost` and base list rows.
- **Profile Picture Rule**: Settings > Profile includes an optional profile-picture picker with a circular preview, a labeled `Upload` control with an upload icon in the shared right-side action rail, and visible loading/error feedback. The preview must remain the last server-confirmed image until the complete crop, processing, transfer, and API confirmation flow succeeds. The crop modal's labeled `Upload` confirmation action is the sole upload action after file selection; it closes only after successful confirmation. The existing default avatar remains the fallback when no picture URL exists. Upload failures must identify the failed stage (API start, R2 transfer, or API confirmation) and include an actionable configuration or session hint when the failure is environment-related.
- **Profile Picture Processing Rule**: The picker accepts JPG/JPEG, PNG, and WebP inputs, rejects source images whose shorter edge is below 128px before opening the cropper, and presents the draggable/zoomable square crop step in an accessible modal dialog with backdrop, title, cancel, and icon-only tick confirmation controls. The file-selection action is labeled `Upload`, while the subsequent upload action is labeled `Upload profile picture`. The cropper maximum zoom is calculated as `shorterEdge / 128`. It then displays a processing state while normalizing the crop to JPEG at the shared avatar compression preset before upload. HEIC/HEIF and other formats are rejected with a specific message; transparent pixels flatten to white. The avatar preset targets 512px square and ~250KB without upscaling smaller crops. The crop dialog must not introduce horizontal overflow or a bottom scrollbar.
- **Post Media Compression Rule**: The shared compression utility also exposes a `postMedia` preset targeting a maximum 1024px longest edge, preserved aspect ratio, JPEG output, and ~500KB. It is preparation only and must not be wired into a post-media upload flow until that flow exists.

### Public Header and Plans (`web/components/public-header.tsx`, `web/app/page.tsx`, `web/app/subscriptions/page.tsx`)
- Public marketing surfaces are governed by the same light/dark theme contract: every explicit light-theme foreground, background, border, and interactive-state color must have a matching dark-mode override.
- The landing page and `/subscriptions` reuse `Header`; public pages must not duplicate site navigation markup.
- `Header` detects the persisted authenticated session on the client. Signed-in users see their current profile picture instead of a Login CTA, and the picture links to the same-origin page that led to the public page, falling back to `/home` when no safe referrer is available.
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
- **Ownership Rule**: `PageSurface` may define screen display mode such as stacked sections or list flow, but it must not introduce page-level side gutters, custom max-widths, or competing centering.
- **Variant Rule**: Use the list variant for row/feed surfaces and the stack variant for forms or mixed vertical sections.
- **Enforcement Rule**: Logged-in screens should mount a `PageSurface` directly inside `ContentBox` instead of hand-rolling a bespoke outer wrapper.
- **Reuse Rule**: Prefer extending an existing shared layout primitive such as `PageSurface`, `ContentBox`, `ListRow`, or `FloatingBar` before creating a new wrapper component for a one-off page need.

### 15. ContentBox (`web/components/content-box.tsx`)
- **Purpose**: Canonical app-page content wrapper for primary logged-in surfaces.
- **Ownership Rule**: Owns the page-level horizontal gutter and the default bottom breathing room for content above the floating bar.
- **Desktop Width Rule**: Caps primary logged-in content at `1024px` and centers it within the main panel.
- **Do Not Duplicate Rule**: Child screen wrappers must not add a second page-level left/right gutter, center themselves with a narrower default width, or compete with `ContentBox` over the outer responsive inset unless an explicit contract documents why.
- **Allowed Responsibility Split**:
  - `ContentBox`: page gutter, desktop width cap, centering, and bottom page spacing.
  - `PageSurface`: first-level screen flow only.
  - Child screens and rows: internal composition only, such as row grouping, cards, sections, and local vertical rhythm.
- **Strict Prohibition Rule**: Do not patch page alignment with inline styles, targeted per-screen spacing overrides, or duplicate one-off wrapper components when the issue can be solved by updating the shared layout primitives and their documented contracts.

---

## Unresolved & Contract Violations

None. All historical discrepancies have been resolved to match shipped behavior, and all shared component contracts have been verified against active component implementations across all usage contexts.

