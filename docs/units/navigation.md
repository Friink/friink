# Navigation

Navigation defines the shared signed-in shell controls that help people move
between Friink surfaces without changing the behavior of the current Header,
NavigationBar, drawer, or tabs.

**Status:** Active  
**Tier:** Minimal  
**Last edited:** 2026-09-16T21:18:38Z
**Platforms:** Web  
**Canonical sources:** [Product rules](../rules.md), [Design system](../design-system.md), [Design implementation contract](../../packages/design/design.md)

## Canonical ownership

This document owns the signed-in TopBar preview and its interaction contract.
The drawer owns destination discovery, NavigationBar owns the existing
contextual navigation, and Tabs own section selection.

## Related units

- [Feed](./feed.md) — home tabs and feed navigation.
- [Profiles](./profiles.md) — profile contextual actions.
- [Notifications](./notifications.md) — notification destination and unread state.
- [Settings](./settings.md) — settings navigation.
- [Design System](../design-system.md) — shared visual and interaction rules.

## Product definition

The TopBar preview gives signed-in users a consistent, testable shell surface
without removing the existing Header or NavigationBar before the new design is
accepted.

## UX and interaction

- Every mode keeps the compact theme-aware Friink mark in the leading area;
  activating it goes to Home. Home adds the sidebar toggle, while contextual
  screens add Back beside the mark.
- The current screen title remains centered in every mode.
- Contextual mode provides a history-aware Back control, the page title, and
  the existing three-dot ActionMenu populated by shell-owned menu items.
- All controls use the existing navigation callbacks, so the preview does not
  create parallel routing or notification semantics.
- The existing Header and NavigationBar remain mounted but are visually hidden
  during preview evaluation; their code and state remain available for safe
  rollback. Tabs remain rendered and functional.

## Business rules

- **NAV-R-001:** Preview controls must preserve established destinations and
  action semantics.
- **NAV-R-002:** Back is disabled when shell history says there is no safe
  prior destination.
- **NAV-R-003:** Contextual menu items remain permission- and screen-owned by
  the AppShell; the TopBar only presents and invokes them.
- **NAV-R-004:** The preview TopBar uses the same surface token as the side
  drawer: `--color-paper` in light mode and the shell's `--color-chrome`
  override in dark mode.

## Acceptance criteria

- [ ] **NAV-AC-001** Home preview actions navigate to the established screens.
- [ ] **NAV-AC-002** Contextual preview Back and ActionMenu invoke the existing
  shell handlers.
- [ ] **NAV-AC-003** Existing Header, NavigationBar, and Tabs remain intact.
- [ ] **NAV-AC-004** Light/dark logo variants remain readable and accessible.
- [ ] **NAV-AC-005** Legacy Header and NavigationBar are hidden without being
  deleted, and the TopBar does not leave a reserved navigation gap.

## Verification checklist

- [ ] TypeScript check passes.
- [ ] Home and contextual localhost routes return successfully.
- [ ] `git diff --check` passes.
