# Staff Admin

Staff Admin is the privileged control-panel surface for staff discovery, roles,
permissions, user management, security operations, privileged sessions, and
audit information.

**Status:** Partial — staff discovery, bootstrap, roles, and user controls are implemented; several sections are placeholders  
**Tier:** Full  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns privileged staff access and control-panel behavior. Ordinary
account access remains defined by [Account Access](./account-access.md).

## Related units

- [Account Access](./account-access.md) — ordinary identity/session foundation.
- [Account Lifecycle](./account-lifecycle.md) — user lifecycle actions exposed to staff.
- [Notifications](./notifications.md) — security/audit notifications.
- [Subscriptions](./subscriptions.md) — administrative plan assignments.
- [Design System](../design-system.md) — shared panel, modal, and table patterns.

## Product definition

Staff use normal Friink accounts plus role- and permission-controlled
administrative capabilities. Privileged access requires stronger, time-limited
protection and must not interrupt ordinary personal use.

## Rules

- **STAFF-R-001:** `is_staff` controls discoverability only; it does not
  authorize sensitive actions.
- **STAFF-R-002:** Effective permissions are the union of assigned role
  permissions and additive direct grants.
- **STAFF-R-003:** The server authorizes every protected operation regardless of
  visible tabs or controls.
- **STAFF-R-004:** Missing or expired privileged access invokes a shared
  step-up verification flow while preserving the ordinary session.
- **STAFF-R-005:** Staff actions and security operations are audited with
  idempotent events and redacted sensitive data.
- **STAFF-R-006:** The panel exposes Overview, Staff, Users, Security & Sessions,
  Audit Log, and Public site; only Users is functional in the current rollout.
- **STAFF-R-007:** Staff sessions have a separate privileged timeout and can be
  revoked without treating ordinary personal access as privileged.

## UX and flows

The drawer shows Control panel only for staff discovery. The panel presents
permission-aware tabs and actions. Users with no effective access see a calm
no-access state. Expired privileged access opens a step-up modal; closing it
returns to the prior screen.

## Technical contract

Routes are in `api/app/routers/staff.py` and related auth-operation routers;
web behavior is in `control-panel-screen.tsx`. Roles, grants, staff state,
privileged sessions, and audit records are server-backed.

## Acceptance criteria

- [ ] **STAFF-AC-001** Discoverability never substitutes for authorization.
- [ ] **STAFF-AC-002** Role and direct-grant permissions combine additively.
- [ ] **STAFF-AC-003** Unauthorized actions fail server-side.
- [ ] **STAFF-AC-004** Step-up expiry preserves ordinary personal access.
- [ ] **STAFF-AC-005** Sensitive actions produce safe audit records.
- [ ] **STAFF-AC-006** Placeholder panel sections are not presented as functional.

## Known limitations

The full staff dashboard, moderation requirements, and some control-panel
sections remain to be specified and implemented.
