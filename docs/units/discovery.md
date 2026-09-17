# Discovery

Discovery helps users find people and content through search, the directory,
and related public discovery surfaces.

**Status:** Partial — search and directory API foundation exist; directory UI is next
**Tier:** Standard  
**Last edited:** 2026-09-17T02:15:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns search, directory, and discovering people or content. It
owns directory eligibility and listing presentation. Profile badge and
credential presentation belongs to [Profiles](./profiles.md), while staff
review decisions belong to [Staff Admin](./staff-admin.md).

## Related units

- [Profiles](./profiles.md) — owns the profile shown after discovery.
- [Posts](./posts.md) — owns content shown in discovery results.
- [Connections](./connections.md) — owns follow actions from people results.
- [Subscriptions](./subscriptions.md) — owns the plan state used by directory eligibility.
- [Staff Admin](./staff-admin.md) — owns registration review decisions consumed by the directory.
- [Design System](../design-system.md) — owns shared search-result rows and surfaces.

## Rules

- **DISCOVERY-R-001:** Search suggestions and results use shared contextual and
  list patterns and link to canonical people/content destinations.
- **DISCOVERY-R-002:** Search results must not invent profile identities or
  expose unavailable protected content.
- **DISCOVERY-R-003:** The Directory UI uses three tabs: `All`,
  `Professionals`, and `Friink Registered`. `All` includes eligible members
  from either group.
- **DISCOVERY-R-004:** Friink registration and credential review are staff-owned
  API workflows; directory consumes their server-resolved result and
  must not approve or infer verification in the client.
- **DISCOVERY-R-005:** Directory eligibility requires an active Pro
  or Pro+ subscription and either a self-declared professional intent or an
  active Friink registration. A subscription is not required to apply for
  registration.
- **DISCOVERY-R-006:** Directory access and directory listing are separate.
  Having a qualifying subscription grants eligibility to list; it does not
  automatically publish the profile. Listing remains an explicit, off-by-
  default user preference.
- **DISCOVERY-R-007:** Each directory result uses the shared `ListRow`
  component. The left side contains the profile card and About text; the right
  side contains one registration-type column. A user may show both
  `Professional` and `Friink Registered` labels in that column.
- **DISCOVERY-R-008:** The complete row links to the user's public profile and
  remains responsive; on narrow screens the secondary content may stack below
  the profile card.
- **DISCOVERY-R-009:** The initial directory order may be randomized. A future
  location-aware order should use a profile-settings location when present,
  falling back to the account-creation location when it is not. Location must
  not be inferred or exposed beyond the agreed directory presentation.
- **DISCOVERY-R-010:** A user disappears from the directory immediately when
  listing is disabled, subscription access expires or is revoked, or active
  Friink registration is revoked and no professional intent remains.
- **DISCOVERY-R-011:** Search suggestions are actionable: selecting a
  suggestion opens the selected result or search context, while pressing Enter
  opens the full search page for the typed query.
- **DISCOVERY-R-012:** Home search is global across people, usernames, posts,
  conversations, and hashtags. Search on another surface is contextual to
  that surface; Messages searches permitted users, usernames, conversations,
  and chat content.
- **DISCOVERY-R-013:** Search results are permission-aware and API-backed.
  Private profiles, conversations, and content must not be exposed to users
  without access. Results use pagination, bounded result counts, and indexed
  queries so the interface remains responsive as content grows.

## UX and flows

The signed-in TopBar offers inline text-only suggestions and routes submitted queries to
`/search/{query}`. Search results use shared `PageSurface`, `ListRow`, and
identity blocks. `/directory` will use the same surface patterns, with the
three tabs above and an empty state for each tab. The directory is a
professional listing for now, not a category system. The API returns eligible
professional profiles and includes the `Professional` and/or `Friink
Registered` badge state when applicable.

## Technical contract

Search routes and rendering exist in `web/app/search` and the signed-in TopBar;
the current Directory screen has no real API-backed discovery UI contract.

## Acceptance criteria

- [ ] **DISCOVERY-AC-001** Search suggestions remain text-only and bounded.
- [ ] **DISCOVERY-AC-002** Search results use canonical profile/content links.
- [ ] **DISCOVERY-AC-003** Unavailable content is not synthesized.
- [ ] **DISCOVERY-AC-004** Directory UI replaces the placeholder with the three
  requested tabs and responsive shared rows.
- [x] **DISCOVERY-AC-005** Directory eligibility uses server-resolved
  subscription and professional/registration state.
- [x] **DISCOVERY-AC-006** Directory removes users when Pro/Pro+ access expires
  or is revoked.

## Open questions

- Search provider and index rollout details will be finalized during backend
  implementation; the product behavior above is already agreed.
- Initial ordering is randomized; location-aware ordering is a later enhancement
  using profile location with account-creation location as fallback.

## Current implementation status

Search is implemented through the current web surface. Directory navigation
exists, but its real data and backing behavior are not implemented.
