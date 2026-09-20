# Profiles

Profiles are the public and owner-facing identity surfaces for Friink users,
including profile details, profile content tabs, profile pictures, and profile
actions.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-16T23:44:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns profile presentation, public identity, profile-scoped
content, and profile actions. Account credentials and lifecycle state belong to
[Account Access](./account-access.md) and [Account Lifecycle](./account-lifecycle.md).

## Related units

- [Account Access](./account-access.md) — owns account identity and access.
- [Account Lifecycle](./account-lifecycle.md) — owns setup and lifecycle state.
- [Connections](./connections.md) — owns follow state and profile connection actions.
- [Posts](./posts.md) — owns post, reply, quote, and reaction semantics.
- [Media](./media.md) — owns profile-picture processing and storage.
- [Subscriptions](./subscriptions.md) — owns the subscription gate for directory visibility.
- [Staff Admin](./staff-admin.md) — owns Friink registration review decisions.
- [Design System](../design-system.md) — owns shared identity and surface patterns.

## Product definition

A profile should make a person's identity, About text, public statistics,
content, and available actions understandable. The signed-in user's profile
supports editing; another user's profile supports only actions allowed by
relationship, privacy, and blocking state.

## Rules

- **PROFILE-R-001:** Usernames are case-insensitive identities and accepted
  values are canonicalized for storage and routing.
- **PROFILE-R-002:** An unknown username renders `Does not exist or unavailable.`
  and never falls back to a synthetic or signed-in identity.
- **PROFILE-R-003:** Profile identity blocks use the shared `ProfileCard` and
  link to the canonical profile route when navigation is intended.
- **PROFILE-R-004:** Self-profile and other-user profile actions are distinct;
  other-user actions resolve from authenticated connection status.
- **PROFILE-R-005:** Public profile tabs include posts, replies, and likes only
  when the relevant visibility rules permit them.
- **PROFILE-R-006:** Shared profile-picture avatars use the app accent color
  for their border in both light and dark themes; the border must not invert
  with the foreground text color.
- **PROFILE-R-006:** Empty About text shows no visitor-facing placeholder; the
  owner sees `Add about in settings.`.
- **PROFILE-R-007:** Profile pictures are optional and retain the last
  server-confirmed image until a complete upload succeeds.
- **PROFILE-R-008:** Profile posts, replies, and connection counts load from
  author-scoped API requests; pagination arguments must preserve their named
  meaning so a profile never silently loses its content after the shell loads.
- **PROFILE-R-009:** Profile Edit, Follow/Unfollow, and Message actions use the
  primary button treatment. Other-user connection actions that include a label
  use the standard text-button layout so the icon and label remain on one line;
  Message remains an icon-only control with primary styling.
- **PROFILE-R-010:** Other-user profile moderation actions are exposed through
  the shell-owned contextual NavigationBar menu; Block is not rendered as a
  detached action-row menu.
- **PROFILE-R-011:** Profile bootstrap shows an explicit session-restoration
  state and a retry action for recoverable API failures; it never leaves the
  profile as a blank surface while authentication is being restored.
- **PROFILE-R-012:** When the owner enables the professional-profile badge
  preference, the public profile renders `Professional` immediately next to
  the displayed name. The badge is omitted otherwise.
- **PROFILE-R-013:** Friink registration is a separate staff-granted
  status. An active registered profile shows a `Friink Registered` badge by
  default, and the owner may hide or show that badge from Settings.

## UX and flows

Profile pages show identity, About, follower/following statistics, actions,
and Posts/Replies tabs. Loading and unavailable states are explicit. A self
profile offers Edit; another profile may offer Message or connection actions.
The shared profile-card identity name row may include the opt-in `Professional`
badge next to the displayed name. Data-backed profile cards reuse the same
visibility value across profiles, posts, quoted posts, connections, chat,
notifications, likes, blocked users, and remembered-account surfaces.
The contextual NavigationBar overflow menu exposes Block for another user and
opens the shared confirmation modal. Profile content uses author-scoped routes
and visibility rules.

### Friink registration (user flow active)

The owner profile Actions menu will open a registration modal collecting Institute
and Credential ID. After submission, the action becomes read-only while the
request is pending, with cancellation available. Rejected users may reapply
immediately. Staff approval or revocation controls the `Friink Registered` badge;
clicking or hovering the badge opens the approved institute and credential
information. The application history and staff decision messages remain
available to staff, while user-facing decisions are notified in-app and by
email. The user API contracts are `GET/POST /professional-registration`,
`POST /professional-registration/cancel`, and
`PATCH /professional-registration/preferences`.

## Technical contract

Web implementation is centered in `ProfileScreen`, `ProfileCard`, and dynamic
`web/app/[username]` routes. Public-user resolution is API-backed. Profile
picture upload uses the shared media contract.

## Acceptance criteria

- [ ] **PROFILE-AC-001** Unknown profiles never render synthetic content.
- [ ] **PROFILE-AC-002** Self and other-user actions resolve independently.
- [ ] **PROFILE-AC-003** Profile tabs respect author-scoped visibility.
- [ ] **PROFILE-AC-004** Profile identity blocks use the shared pattern.
- [ ] **PROFILE-AC-005** Profile-picture failure preserves the confirmed image.

## Known limitations

Native mobile profile behavior is deferred until a mobile client exists.
