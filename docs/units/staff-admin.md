# Staff Admin

Staff Admin is the privileged control-panel surface for staff discovery, roles,
permissions, user management, security operations, privileged sessions, and
audit information.

**Status:** Partial — staff discovery, bootstrap, roles, and user controls are implemented; several sections are placeholders  
**Tier:** Full  
**Last edited:** 2026-09-16T23:44:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns privileged staff access and control-panel behavior. Ordinary
account access remains defined by [Account Access](./account-access.md).

## Related units

- [Account Access](./account-access.md) — ordinary identity/session foundation.
- [Account Lifecycle](./account-lifecycle.md) — user lifecycle actions exposed to staff.
- [Notifications](./notifications.md) — security/audit notifications.
- [Subscriptions](./subscriptions.md) — administrative plan assignments.
- [Profiles](./profiles.md) — presents the staff-controlled registration result.
- [Discovery](./discovery.md) — consumes registration and subscription state for directory eligibility.
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

### Permission architecture contract

- Permission definitions are database-backed `staff_permissions` records.
- Roles are database-backed `staff_roles` records connected to permissions
  through `role_permissions`; users receive the union of their assigned-role
  permissions and additive direct grants.
- Permission keys, role ownership, and role-to-permission assignments must not
  be hardcoded in application logic. New capabilities must be represented as
  permission records and assigned through the role/permission model.
- A `superadmin` is a full-authority role, but its effective permissions must
  be resolved from the database permission catalog rather than a hardcoded
  application permission list.
- Subscription administration and professional-status administration should be
  represented as separate permissions that a superadmin can delegate through
  roles or direct grants.

## UX and flows

The drawer shows Control panel only for staff discovery. The panel presents
permission-aware tabs and actions. Users with no effective access see a calm
no-access state. Expired privileged access opens a step-up modal; closing it
returns to the prior screen.

### Subscription administration (current rollout)

Staff with the delegated `subscriptions.manage` permission manage entitlements
from Control Panel → Users. Search accepts
both username and email and returns all matching accounts. Deactivated and
pending-deletion accounts remain visible but have plan actions disabled;
pending-deletion rows show the remaining deletion window.

The user detail view will provide `Adjust plan`, assignment history, and the
current effective status. Staff select Pro, Pro+, or Free, choose a preset
duration, custom expiry date, or no expiration, enter a required reason, and
review a replacement summary before saving. Renewal extends an active
assignment from its current expiry; a new assignment after expiry starts now.
Revoke is confirmed separately and returns the effective plan to Free.

Plan changes require an active privileged superadmin session, are authorized
server-side, and create redacted audit events. User-facing copy describes the
result as access being granted or changed; staff-facing copy identifies it as
manual plan assignment. The flow must never imply that a payment occurred.

### Friink registration review (API and Control Panel UI active)

Staff with a dedicated professional-registration permission can review user
applications containing Institute and Credential ID. Each application keeps an
immutable history of submissions and decisions and supports `Pending`,
`Approved`, `Rejected`, `Cancelled`, and `Revoked` states. Rejections require a
message explaining what the user should correct; users may reapply immediately.
Revocation requires a reason and removes the active `Friink Registered` status.

Submission, approval, rejection, and revocation events notify the user in-app
and by email. Staff can view prior applications and decision messages. The
Control Panel exposes a separate Professional Registration tab with oldest-first
pending requests, all-status filtering, field search, profile links, and
confirmation modals for staff decisions. The review workflow is separate from subscription administration;
subscription status only controls whether an otherwise eligible profile appears
in the directory.

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

The full staff dashboard, moderation requirements, registration history detail,
and some control-panel sections remain to be implemented. The
subscription and professional-status permission records now exist in the
database catalog; the corresponding registration review API is now available,
while the staff dashboard remains
planned.
