# Navigation

Navigation defines the shared signed-in shell controls that help people move
between Friink surfaces without changing the behavior of the current Header,
NavigationBar, drawer, or tabs.

**Status:** Active  
**Tier:** Minimal  
**Last edited:** 2026-09-24T19:07:47Z
**Platforms:** Web  
**Canonical sources:** [Product rules](../rules.md), [Design system](../design-system.md), [Design implementation contract](../../packages/design/design.md)

## Canonical ownership

This document owns the signed-in TopBar and its interaction contract.
The drawer owns destination discovery, NavigationBar owns the existing
contextual navigation, and Tabs own section selection.

## Related units

- [Feed](./feed.md) — home tabs and feed navigation.
- [Profiles](./profiles.md) — profile contextual actions.
- [Notifications](./notifications.md) — notification destination and unread state.
- [Settings](./settings.md) — settings navigation.
- [Design System](../design-system.md) — shared visual and interaction rules.

## Product definition

The TopBar gives signed-in users a consistent shell surface while preserving
the established search, chat-unread, and notification interactions.

## UX and interaction

- Signed-in screens keep the compact theme-aware Friink mark in the leading
  area, except the search route where Back and the search field use the
  available header space. Activating the mark goes to Home.
- The current screen title remains centered except on the search route, where
  the search field occupies the middle header slot.
- The TopBar's hamburger, Back, Search, Chat, Notifications, Filter, and
  Actions trigger icons are 20px inside 40px hit areas. The title is centered
  at 20px, weight 800. Expanded search uses a 40px-high field, 20px input
  text, and 40px submit/close controls; the existing compact Friink logo
  dimensions are unchanged. ActionMenu row icons are 16px while their labels
  retain the existing type size.
- Home mode provides inline Search, Chat, and Notifications actions. Search
  expands into a text input with bounded scope shortcuts and routes submitted
  queries to `/search/{query}`. Chat shows a dot when conversations are unread, and the
  notification bell shows a dot and opens the unread notification dropdown.
- Contextual mode provides a history-aware Back control, the page title, and
  the shared Search control beside the existing three-dot ActionMenu populated
  by shell-owned menu items. The search route keeps Back and ActionMenu while
  expanding Search between them.
- Post-detail mode uses the title `Post`, keeps the contextual Back control,
  and leaves every drawer destination inactive because a post is not one of
  the drawer's sections.
- All controls use the existing navigation callbacks and server-authoritative
  unread state. The legacy Header remains mounted but visually hidden for
  rollback safety; NavigationBar and Tabs remain rendered and functional.
- The drawer presents the signed-in user's avatar and `@username` as one
  profile destination, with a separate account dropdown on its right. Long
  usernames truncate with an ellipsis and cannot overlap the switcher.
- The drawer avatar is 44px in both expanded and collapsed layouts. The 24px expanded
  account caret sits inside the Profile row at its right edge. Collapsed mode
  overlays a 20px circular caret button flush with the avatar's lower-right
  corner.
- Expanded drawer width is 256px and collapsed width is 77px. Both modes use
  fixed 16px padding on all four sides.
- On mobile, the expanded drawer keeps the same row geometry, gaps, icon cells,
  Profile treatment, and footer placement; it appears as an overlay and fits
  within the available viewport width.
- Navigation and footer action rows use 100% width and 44px height, with 8px
  padding on the top, left, and bottom. Each row has a 28px square inner icon
  cell and a 16px gap before its label. Glyphs are 20px high, use automatic
  width, and are centered in their cells.
- The Profile row is separate from the icon-cell layout. Its picture and
  wrapper are 44×44px with no row padding; the picture keeps the same position
  in expanded and collapsed modes. Its label has a 16px gap after the picture.
- A 16px gap separates the Profile row from navigation rows and navigation
  rows from one another. Footer action rows also have a 16px gap, and the footer
  stays at the bottom of the drawer.
- The account-switcher button stays at the Profile row's right side when
  expanded and overlays the picture's lower-right corner when collapsed. Its
  inner cell is 14×14px with a centered 12×12px glyph.
- The portaled account-switcher menu uses a viewport-safe fixed width. Long
  account names truncate with an ellipsis before the trailing account controls;
  row hover surfaces stay within the menu padding.
- The active drawer row uses a neutral gray fill and theme-appropriate text.
  Its icon is `#111111` in light mode and `#f0f0f0` in dark mode.
- Shared tab labels use the design-system type size, and the active
  label is bold. Tab selection, underline, and horizontal-overflow behavior
  are unchanged.

## Business rules

- **NAV-R-001:** TopBar controls must preserve established destinations and
  action semantics.
- **NAV-R-002:** Back is disabled when shell history says there is no safe
  prior destination.
- **NAV-R-003:** Contextual menu items remain permission- and screen-owned by
  the AppShell; the TopBar only presents and invokes them.
- **NAV-R-004:** The signed-in shell shares one base surface across the TopBar,
  drawer, tabs, content area, and floating navigation: white in light mode and
  `#161616` in dark mode. Interactive states and overlays may use distinct
  surfaces.
- **NAV-R-005:** Search is available on every signed-in screen except that the
  search route displays the search field persistently. Home search is global;
  other screens may provide contextual search behavior.
- **NAV-R-006:** The drawer highlights Profile only for the signed-in user's
  own profile. Viewing another user's profile leaves both Home and Profile
  inactive; it must not inherit the highlight from the previous screen. See
  [WEB-R-017](../rules.md#web-r-017--sidebar-highlight-tracks-only-owned-profile-navigation).
- **NAV-R-007:** Post-detail routes use a contextual `Post` shell state; Home
  is not shown as the current title or highlighted as the active drawer item.

## Acceptance criteria

- [ ] **NAV-AC-001** Home Search expands, submits to search, Chat shows unread
  state, and Notifications opens its unread dropdown.
- [ ] **NAV-AC-002** Contextual Back and ActionMenu invoke the existing
  shell handlers.
- [ ] **NAV-AC-003** Existing Header, NavigationBar, and Tabs remain intact.
- [ ] **NAV-AC-004** Light/dark logo variants remain readable and accessible.
- [ ] **NAV-AC-005** Legacy Header is hidden without being
  deleted, and the TopBar does not leave a reserved navigation gap.
- [ ] **NAV-AC-006** Opening another user's profile does not leave Home or
  Profile highlighted in the drawer; opening the signed-in user's profile
  highlights Profile.
- [ ] **NAV-AC-007** Opening a post shows `Post` in the contextual header and
  leaves Home and all other drawer destinations inactive.
- [ ] **NAV-AC-008** The drawer shows one standard-height Profile row with the
  signed-in user's avatar, marks only that row active on their own profile,
  and keeps the account menu on a separate right-side caret.

## Verification checklist

- [ ] TypeScript check passes.
- [ ] Home and contextual localhost routes return successfully.
- [ ] `git diff --check` passes.
