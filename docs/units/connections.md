# Connections

Connections defines directional following relationships, followers, following,
requests, and the visibility and access consequences of those relationships.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns follow edges and follow-request state. Blocking owns blocked
relationships; Chat owns message access after relationship checks.

## Related units

- [Profiles](./profiles.md) — presents connection actions on profiles.
- [Blocking](./blocking.md) — removes or prevents relationships.
- [Chat](./chat.md) — uses mutual accepted follows for ordinary chat access.
- [Feed](./feed.md) — uses following relationships for the Following feed.
- [Notifications](./notifications.md) — receives request and acceptance events.

## Rules

- **CONNECTIONS-R-001:** Relationships are directional; accepted rows count as
  connections only when the relevant direction is accepted.
- **CONNECTIONS-R-002:** Public accounts accept follows immediately.
- **CONNECTIONS-R-003:** Private accounts require pending requests and expose a
  private Requests tab to the owner.
- **CONNECTIONS-R-004:** Rejected and owner-removed requests observe the active
  cooldown rules; cancellation has its own resend lockout.
- **CONNECTIONS-R-005:** Changing a private account to public auto-accepts
  eligible pending requests.
- **CONNECTIONS-R-006:** Follow counts include accepted relationships only.
- **CONNECTIONS-R-007:** Connection actions resolve from authenticated API
  status after profile loading and never inherit self-profile state.

## UX and flows

The owner's Connections surface includes All, Followers, Following, and
Requests. Incoming requests provide Accept and Reject actions. Profile actions
show Follow, Following, Pending, or the appropriate unavailable state based on
server status.

## Technical contract

The API is implemented in `api/app/routers/connections.py` and
`services/connections.py`. The client uses status and list responses; it must
not infer relationship state from cached profile identity.

## Acceptance criteria

- [ ] **CONNECTIONS-AC-001** Public and private account follow behavior differs correctly.
- [ ] **CONNECTIONS-AC-002** Requests are visible and actionable to the owner.
- [ ] **CONNECTIONS-AC-003** Counts exclude pending/rejected relationships.
- [ ] **CONNECTIONS-AC-004** Cooldowns and cancellation rules are enforced.
- [ ] **CONNECTIONS-AC-005** Follow state is server-authoritative on profiles.

## Known limitations

Professional verification and PMDC status are not part of Connections.
