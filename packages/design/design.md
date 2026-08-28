# Friink Design

## Product Direction

Friink is a calm, people-first social space centered on meaningful conversations and connection.

## Layout

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

- **Desktop Shell**: Uses a persistent/collapsible navigation sidebar (`SideDrawer`, `16rem` expanded / `4.5rem` collapsed) and a main content panel.
- **Top Headers**:
  - Desktop uses the top `Header` (`3.75rem` height) containing the sidebar toggle hamburger button, full brand logo, Search entry point (`/search`), and Notifications bell (`/notifications`).
  - Mobile and sub-pages use `NavigationBar` containing a history-aware Back button, current page title, and a three-dot overflow button triggering `NavigationMenu`.
- **Persistent Contextual Surface**: The bottom `FloatingBar` (`3.5rem` height) provides the compact Post creation affordance in default mode and seamlessly expands to host full-width contextual composers (e.g. `ChatComposer`, `PostComposerControls`).
- **Feed & Content Layout**: App page content uses the shared `ContentBox` as a fluid, responsive content surface. It does not impose a fixed maximum page width. Page containers reserve bottom spacing (`padding-bottom: calc(var(--space-floating-bar-height) + 2rem)`) to prevent persistent bar overlap.
- **Settings Sections**: Settings uses the shared `Tabs` strip for General, Profile, Account, and Privacy & Safety. Profile edits own public `Name` and `About`; Account edits login/account identifiers such as email, username, and user ID.

## Navigation

> Updated to match shipped behavior as of 2026-08-27 — see CHANGELOG.md entries 2026-08-26, 2026-08-27

Navigation is partitioned across dedicated functional surfaces rather than a single flat list:

1. **FloatingBar (Core Post Action)**:
   - Post (`fa-pen` → `/compose`)
2. **SideDrawer (Personal Identity & Network)**:
   - Signed-in User Identity Block (`ProfileCard` at top)
   - Profile (`fa-user` → `/[username]`)
   - Home (`fa-house` → `/home`)
   - Connections (`fa-user-group` → `/connections`)
   - Chat (`fa-envelope` → `/chat` — labeled "Chat", route `/chat`)
   - Starred (`fa-star` → `/starred`)
   - Footer: Settings (`fa-gear` → `/settings`), Log out (`fa-right-from-bracket`)
3. **Header (Global Utilities)**:
   - Search (`fa-magnifying-glass` → `/search`)
   - Notifications (`fa-bell` → `/notifications`)

## Feed Behavior

> Updated to match shipped behavior as of 2026-08-26 — see CHANGELOG.md entry 2026-08-26

- **Home Timeline**: Offers two primary tabs: `Explore` (default public feed) and `Connections` (posts strictly from followed/connected users).
- **Connections Directory**: A dedicated people management view with `All`, `Followers`, `Following`, and `Requests` filters.
- **Starred Feed**: A preset timeline view containing only starred posts.
- **Starred Posts**: Starred posts display the brand-colored filled star icon (`fa-solid fa-star`).

## Visual Language

- Primary brand color is used for active states, selected tabs, links, and important actions.
- Ink and muted gray provide the primary text hierarchy.
- Thin lines separate navigation, tabs, feed posts, and directory rows.
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

---

## Tokens

The following design tokens are locked hard values extracted directly from the codebase implementation and changelog decisions.

### Corner Radius
- **Buttons and Single-Line Inputs**: `8px` (`--radius-sm: 8px`). Per 2026-08-17 changelog decision, buttons, single-line inputs, search fields, toggle pills, and option menus use an `8px` corner radius, NOT a pill shape.
  - *Codebase `--radius-pill` status*: In `web/app/globals.css` and `web/theme.config.ts`, `--radius-pill` is hard-aliased to `8px` (`:root { --radius-pill: 8px; }`).
  - *Remaining usage of `--radius-pill`*: The token variable `var(--radius-pill)` is still referenced in CSS class selectors (`.settings-toggle-pill`, `.appearance-toggle`, `.message-search`, `.chat-composer input`, `.profile-edit-button`, `.profile-action-button`, `.input-with-prefix`, `.post-submit`, `.floating-bar`, `.floating-bar-item`), but resolves strictly to `8px`.
- **Radius Scale**:
  - `--radius-sm`: `8px` (Buttons, inputs, cards, dropdowns, floating bar)
  - `--radius-md`: `12px`
  - `--radius-lg`: `16px`
  - `--radius-pill`: `8px` (Hard-aliased to 8px; legacy token name)
  - Circular (`50%`): Avatars (`.user-avatar`, `.profile-card-avatar`, `.profile-large-avatar`), circular action icons (`.chat-send`, `.post-option`, `.topbar-menu`, `.feed-post-star`, `.messages-toolbar .icon-plain`)
  - Landing CTA buttons: `4px` (`border-radius: 4px`)

### Colors
- **Brand Colors**:
  - `--color-brand`: `#33aa55` (Primary actions, active states, indicators, focus rings)
  - `--color-brand-soft`: `#eaf5ed` (Light mode tint; Dark mode: `#244d30`)
