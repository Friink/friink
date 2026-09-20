# Discovery

Discovery owns the professional directory and related public discovery
surfaces. Cross-surface search belongs to [Search](./search.md).

**Status:** Partial — directory UI is present; backing behavior is incomplete
**Tier:** Standard  
**Last edited:** 2026-09-17T19:27:34Z
**Platforms:** Web and API

## Canonical ownership

This document owns the professional directory and its eligibility and listing
presentation. Cross-surface search belongs to [Search](./search.md). Profile badge and
credential presentation belongs to [Profiles](./profiles.md), while staff
review decisions belong to [Staff Admin](./staff-admin.md).

## Related units

- [Profiles](./profiles.md) — owns the profile shown after discovery.
- [Search](./search.md) — owns cross-surface search, suggestions, and search permissions.
- [Posts](./posts.md) — owns content shown in discovery results.
- [Connections](./connections.md) — owns follow actions from people results.
- [Subscriptions](./subscriptions.md) — owns the plan state used by directory eligibility.
- [Staff Admin](./staff-admin.md) — owns registration review decisions consumed by the directory.
- [Design System](../design-system.md) — owns shared directory-row and surface contracts.

## Rules

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
  component. The left side contains the profile card, About text, and the
  `Professional` and/or `Friink Registered` badges beside the name; the right
side contains contextual profile actions in this order: Chat, Follow or
Unfollow, and the More actions menu. These actions are icon-only controls.
The `ProfileCard` renders only active badges beside the name. The Professional
badge uses the icon-only `fa-briefcase` with a `Professional` hover label; the
Friink Registered badge uses icon-only `fa-shield-halved` with a `Friink
Registered` hover label.
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

## UX and flows

`/directory` uses shell-level shared `Tabs` for `All`, `Professionals`, and
`Friink Registered`, then renders shared `PageSurface`, `ListRow`, and identity
patterns inside the capped content box. Each row presents the profile card,
About text, name-adjacent status badges, and right-side icon-only Chat,
Follow/Unfollow, and More actions; rows link to the public profile and stack
their secondary content on narrow screens. The current UI uses presentational
preview entries until the API-backed directory is wired.
The directory is a professional listing for now, not a category system.

## Technical contract

The current Directory screen is presentational only. The API-backed discovery
contract is still pending: eligible/listed profiles, server-resolved status,
privacy filtering, ordering, pagination, and removal after eligibility changes.
Cross-surface search routes, rendering, and API behavior are documented in
[Search](./search.md).

## Acceptance criteria

- [x] **DISCOVERY-AC-004** Directory UI replaces the placeholder with the three
  requested tabs and responsive shared rows.
- [x] **DISCOVERY-AC-005** Directory eligibility uses server-resolved
  subscription and professional/registration state.
- [x] **DISCOVERY-AC-006** Directory removes users when Pro/Pro+ access expires
  or is revoked.

## Open questions

- Initial ordering is randomized; location-aware ordering is a later enhancement
  using profile location with account-creation location as fallback.

## Current implementation status

Directory navigation and the presentational UI exist, but its real data and
backing behavior are not implemented. Search status is maintained in
[Search](./search.md).

## Known limitations

Directory data, server eligibility/listing enforcement, and API-backed loading
remain incomplete. The UI currently uses preview entries.
