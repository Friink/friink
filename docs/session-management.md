# Friink Session Management

Status: design and scope for review

Last updated: 2026-08-31T22:13:54Z

This document defines the proposed user-facing session-management feature for
`/settings/account`. It is documentation only. It does not authorize or
describe an implementation already made.

## Goal

Give a user visibility and control over the browsers and devices that can
continue their Friink login. The feature should allow a user to revoke one
session or all other sessions without changing the behavior of unrelated
sessions.

## Current authentication foundation

Friink already uses server-side opaque refresh tokens:

- Login creates a random refresh token and stores only its SHA-256 hash.
- The raw token exists only in the HTTP-only refresh cookie.
- Refresh rotates the token and marks the old row as rotated.
- Reuse of a rotated or revoked token revokes its complete token family.
- Logout revokes the presented token family and clears the cookie.
- Access tokens are short-lived JWTs and are not individually revoked at the
  moment of logout; they expire naturally.

The current `refresh_tokens` table identifies token families, but it does not
contain user-friendly device, browser, operating-system, or session metadata.
It is therefore not yet a complete session-management data model. A refresh
token family is the closest current equivalent to one login session.

## Recommended data model

Add a dedicated `auth_sessions` table rather than exposing refresh-token rows
directly:

| Column | Purpose |
|---|---|
| `id` | UUID session identifier |
| `user_id` | Owning user; foreign key with cascade delete |
| `created_at` | Time the login session was created |
| `last_active_at` | Last login or refresh activity |
| `revoked_at` | Null while active; set when revoked |
| `revoke_reason` | Short internal reason such as logout or security event |
| `device_label` | Parsed label such as Windows PC, iPhone, or Android device |
| `browser` | Parsed browser family and optionally major version |
| `operating_system` | Parsed operating-system family |
| `user_agent` | Optional raw value for diagnostics; never shown by default |
| `ip_hash` | Optional one-way hash for security diagnostics, not display |

Add a non-null `session_id` foreign key to new refresh-token rows. The token
family remains useful for rotation and reuse detection; the session groups the
family and owns the user-facing revoke operation.

Recommended indexes are `auth_sessions.user_id`,
`auth_sessions.user_id/revoked_at`, and `refresh_tokens.session_id`.

Metadata is best-effort. Device and browser parsing can produce `Unknown
device` or `Browser information unavailable`; those values are not security
failures. Session ownership, user ownership, expiry, and revocation state are
not optional.

## User experience

Add a `Sessions` section under Settings > Account. Use the existing settings
row pattern rather than a new visual system.

Example desktop presentation:

| Session | Logged in | Last active | Status | Action |
|---|---|---|---|---|
| Windows PC · Chrome | Aug 31, 2026 | Just now | Current session | — |
| iPhone · Safari | Aug 28, 2026 | Yesterday | Active | Log out |
| Unknown device | Aug 12, 2026 | Aug 25, 2026 | Active | Log out |

Required UI behavior:

- Mark the browser making the request as `Current session`.
- Show device/browser first, then logged-in and last-active timestamps.
- Provide an individual `Log out` action for every other active session.
- Do not show a logout action for the current session in its row; normal app
  logout remains available elsewhere.
- Provide `Log out all other sessions` as a separate action.
- Confirm destructive revocation before applying it.
- Show loading, empty, failure, and successful-revocation states.
- On mobile, stack each row as a compact card while preserving the same fields.
- Never display raw tokens, token hashes, IP addresses, or internal UUIDs.

## API surface

Proposed authenticated endpoints:

```text
GET  /auth/sessions
POST /auth/sessions/{session_id}/revoke
POST /auth/sessions/revoke-others
```

`GET /auth/sessions` should return only sessions belonging to the current
user. It should include a safe session identifier, display metadata, dates,
active/revoked state as needed, and a `current` boolean. The server—not the
browser—must determine ownership and whether the requested session may be
revoked.

Revoking a session should revoke its refresh-token family in one transaction.
Revoking all other sessions should exclude the current session and revoke all
remaining active sessions for that user. Repeated revoke requests should be
safe and idempotent.

## Authentication flow changes

### Login

1. Parse the request user-agent into best-effort metadata.
2. Create an `auth_sessions` row.
3. Issue the first refresh token linked to that session.
4. Return the normal access token and cookie.

### Refresh

1. Lock and validate the presented refresh-token row.
2. Reject expired, revoked, missing, or dead tokens according to the existing
   refresh rules.
3. Rotate the token within the same session and family.
4. Update `last_active_at`.
5. Return the new access token and refresh cookie.

