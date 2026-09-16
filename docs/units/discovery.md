# Discovery

Discovery helps users find people and content through search, the directory,
and related public discovery surfaces.

**Status:** Partial — search exists; Directory is not implemented  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns search, directory, and discovering people or content. It
does not own professional/PMDC verification, badges, or credentials; that
future boundary remains undecided.

## Related units

- [Profiles](./profiles.md) — owns the profile shown after discovery.
- [Posts](./posts.md) — owns content shown in discovery results.
- [Connections](./connections.md) — owns follow actions from people results.
- [Design System](../design-system.md) — owns shared search-result rows and surfaces.

## Rules

- **DISCOVERY-R-001:** Search suggestions and results use shared contextual and
  list patterns and link to canonical people/content destinations.
- **DISCOVERY-R-002:** Search results must not invent profile identities or
  expose unavailable protected content.
- **DISCOVERY-R-003:** The Directory route is currently a placeholder with no
  real backing logic; it must be classified as Planned/Not implemented, not
  Aligned.
- **DISCOVERY-R-004:** Professional verification and PMDC status are out of
  scope until a separate product boundary and requirements are approved.

## UX and flows

The signed-in TopBar offers inline text-only suggestions and routes submitted queries to
`/search/{query}`. Search results use shared `PageSurface`, `ListRow`, and
identity blocks. `/directory` exists as a navigation destination but currently
renders a placeholder surface.

## Technical contract

Search routes and rendering exist in `web/app/search` and the signed-in TopBar;
the current Directory screen has no real API-backed discovery contract.

## Acceptance criteria

- [ ] **DISCOVERY-AC-001** Search suggestions remain text-only and bounded.
- [ ] **DISCOVERY-AC-002** Search results use canonical profile/content links.
- [ ] **DISCOVERY-AC-003** Unavailable content is not synthesized.
- [ ] **DISCOVERY-AC-004** Directory remains explicitly planned/unimplemented.
- [ ] **DISCOVERY-AC-005** Professional verification remains out of scope.

## Open questions

- Define the future Directory product boundary and whether professional/PMDC
  verification belongs in Discovery, Profiles, or a separate unit before it is
  built.

## Current implementation status

Search is implemented through the current web surface. Directory navigation
exists, but its real data and backing behavior are not implemented.
