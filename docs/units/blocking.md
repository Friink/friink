# Blocking

Blocking protects users by preventing new relationship and message access and
by hiding protected identity/content where required.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns bilateral blocking and unblocking behavior. Connections,
Chat, Profiles, Notifications, and Posts consume its access decisions.

## Related units

- [Connections](./connections.md) — blocking removes follow relationships.
- [Chat](./chat.md) — existing chats remain readable but become read-only.
- [Profiles](./profiles.md) — blocked profiles use an unavailable state.
- [Settings](./settings.md) — owns the blocked-people management surface.

## Rules

- **BLOCK-R-001:** A signed-in user may block another user from that user's
  profile regardless of follow, chat, or subscription state.
- **BLOCK-R-002:** Blocking removes accepted and pending follow relationships
  in both directions transactionally.
- **BLOCK-R-003:** Unblocking never restores removed relationships.
- **BLOCK-R-004:** Blocking is bilateral for profile, follow, and message access.
- **BLOCK-R-005:** Existing chats and pending requests remain readable but are
  read-only where required; retained messages and notifications are not erased.
- **BLOCK-R-006:** Blocking creates no notification and self-blocking is rejected.
- **BLOCK-R-007:** Server-side checks are authoritative for direct URLs and API
  operations.

## UX and flows

Profile overflow opens a shared confirmation modal. Privacy > Blocked people
provides API-backed search, loading, unblock actions, and explicit feedback.
Blocked profiles render `Profile unavailable.` rather than a synthetic identity.

## Technical contract

Implemented through `services/blocking.py`, user routes, shared `ActionMenu`,
`Modal`, `ListRow`, and `ProfileCard`. Blocking checks must be bilateral and
transactional.

## Acceptance criteria

- [ ] **BLOCK-AC-001** Block removes both-direction relationship edges.
- [ ] **BLOCK-AC-002** Unblock does not restore relationships.
- [ ] **BLOCK-AC-003** Blocked users cannot start new message/follow access.
- [ ] **BLOCK-AC-004** Existing chat retention/read-only behavior is preserved.
- [ ] **BLOCK-AC-005** Direct blocked-profile routes show unavailable state.

## Known limitations

No separate moderation/reporting product has been specified yet.
