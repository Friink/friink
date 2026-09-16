# Settings

Settings provides the owner's controls for appearance, profile information,
account credentials, privacy, sessions, and subscription visibility.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-16T21:51:28Z
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
- **SETTINGS-R-008:** General shows the professional-profile badge preference
  only when `How I use Friink` is `For professional networking`; the saved
  preference controls whether the badge appears next to the displayed name.

## UX and flows

Settings uses divider-bounded rows rather than isolated cards. Editable fields
show their action in a consistent action rail. Loading, validation, success,
failure, and retry states remain attached to the setting being changed.

### Professional profile badge

General includes the private `How I use Friink` preference with the values
`For professional networking` and `For personal connection`. When the user
selects `For professional networking`, General reveals a subordinate opt-in
setting labeled `Show you are a professional on Profile`. The setting is
hidden or unavailable while `For personal connection` is selected.

When enabled, the user's public profile may display the professional badge
immediately next to their displayed name; when disabled, it must not display
it. This preference controls badge visibility only. It does not award
professional status, verify credentials,
grant directory access, or change subscription entitlements. The badge remains
hidden by default, and saving either preference uses the normal Settings save
feedback and failure-recovery behavior.

### Subscription visibility (current rollout)

The Subscription tab shows the server-resolved plan (`Free`, `Pro`, or
`Pro+`), status (`Active`, `Expired`, or `Revoked`), and access-until date.
Indefinite access is shown as `No expiration`. A user sees recent plan changes
and receives clear in-app and email feedback when access is granted, changed,
expires, or is revoked. Expiry reminders are planned for 7 days and 1 day
before expiry, followed by an expiry notice.

Users may independently opt in to show a plan badge and, when eligible, a
professional badge on their public profile. The professional badge preference
is available only when `How I use Friink` is `For professional networking`.
Both badges are hidden by default. Badge visibility does not affect
entitlement or feature access.

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

Paid billing and entitlement management are not active. The current plan
display is server-resolved, and subscription notifications remain planned.
