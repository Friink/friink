# Notifications

Notifications communicates important activity, security events, follow
requests, accepted requests, mentions, and other user-visible events.

**Status:** Partial
**Tier:** Standard  
**Last edited:** 2026-09-22T12:33:44Z
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
- **NOTIFY-R-008:** Manual subscription grant, change, and revoke operations
  create a recipient-owned in-app notification that links to Subscription
  settings; notification delivery does not roll back the access mutation.

## UX and flows

The TopBar bell shows an unread indicator and count pill. Its compact dropdown uses a
shared contextual surface, measures its rendered top edge, remains within the
current viewport, shows at most eight rendered rows at once, and scrolls only its
unread list after the eighth row while keeping the destination footer visible.
`/notifications` provides the
full list with tabs, filters, read tracking, actions, loading, empty, and retry
states. Security notifications use the shield treatment and may link to
session review.

Registration submissions and staff decisions are rendered as Friink
notifications in the in-app list and top-bar dropdown. They explain pending,
approved, declined, and revoked outcomes; a declined request can be submitted
again immediately.

### External notification setup (planned)

The platform-neutral setup UX is owned here even though external delivery is
not implemented yet. A user may open `Settings > Notifications` and choose
`Enable notifications`. Friink explains that this enables alerts when the app
is closed, then requests browser/OS permission only after the user activates
the control. On success, the setting shows `Notifications enabled on this
device`. A contextual prompt may offer the same action after a user opens a
chat or receives a meaningful notification, but it must provide `Not now` and
must not repeatedly prompt after denial.

The setting must represent at least these states: not enabled, enabled,
blocked by browser/OS settings, unsupported, and temporarily unavailable.
Blocked and unsupported states retain in-app notifications and explain the
next available action. Users can disable external delivery from the same
setting. Platform-specific prerequisites, such as installing a web app on a
mobile home screen, belong behind this common flow and should not change its
language or data model.

## Technical contract

API endpoints are in `api/app/routers/notifications.py`; records and outbox
behavior are represented by notification models and services. The web surface
uses `notifications-screen.tsx` and the TopBar dropdown.

The push-subscription API foundation is implemented: authenticated clients can
list their active subscriptions, create or replace a subscription by endpoint,
and revoke an owned subscription. Subscription keys are accepted for delivery
but are not returned in API responses. The `push_subscriptions` table is added
by migration `20260923_0055`.

### Planned Web Push requirements

External delivery should use the standard Web Push protocol with VAPID, not a
platform-specific Windows tray service. The browser supplies a subscription
endpoint; the API sends an encrypted push through the browser/vendor push
service, and a service worker displays the operating-system notification. The
same backend contract should support desktop and mobile browsers, subject to
each platform's permission and installation requirements.

Required implementation pieces:

- A secure-context service-worker registration and push handler in the web
  client.
- A user-gesture-gated permission and subscription flow exposed through the
  shared notification settings UX.
- Server-only VAPID private key and environment-specific public key/configuration;
  secrets must not be committed.
- A push-subscription persistence model associated with the authenticated user
  and device/browser, with endpoint uniqueness, timestamps, active/revoked
  state, and cleanup for expired subscriptions.
- Create, replace, and revoke subscription API operations protected by the
  existing authentication and CSRF protections.
- A durable notification/outbox flow that sends push only after the source
  notification commits; delivery failure must not roll back the source action.
- Best-effort retries, deduplication by notification ID, and removal of
  subscriptions rejected as expired or invalid by the push service.
- Payloads limited to safe notification text and a canonical Friink target
  route; they must not contain secrets, internal IDs, or sensitive account
  existence information.
- Service-worker click handling that focuses an existing Friink client or
  opens the target route, then lets the app reconcile read state with the API.
- Notification preferences for meaningful events such as direct messages,
  mentions, connection requests, and security alerts. In-app notifications
  remain the source of truth when external delivery is unavailable.

### Implementation plan

The low-risk Web Push scope is split into five deliverables. The target for a
production-ready implementation is approximately 7–10 engineering days,
subject to the worker-runtime decision below.

1. **Push subscription foundation** — Add the subscription model and migration,
   authenticated create/replace/revoke operations, and basic cleanup.
2. **Browser enable/disable flow** — Register the service worker, handle
   permission states, and add the Settings > Notifications controls for
   enabling, disabling, and recovering external delivery.
3. **Push delivery integration** — Configure VAPID, send safe Web Push payloads,
   and handle notification clicks by opening the canonical Friink route.
4. **Outbox and failure handling** — Extend the existing outbox for push,
   including retries, deduplication, invalid-subscription removal, and source
   action isolation.
5. **Verification and release hardening** — Add targeted API tests, browser
   checks, permission and delivery-failure coverage, multi-device checks, and
   staging verification.

## Acceptance criteria

- [ ] **NOTIFY-AC-001** Unread count and list are server-authoritative.
- [ ] **NOTIFY-AC-002** Read actions are duplicate-safe.
- [ ] **NOTIFY-AC-003** Hidden documents pause polling and recover on focus.
- [ ] **NOTIFY-AC-004** Security and activity views expose correct content.
- [ ] **NOTIFY-AC-005** Event/delivery failure cannot alter the source action.
- [ ] **NOTIFY-AC-006** A user can enable, disable, and recover external
  notification delivery from the shared notification settings flow.
- [ ] **NOTIFY-AC-007** A valid subscription is stored per authenticated
  user/device and invalid subscriptions are retired safely.
- [ ] **NOTIFY-AC-008** A committed notification can produce a Web Push alert
  without requiring an open Friink page or live polling session.
- [ ] **NOTIFY-AC-009** Clicking an external notification opens its canonical
  Friink destination and reconciles read state through the API.
- [ ] **NOTIFY-AC-010** Permission denial, unsupported browsers, expired
  subscriptions, and delivery failures preserve the in-app notification path.

## Known limitations

External email and push notification delivery are not active product channels.
Manual subscription grant, change, and revoke events now use the active
in-app notification channel; expiry reminders and expiry notifications remain
planned.
The service worker, VAPID configuration, external-delivery sender, and push
outbox processing are not implemented yet. The subscription persistence and
authenticated management API are now implemented, but they do not deliver
push notifications by themselves.

## Open questions

- Which Python Web Push library will be adopted for the FastAPI service?
- Should notification preferences be stored with the notification settings
  model or a dedicated delivery-preferences model?
- Which notification types are enabled by default when a user opts in?
- What queue/worker runtime will drain the notification outbox in each
  environment?