- **Neutral & Surface Colors**:
  - `--color-ink`: `#111111` (Primary text; Dark mode: `#f5f5f5`)
  - `--color-muted`: `#8a908c` (Secondary text, inactive icons, handles, dates; Dark mode: `#c4c4c4`)
  - `--color-line`: `#e3e6e3` (Borders, dividers; Dark mode: `#555555`)
  - `--color-paper`: `#ffffff` (Card and panel backgrounds, floating bar; Dark mode: `#3d3d3d`)
  - `--color-background`: `#f2f5f1` (App background; Dark mode: `#333333`)
  - `--color-background-accent`: `#e7f2e9` (Subtle accent; Dark mode: `#3a3a3a`)
  - `--color-chrome`: `#262626` (Header/shell dark surfaces)
  - `--color-danger`: `#ed8c6b` / `#b54444` (Error states and destructive actions)
- **Avatar Tone Palette**:
  - Coral: `--color-avatar-coral`: `#f4b3a4`
  - Sage: `--color-avatar-sage`: `#bfdbbd`
  - Sun: `--color-avatar-sun`: `#f6d77c`
  - Mint: `--color-avatar-mint`: `#a9dbba`

### Typography
- **Font Families**:
  - Body & Display: `'Inter', sans-serif` (`--font-body`, `--font-display`)
  - Headings / Landing: `'Nunito Local'`, sans-serif
  - Brand Mark: `Georgia, 'Times New Roman', serif` (`--font-logo`)
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
- **Content Width**: Shell content boxes are fluid (`width: 100%`) and responsive to the available app panel. Avoid hardcoded page max-width rules for primary app content.
- **Desktop Breakpoint**: `768px` (`--breakpoint-desktop`: `768px`, `@media (max-width: 767px)` for mobile behaviors)

---

## Component Contracts

Every shared/reusable component in the codebase must strictly satisfy the contracts below.

### 1. ProfileCard (`web/components/profile-card.tsx`)
- **Purpose**: Canonical identity block displaying avatar, display name, handle, and optional date.
- **Fixed Internal Layout Order**:
  1. Horizontal flex container (`gap: 0.75rem`, `align-items: center`).
  2. Avatar (`.profile-card-avatar`): `2.5rem` x `2.5rem`, circular (`50%` radius), displaying initials (derived from name via `getInitials(name)`, max 2 uppercase chars, fallback `'FR'`). Tinted with `tone` prop (`coral`, `sage`, `sun`, `mint`).
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

### 2. NavigationMenu (`web/components/navigation-menu.tsx`)
- **Purpose**: Reusable contextual popover menu for page-level options, triggered by the three-dot overflow button in `NavigationBar`.
- **Fixed Internal Layout Order**:
  - Popover card (`.navigation-menu`, `role="menu"`).
  - Vertical list of menu items (`.navigation-menu-item`, `role="menuitem"`), each containing an icon (`fa-solid`) and a label.
- **Fixed Items Contract**:
  1. Share profile (`fa-share-nodes`)
  2. Copy link (`fa-link`)
  3. Mute updates (`fa-bell-slash`)
  4. Report (`fa-flag`)
- **Dismissal Behavior**: Must close on outside pointer click (`pointerdown`) and `Escape` keypress.
- **Props Contract**:
  - `open: boolean` (required; renders `null` when `false`)

### 3. FloatingBar (`web/components/floating-bar.tsx`)
- **Purpose**: Persistent contextual bottom surface providing navigation or screen-specific composer actions.
- **Fixed Sizing & Positioning**:
  - `position: fixed`, `bottom: max(1rem, env(safe-area-inset-bottom))`, `left: 1.25rem`, `right: 1.25rem`.
  - `height: 3.5rem` (`var(--space-floating-bar-height)`).
  - Border radius: `8px`, border: `1px solid var(--color-line)`, background: `var(--color-paper)`, box shadow: `0 0.75rem 2rem rgba(24, 44, 31, 0.12)`.
- **Variants & Layout Modes**:
  1. **Default Navigation Mode** (`children` is null/undefined/false):
     - Width: Compact natural width (`width: max-content`, max `28rem`), horizontally centered (`margin: 0 auto`).
     - Fixed Navigation Item: Post (`fa-pen`).
     - Active item highlighted with `color: var(--color-brand)` and `background: var(--color-brand-soft)`.
  2. **Contextual Composer Mode** (`children` is provided):
     - Width: Spans available page width (`width: calc(100% - 2.5rem)`, `.floating-bar-contextual`).
     - Hosts contextual composers (`ChatComposer` or `PostComposerControls`).
- **Layout Constraints**:
  - Page content containers reserve bottom space via `padding-bottom: calc(var(--space-floating-bar-height) + 2rem)` so the persistent bar never obscures page content.
  - Post composer textareas end strictly above the floating bar without triggering nested scrollbars.
- **Props Contract**:
  - `activeScreen: Screen` (required)
  - `onNavigate: (screen: Screen) => void` (required)
  - `children?: ReactNode` (optional; when provided, activates contextual mode)