`last_active_at` should not be written on every API request. Updating it on
login and refresh provides useful information without adding a database write
to normal application traffic.

### Logout and revocation

- Normal logout revokes the current session/family and clears the cookie.
- Settings revocation revokes only the selected session/family.
- “Log out all other sessions” preserves the current session.
- A reused dead token remains a security event and revokes its entire family;
  it must not silently restore access.

Access JWTs already issued before revocation may remain usable until their
normal short expiry. Immediate access-token invalidation would require adding
session claims and a server-side revocation check or denylist on protected
requests. That is not required for the minimal feature, but it should be an
explicit security decision rather than an accidental assumption.

## Migration and current-user impact

The schema change should be additive and deployed before code that requires the
new relationship. No current user should be logged out merely because the
`auth_sessions` table is added.

There are two categories of existing users:

1. Users whose refresh tokens are already in the server-side
   `refresh_tokens` table can receive a session row grouped by their existing
   token family. Device metadata may be empty or marked unknown until a later
   login/refresh.
2. Users still holding old stateless refresh JWT cookies are governed by the
   already-approved migration decision in `docs/session-updates.md`: those
   cookies are not transitioned and require one login when the old refresh
   path is attempted. Session management should not add another forced logout.

The migration must not make `session_id` empty for new rows. If existing token
rows need a transition period, use a deliberate backfill or a narrowly scoped
nullable migration step; do not make refresh fail because metadata is absent.

## Risks and mitigations

### Incorrect device identification

User-agent parsing is approximate and can be stale or spoofed. Treat it as
recognition aid, not proof of identity. Use clear fallback labels and never
claim precise location.

### Revoking the wrong session

Authorization must be checked server-side using both `session_id` and the
authenticated `user_id`. Never accept a user ID from the client. Use a
transaction and idempotent revoke operation.

### Session list leakage

Return only the current user's sessions and safe display fields. Do not return
refresh tokens, hashes, raw IP addresses, or unnecessary user-agent strings.

### Stale access token after logout

The current short-lived access token may survive until expiry. Keep access
tokens short-lived and document the behavior. Add immediate access revocation
only if the product later requires it and the request-time cost is accepted.

### Database growth

Rotation creates historical refresh rows. Keep the existing bounded cleanup
policy for expired/dead tokens and consider cleaning revoked session metadata
under the same maintenance path. Do not delete active rows.

### Extra database work

The feature adds one session lookup for the settings page and one write on
login/refresh. It does not require a database lookup for every ordinary API
request. At current single-region MVP scale this is proportionate.

### Concurrent refresh and revocation

Refresh already locks the token row. Revocation must use the same transaction
boundaries so a session revoked while refresh is in progress cannot leave a
new active refresh token behind. Add integration tests for this race.

## Files and areas likely to change

Backend:

- `api/app/models/` — new `AuthSession` model and refresh-token relationship.
- `api/alembic/versions/` — additive session-table migration and any safe
  refresh-token foreign-key migration.
- `api/app/routers/auth.py` — login, refresh, logout, list, and revoke flows.
- `api/app/services/session_service.py` — session creation, lookup, revoke,
  rotation linkage, and cleanup.
- `api/app/schemas/auth.py` — safe session response schemas.
- `api/app/services/auth_debug.py` — event logging without raw secrets.

Frontend:

- `web/lib/auth.ts` — authenticated session-list and revoke requests.
- `web/components/account-screens.tsx` — Sessions settings section.
- `web/app/globals.css` — only if shared settings-row states need extension.

Documentation and tests:

- `packages/design/design.md`
- `RULES.md`, if session-product behavior is added as an active rule
- `api/tests/` session integration and race tests
- targeted web tests if a suitable test setup exists
- `CHANGELOG.md` and `AGENTLOG.md`

## Verification checklist

- Two logins produce two visible active sessions.
- Existing refresh rotation remains one-token-at-a-time and deduplicated.
- Refresh preserves the same session record.
- One session can be revoked without affecting another.
- “Log out all other sessions” preserves the current session.
- Revoked sessions cannot refresh successfully.
- Dead-token reuse still revokes its complete family.
- Missing metadata renders safely as unknown rather than breaking the page.
- Current users are not logged out by the additive schema migration.
- Normal logout, refresh timeout handling, and access-token behavior remain
  unchanged.

## Deliberate non-goals for the MVP

- IP/location display to users
- email alerts for new sessions
- device push management
- immediate revocation of already-issued access JWTs
- administrative cross-user session controls
- multi-region coordination or a distributed session cache

