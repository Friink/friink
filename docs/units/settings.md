# Settings

Settings provides the owner's controls for appearance, profile information,
account credentials, privacy, sessions, and subscription visibility.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns the Settings surface and the user-facing organization of
preferences and account controls. Underlying authentication belongs to
[Account Access](./account-access.md); shared visual behavior belongs to
[Design System](../design-system.md).

## Related units

- [Account Access](./account-access.md) — password, email, sessions, and account switching.
- [Account Lifecycle](./account-lifecycle.md) — deactivate, delete, and recovery actions.
- [Profiles](./profiles.md) — editable public identity and profile picture.
- [Chat](./chat.md) — read-receipt preference.
- [Blocking](./blocking.md) — blocked-people management.
- [Subscriptions](./subscriptions.md) — current plan summary.

## Product definition

Settings is organized into General, Profile, Account, and Privacy & Safety.
Each setting has a clear description, local or server-backed state, a visible
save/result state, and accessible controls.

## Rules

- **SETTINGS-R-001:** Settings uses addressable tabs: `/settings/general`,
  `/settings/profile`, `/settings/account`, and `/settings/privacy`.
- **SETTINGS-R-002:** Profile fields Name, Username, About, and private Date of
  Birth are separate rows with separate update actions.
- **SETTINGS-R-003:** Username availability is a hint; API/database validation
  remains authoritative and case-insensitive.
- **SETTINGS-R-004:** Privacy changes use draft values and save explicitly; a
  failed save reverts to the last confirmed value.
- **SETTINGS-R-005:** Sessions are listed using server-derived metadata and
  never expose raw tokens, hashes, IPs, or internal UUIDs.
- **SETTINGS-R-006:** Appearance and accent preferences are device-local;
  public marketing surfaces are not changed by the in-app accent.
- **SETTINGS-R-007:** Successful saves provide clear success feedback.

## UX and flows

Settings uses divider-bounded rows rather than isolated cards. Editable fields
show their action in a consistent action rail. Loading, validation, success,
failure, and retry states remain attached to the setting being changed.

## Technical contract

Settings is implemented primarily through `account-screens.tsx`, shared
`SettingsRow`/`ListRow` patterns, and authenticated `/auth/me` endpoints. The
API remains authoritative for credential, identity, and privacy changes.

## Acceptance criteria

- [ ] **SETTINGS-AC-001** All four tabs are addressable and refresh-safe.
- [ ] **SETTINGS-AC-002** Failed saves do not lose confirmed values.
- [ ] **SETTINGS-AC-003** Session controls never expose sensitive metadata.
- [ ] **SETTINGS-AC-004** Privacy and credential changes enforce server rules.
- [ ] **SETTINGS-AC-005** Settings uses shared row and action patterns.

## Known limitations

Paid billing and entitlement management are not active; subscription settings
is currently informational.
