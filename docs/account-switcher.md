# Friink Account Switcher

Status: Implemented for the web-focused release; full staging browser
acceptance remains pending.

This document describes how multiple independent Friink accounts are added,
remembered, switched, and removed in one browser profile. It complements
`docs/auth-and-session.md`, which remains the authoritative document for the
shared authentication and session rules.

## Product behavior

- After a successful login, the side drawer shows `Add account`.
- `Add account` opens the existing design-system authentication modal.
- The modal supports both login and signup. Signup follows the approved
  email → OTP → password → profile sequence when OTP is enabled.
- A successful authentication registers that account on the current browser
  profile and immediately activates it.
- `Change account` is hidden until at least two accounts are authenticated.
- The account list contains only accounts remembered on the current device.
- Switching changes the active account context; it never merges accounts or
  links their identities.
- The switcher supports up to `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` accounts.
  The default is five; valid configuration values are 1 through 16.
- When the limit is reached, adding another account is blocked until one is
  removed. Existing accounts are never silently replaced.
- On logout, the active account's device session is removed. If other
  accounts remain, the most recently used account becomes active; otherwise
  the user returns to the signed-out login screen.
- Removing an account requires confirmation and removes only that account
  from the current device. It is not account deletion.
- Deactivated or pending-deletion accounts show lifecycle messaging and are
  removed from the usable device list.

## Account independence

Each remembered account is a fully independent Friink identity. There is no
shared profile, merged identity, account-to-account relationship, shared
security state, or cross-account data access.

The unique-email-per-account rule remains permanent: the same email address
cannot be associated with multiple Friink accounts.

Settings session management is account-scoped. While Account A is active, the
user can manage Account A's sessions; Account B's sessions must not appear as
if they belong to Account A.

## Server-side session slots

The server maintains a device-scoped account session slot for each remembered
account. A slot includes, directly or through protected references:

- The internal account UUID.
- A protected hash or equivalent of the device/installation identifier.
- A random opaque slot identifier.
- The account's `auth_session` and refresh-token family reference.
- Created, last-used, and revoked timestamps.
- Optional safe display metadata such as username and avatar.

The browser receives only the opaque slot reference and safe display data. The
slot is not an account ID, username, credential, or trusted client-only claim.
It becomes invalid after revocation or removal.

Existing `auth_sessions` and `refresh_tokens` remain authoritative for session
validity. Each account has an independent refresh-token family even when
several accounts are remembered on one device.

## Credential and cookie boundary

- Only the active account's short-lived access token is held in memory.
- Refresh tokens, token hashes, passwords, OTPs, internal UUIDs, and device
  secrets must never be stored in JavaScript-readable storage.
- Each account slot uses a server-managed HttpOnly refresh cookie named in the
  form `friink_refresh_<opaque_slot>`.
- Slot cookies are host-only API cookies with `Path=/`; deployed HTTPS uses
  `Secure` and the documented cross-origin `SameSite` setting.
- Cookie deletion must target the exact slot cookie.
- The active slot is sent with switch and refresh requests and is validated by
  the server against the protected device record.
- The API must process only the validated active slot, even if the browser
  sends multiple refresh cookies.
- Refresh coordination keys and BroadcastChannel messages are slot-scoped so
  Account A cannot update Account B's token or state.

## API contract

Equivalent route names are acceptable, but the server must provide these
operations:

- `GET /auth/accounts` returns non-revoked slots for the current device,
  ordered by last use, with safe summaries only.
- Existing login and signup endpoints create or restore only the authenticated
  account's device slot.
- `POST /auth/accounts/switch` validates the opaque slot, device, and slot
  state, then issues the selected account's normal access context.
- `DELETE /auth/accounts/{slot}` revokes and removes only that account's
  device slot.
- Existing logout and session controls remain account-specific. “Log out all
  other sessions” affects the active account only.

Adding an account that already has a valid slot should activate that slot
rather than create a duplicate. Revoked or expired slots must not affect
other accounts.

Network, CORS, timeout, and other ambiguous failures during add, switch, or
remove must preserve the previously active account. Only a confirmed terminal
session result may clear local account state.

## Client-state isolation

After switching, every request is authorized using the selected account's
access token and server-side session context. Account-specific caches, query
keys, optimistic state, uploads, notifications, drafts, and analytics must be
partitioned by account. The client must clear or replace account-scoped state
before rendering the newly active account.

Adding an account creates that account's normal login security event and
notification. Switching an already authenticated account does not create a
new-login event. Security, OTP, lockout, revocation, and device-enrollment
records remain attached to the correct account and session.

## UX decisions

- Login appears first in the Add-account modal, with Create account below it.
- Successful authentication immediately activates the new account.
- The drawer exposes switching, Add account, Manage accounts, and active
  logout.
- Manage Accounts uses ProfileCard rows, with the active account first and
  logout controls on other rows.
- Removal requires confirmation.
- The dropdown closes after switching.
- Add-account failure, cancellation, or abandonment must not log out or
  replace the active account and must not create a partial account or slot.
- Recoverable failures preserve the active account.

## Rollout and compatibility

The rollout is additive and must preserve the legacy one-account path:

1. Add device-scoped account-session-slot storage without invalidating current
   refresh/session rows.
2. Deploy server support that continues accepting the existing single-account
   cookie/session path.
3. Create or associate a slot after the next successful login or explicit
   account addition.
4. Verify single-account login, refresh, logout, OTP, session management, and
   recovery before enabling multiple accounts broadly.
5. Enable gradually and monitor account-scoped session, switch, revocation,
   and isolation failures.

Existing users must not be forced to log in again solely because the new slot
tables or UI are deployed.

## Current implementation status

The web-focused Phase 4 release is marked closed. The implementation includes
the slot migration, opaque slot references, safe summaries, protected device
binding, slot-named HttpOnly cookies, account listing, switching, removal,
Add-account modal reuse, cross-tab coordination, notifications, and lifecycle
fallbacks. The legacy single-account refresh path remains supported.

Focused staging evidence recorded two passing account-switcher tests covering
two accounts on one device, approval, notification creation, denied-OTP
invalidation, listing, switching, slot refresh, and removal. Web TypeScript
and production-build checks also passed.

Full browser-based staging acceptance is still required. It must be repeated
after deployment stability is restored and should cover the scenarios below.

## Acceptance checklist

- Add account through login and signup.
- Verify the signup flow with and without OTP enabled in the test environment.
- Show `Change account` only at zero/one versus two accounts.
- List only accounts remembered on the current device.
- Switch successfully and verify account-specific content, cache, drafts,
  notifications, and active-session state.
- Reload after switching and confirm the selected account remains correct.
- Refresh concurrently from multiple tabs and verify slot isolation.
- Confirm Account A cookies, tokens, and state never select Account B.
- Remove an inactive account and confirm the active account is unaffected.
- Log out the active account and confirm correct fallback selection.
- Reach the account limit and confirm additions are blocked without silent
  replacement.
- Exercise revoked, expired, deactivated, and pending-deletion slots.
- Confirm recoverable add/switch/remove failures preserve the active account.
- Confirm no response, browser storage, log, or account summary exposes raw
  refresh tokens, token hashes, internal UUIDs, passwords, OTPs, or device
  secrets.
- Verify exact cookie, CORS, and `SameSite` behavior in the deployed staging
  web/API environment.

Mobile account switching is outside this document and is owned by
`docs/auth-and-session-mobile.md` when a mobile client is implemented.
