# Account Lifecycle

Account Lifecycle defines how an account moves through setup, active use,
deactivation, deletion, reactivation, and pending-deletion states.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns account lifecycle state transitions and their consequences.
Authenticated access mechanics belong to [Account Access](./account-access.md).
Settings owns the presentation of lifecycle controls.

## Related units

- [Account Access](./account-access.md) — lifecycle state controls login,
  refresh, switching, and session creation.
- [Settings](./settings.md) — exposes lifecycle actions.
- [Notifications](./notifications.md) — may receive security/lifecycle events.
- [Design System](../design-system.md) — governs confirmation and recovery UI.

## Product definition

Users must be able to finish setup, deactivate an account, request deletion,
cancel pending deletion where allowed, and reactivate safely. Destructive
actions require explicit confirmation and the required current-password or OTP
proof.

## States and transitions

```text
Setup incomplete → Setup complete → Active
Active → Deactivated
Active → Pending deletion → Deleted
Pending deletion → Active (verified cancellation/reactivation)
Deactivated → Active (verified reactivation)
```

Inactive lifecycle states must not be treated as ordinary authentication
failures. Existing chats may remain readable but become read-only where the
active blocking/lifecycle contract requires it.

## Rules

- **LIFE-R-001:** Profile setup resumes until complete; optional steps remain
  skippable and saved progress is preserved.
- **LIFE-R-002:** Deactivation requires the current password, ends all
  sessions, and explains reactivation and continued subscription implications.
- **LIFE-R-003:** Deletion requires current-password confirmation followed by a
  fresh email OTP and uses a grace period before final deletion.
- **LIFE-R-004:** Reactivation and pending-deletion cancellation require the
  appropriate OTP and must not be confused with ordinary login.
- **LIFE-R-005:** Existing access tokens are rejected for inactive lifecycle
  states even though ordinary account locks do not retroactively invalidate
  already-issued access tokens.
- **LIFE-R-006:** Lifecycle operations are owner-verified, idempotent where
  possible, and must not expose internal identifiers or security data.

## UX and flows

Lifecycle screens use calm confirmation surfaces with explicit consequences,
loading, error, retry, focus, and keyboard-accessible states. A failed
operation preserves the usable current state. A pending deletion screen clearly
distinguishes cancellation from ordinary sign-in.

### Subscription interaction

Deactivated and pending-deletion accounts remain visible to staff for context,
but subscription-management actions are unavailable. Pending deletion is shown
with the remaining days in its 32-day grace window. Subscription expiry or
revocation does not reactivate, deactivate, delete, or otherwise change the
account lifecycle state.

## Technical contract

Lifecycle operations are exposed through `api/app/routers/account_lifecycle.py`
and related auth routes/services. The API owns lifecycle state and session
revocation; the client must not infer state from stale local account data.

## Acceptance criteria

- [ ] **LIFE-AC-001** Setup progress persists and can resume.
- [ ] **LIFE-AC-002** Deactivation verifies ownership and ends sessions.
- [ ] **LIFE-AC-003** Deletion requires the required confirmation and OTP.
- [ ] **LIFE-AC-004** Inactive states cannot create ordinary authenticated access.
- [ ] **LIFE-AC-005** Lifecycle failure and recovery states are explicit.

## Known limitations

Grace periods, provider delivery, and production lifecycle rehearsals remain
environment-dependent release concerns.

## Open questions

- Confirm final user-facing policy for subscription billing during deletion and
  deactivation when billing becomes active.
