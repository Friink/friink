# Navigation

Navigation defines the shared signed-in shell controls that help people move
between Friink surfaces without changing the behavior of the current Header,
NavigationBar, drawer, or tabs.

**Status:** Active  
**Tier:** Minimal  
**Last edited:** 2026-09-22T23:29:46Z
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

## Business rules

- **NAV-R-001:** TopBar controls must preserve established destinations and
  action semantics.
- **NAV-R-002:** Back is disabled when shell history says there is no safe
  prior destination.
- **NAV-R-003:** Contextual menu items remain permission- and screen-owned by
  the AppShell; the TopBar only presents and invokes them.
- **NAV-R-004:** The preview TopBar uses the same surface token as the side
  drawer: `--color-paper` in light mode and the shell's `--color-chrome`
  override in dark mode.
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

## Verification checklist

- [ ] TypeScript check passes.
- [ ] Home and contextual localhost routes return successfully.
- [ ] `git diff --check` passes.
