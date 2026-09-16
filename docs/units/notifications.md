# Notifications

Notifications communicates important activity, security events, follow
requests, accepted requests, mentions, and other user-visible events.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-16T02:32:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns notification records, unread state, list behavior, read
actions, and notification-specific presentation. Producing units own the event
meaning that causes a notification.

## Related units

- [Account Access](./account-access.md) — produces security and login events.
- [Connections](./connections.md) — produces request and acceptance events.
- [Posts](./posts.md) — produces mention and Like events.
- [Chat](./chat.md) — contributes chat activity/unread state.
- [Design System](../design-system.md) — owns shared dropdown, row, and toast patterns.

## Rules

- **NOTIFY-R-001:** In-app notifications are fetchable, readable, and marked
  read individually or all at once.
- **NOTIFY-R-002:** Unread count is server-authoritative and uses adaptive
  polling that pauses while the document is hidden.
- **NOTIFY-R-003:** The header dropdown shows unread items only, is empty at
  zero unread, and provides an All Notifications destination.
- **NOTIFY-R-004:** The full surface supports All/Security views, unread-only
  filtering, scroll-based read tracking, and inline request actions.
- **NOTIFY-R-005:** Important events are duplicate-safe and delivery failure
  cannot roll back the operation that produced the event.
- **NOTIFY-R-006:** Notification content must not expose secrets, internal IDs,
  or account-sensitive existence information.
- **NOTIFY-R-007:** Optimistic read state must survive notification-list
  refreshes while a read mutation settles; stale polling responses must not
  restore the bell dot or reclassify a read item as new.

## UX and flows

The TopBar bell shows an unread indicator and count pill. Its compact dropdown uses a
shared contextual surface, measures its rendered top edge, remains within the
current viewport, shows at most eight rendered rows at once, and scrolls only its
unread list after the eighth row while keeping the destination footer visible.
`/notifications` provides the
full list with tabs, filters, read tracking, actions, loading, empty, and retry
states. Security notifications use the shield treatment and may link to
session review.

## Technical contract

API endpoints are in `api/app/routers/notifications.py`; records and outbox
behavior are represented by notification models and services. The web surface
uses `notifications-screen.tsx` and the TopBar dropdown.

## Acceptance criteria

- [ ] **NOTIFY-AC-001** Unread count and list are server-authoritative.
- [ ] **NOTIFY-AC-002** Read actions are duplicate-safe.
- [ ] **NOTIFY-AC-003** Hidden documents pause polling and recover on focus.
- [ ] **NOTIFY-AC-004** Security and activity views expose correct content.
- [ ] **NOTIFY-AC-005** Event/delivery failure cannot alter the source action.

## Known limitations

External email and push notification delivery are not active product channels.