### 4. ProfileScreen (`web/components/profile-screen.tsx`)
- **Purpose**: Profile view for both signed-in user self-profile and browsable other-user profiles.
- **Fixed Internal Layout Order**:
  1. Top Identity Block (`.profile-intro`): `ProfileCard` with user name, handle, and avatar (`4rem` large avatar).
  2. Bio Text (`.profile-bio`): Left-aligned under identity block, `max-width: 29rem`.
  3. Statistics Row (`.profile-stats`): Left-aligned (`padding-left: 5.875rem`), displaying `0 following` and `0 followers`.
  4. Profile Actions Row (`.profile-actions`): **Always right-aligned** (`justify-content: flex-end`).
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
     - Star button (`.feed-post-star`, right-aligned).
     - More options button (`.feed-post-more`, `fa-ellipsis-vertical`).
  2. Date Row (`.feed-post-date`): Rendered on a separate line **below** the identity block, left-aligned under avatar/name/handle.
  3. Post Body (`.feed-post-body`): Text content.
  4. Post Action Bar (`.feed-post-actions`): Comment (`fa-comment`), Quote (`fa-quote-right`), Like (`fa-heart`), Share (`fa-share-nodes`).
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
  - Right: Search button (`fa-magnifying-glass`) + Notifications bell button (`fa-bell` with indicator dot).
  - *Invariant*: Header owns sidebar toggling; drawer does not duplicate hamburger button.
- **Mobile / Sub-page `NavigationBar`**:
  - Left: History-aware Back button (`fa-arrow-left`) + Page Title (`.navigationbar-title`).
  - Right: Overflow menu button (`fa-ellipsis-vertical`) controlling `NavigationMenu`.
  - *Back Button Rule*: Back navigation is history-aware (`router.push`), disabled when on Home or without history (`window.history.length <= 1`). In-content back buttons are removed to prevent duplication.

### 7. SideDrawer (`web/components/side-drawer.tsx`)
- **Purpose**: Primary desktop sidebar and mobile navigation drawer.
- **Fixed Internal Layout Order**:
  1. Top identity: `ProfileCard` for signed-in user (`.sidebar-profile`).
  2. Main navigation links (`.sidebar-nav`): Profile (`fa-user`), Home (`fa-house`), Connections (`fa-user-group`), Chat (`fa-envelope`), Starred (`fa-star`).
  3. Footer actions (`.sidebar-footer`): Settings (`fa-gear`), Log out (`fa-right-from-bracket`).
- **Responsive Behavior**:
  - Desktop: Persistent, collapsible between `16rem` and `4.5rem`.
  - Mobile (`<768px`): Overlay drawer, auto-collapses on outside click or focus loss.

### 8. ChatComposer (`web/components/chat-composer.tsx`) & PostComposerControls (`web/components/post-composer-controls.tsx`)
- **`ChatComposer`**:
  - Layout: Attachment button (`fa-paperclip`) on left, message input (`border-radius: 8px`) in middle, circular Send button (`fa-arrow-up`, `50%` radius, disabled when empty) on right.
- **`PostComposerControls`**:
  - Layout: Circular Attachment button (`fa-paperclip`, `.post-option`) on left, primary "Post" button (`8px` radius, `.post-submit`) on right.

### 9. Tabs (`web/components/tabs.tsx`)
- **Purpose**: Reusable tab bar with animated sliding indicator line.
- **Layout**: Horizontal tab pill row (`.tabs__pill`, `role="tab"`) with sliding underline indicator (`.tabs__indicator`).
- **Props Contract**: `tabs?: Tab[]`, `activeId?: string`, `onChange?: (id: string) => void`, `ariaLabel?: string`, `className?: string`.

### 10. Form Inputs & Username Prefix Pattern (`InputField`, `account-screens.tsx`)
- **Username Prefix Rule**: In username fields (login, signup, and settings), the `@` prefix is rendered as an explicit inline/prefixed element outside the entered text (with dedicated left padding `2.6rem`), **NEVER** overlapping typed characters.
- **Single-Line Inputs**: Height `2.5rem` to `3rem`, corner radius strictly `8px` (`border-radius: 8px !important`).
- **Button Primitives** (`Button`):
  - Height `3rem`, corner radius `8px` (`.pill-button`).
  - Variants: `brand` (`.pill-button-brand`, background `#33aa55`, color white), `quiet` (`.pill-button-quiet`, background `#eaf5ed`, color ink), and hollow outline (`.signup-back-button`).

### 11. ToastStack (`web/components/toast-stack.tsx`)
- **Purpose**: App-level notification stack for logged-in errors that should not appear inline in page content.
- **Desktop Placement**: Fixed lower-right, above the floating bar, stacking vertically with newest toast appended at the bottom.
- **Mobile Placement**: Fixed bottom center, above the floating bar, stacking upward from the bottom while center-aligned.
- **Content Contract**: Each toast shows the message, a timestamp, and a dismiss icon button.

---

## Unresolved & Contract Violations

None. All historical discrepancies have been resolved to match shipped behavior, and all shared component contracts have been verified against active component implementations across all usage contexts.

