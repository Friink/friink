# Server-Side Refresh Token Rotation and Revocation Design

Status: Approved design; implementation completed separately under the approved simplification noted below.

Date: 2026-08-31

Implementation decision: the later approved implementation brief intentionally supersedes the legacy stateless-refresh grace path in Section 5. Because Friink is not live, old stateless refresh JWTs will fail with the generic refresh `401` after the new server-side store ships; no legacy transition rows or dual-secret refresh window are implemented.

## Scope and current state

Friink currently issues stateless JWT refresh tokens. The refresh token is stored in an HTTP-only cookie, but the API has no database record for it, so it cannot revoke one token, rotate it, or detect reuse of a stolen token. This proposal moves refresh tokens to opaque, random values whose hashes are stored in PostgreSQL.

The design is intentionally sized for the current single-region, single-Neon-DB MVP and the existing synchronous SQLAlchemy + psycopg3 + Alembic stack. `STACK.md` was requested but is not present at the repository root; the stack description in `README.md` was used instead.

## 1. Proposed `refresh_tokens` table

Use one row per issued refresh token. Store only a cryptographic hash of the opaque value; never store the raw cookie value.

| Column | PostgreSQL / SQLAlchemy type | Rules and purpose |
|---|---|---|
| `id` | UUID | Primary key; generated server/client-side with `uuid4`. |
| `user_id` | UUID | Not null foreign key to `users.id`, preferably `ON DELETE CASCADE`. |
| `family_id` | UUID | Not null identifier for one login/session chain. A new login creates a new family. |
| `token_hash` | BYTEA (32 bytes) | Not null, unique; SHA-256 of the raw opaque token. A fixed-length `String(64)` hex hash is acceptable, but `BYTEA` is smaller. |
| `replaced_by_id` | UUID nullable | Self-reference to the replacement row after rotation. Useful for audit/debugging; `ON DELETE SET NULL`. |
| `issued_at` | TIMESTAMPTZ | Not null, server default `now()`. |
| `expires_at` | TIMESTAMPTZ | Not null; copied from the configured refresh lifetime. |
| `rotated_at` | TIMESTAMPTZ nullable | Set when this token is successfully exchanged. A non-null value makes it dead. |
| `revoked_at` | TIMESTAMPTZ nullable | Set for logout, reuse detection, administrative revocation, or expiry cleanup. |
| `revocation_reason` | VARCHAR(32) nullable | Controlled values such as `logout`, `reuse_detected`, `expired`, `family_revoked`, `admin`. |
| `created_at` | TIMESTAMPTZ | Not null, server default `now()`; retained as an audit timestamp. |

Recommended indexes:

- Unique index on `token_hash` for the exchange lookup.
- Composite index on `(family_id, revoked_at, expires_at)` for family revocation and cleanup.
- Index on `(user_id, family_id)` for account/session administration.
- Index on `expires_at` for bounded cleanup.
- Foreign-key index on `user_id` if the database does not create one automatically.

The row should be considered active only when `rotated_at IS NULL`, `revoked_at IS NULL`, and `expires_at > now()`. A separate status column is unnecessary and could drift from these timestamps.

## 2. Rotation and revocation flow

### Login and signup login

1. Authenticate the user exactly as today.
2. Create a new random refresh value using a cryptographically secure generator, for example 32 random bytes encoded as base64url without padding.
3. Hash the raw value with SHA-256.
4. Create a new `family_id` and insert one active `refresh_tokens` row.
5. Issue the short-lived access JWT.
6. Set the raw refresh value in the existing HTTP-only `friink_refresh_token` cookie. The raw value is never returned in JSON or logged.

Signup continues to create the account and then uses the same login issuance path.

### Refresh

1. Read the HTTP-only cookie. If missing, return the existing generic `401` refresh error.
2. Hash the presented raw value and look up `token_hash` in a database transaction.
3. Lock the matching row with `SELECT ... FOR UPDATE`. This is important for two simultaneous refresh requests using the same cookie.
4. If no row exists, optionally attempt the legacy stateless-JWT transition described in the migration section. Otherwise return `401` without changing unrelated sessions.
5. If the row is expired but has never been rotated, mark it revoked with reason `expired` and return `401`.
6. If `rotated_at` or `revoked_at` is already set, this is reuse of a dead token. In the same transaction, revoke every active row in that `family_id` with reason `reuse_detected` / `family_revoked`, then return `401`. Do not issue a new access or refresh token.
7. Confirm the referenced user still exists and is eligible to authenticate. If not, revoke the family and return `401`.
8. Generate a new opaque refresh value and insert its hashed row with the same `user_id` and `family_id`.
9. Set the old row's `rotated_at` and `replaced_by_id` to the new row.
10. Issue a new access JWT and commit the transaction before returning.
11. Set the new raw refresh value in the cookie. The old raw value is now unusable; presenting it again triggers family revocation.

The database lock makes the first concurrent request win rotation. The second request observes the old row as rotated and triggers reuse detection. The frontend's existing in-flight refresh deduplication remains useful, but server-side locking is the authority when multiple tabs, devices, retries, or attackers bypass that client deduplication.

### Reuse detection

Reuse detection applies to a token that was previously rotated or explicitly revoked, not merely to an expired token that was never exchanged. On reuse, revoke the entire family belonging to that token. Return the same generic refresh `401` as other invalid refresh sessions and log a security event containing user/family/token-row identifiers, never the raw token or its full hash.

Do not revoke every session for the user by default. A family represents one login/device chain; other device families should remain active unless a separate account-wide security action is added.

### Logout

1. If the refresh cookie is present, hash it and transactionally revoke its active row (or all active rows in that family for a clear “this device/session” guarantee) with reason `logout`.
2. Delete the refresh cookie with the same path, security, and SameSite attributes currently used.
3. Return `204` even when the cookie is absent or already invalid, so logout is idempotent.

The frontend still clears its local access-token/session copy immediately. The backend revocation prevents the refresh cookie from restoring that session later.

### Expiry and cleanup

Every exchange checks `expires_at`; expired rows cannot be used. A scheduled job is not required for correctness at current scale. Add a bounded cleanup command later that deletes rows only after `expires_at` plus a reuse-detection retention period, such as 30 days. Retain rotated/revoked rows during that period so replayed tokens can still be recognized as dead. Cleanup should be batched to avoid long locks.

## 3. Access-token `kid` and secret rotation

Refresh tokens are opaque and do not need JWT claims. Access tokens remain JWTs, but issuance adds a `kid` header identifying the signing key, for example `access-v1`.

Configuration should support:

- `JWT_ACTIVE_KID`: the key id used for newly issued access tokens.
- A map of `JWT_KEYS`, containing the active key and one or more previous verification keys, keyed by `kid`.
- A short compatibility setting for legacy access JWTs with no `kid`, mapped to the current pre-rotation secret during rollout.

On verification, read the JWT header only to select a configured key; never trust an arbitrary `kid` supplied by the token. Reject unknown key ids. Verify the signature, expiry, subject, and expected `typ` with the selected key. During rotation, both the new and previous configured keys remain valid. New tokens use only the new active key. After the maximum access-token lifetime plus a safety window has elapsed, remove the old key.

The rollout sequence is:

1. Deploy verification support for multiple keys and no-`kid` legacy tokens.
2. Add the new key while keeping the old key configured.
3. Switch `JWT_ACTIVE_KID` so newly issued access tokens use the new key.
4. Keep the old key for at least the access-token lifetime and operational safety margin.
5. Remove the old key only after that window.

Changing a signing key must not change the refresh-token database records. A refresh can therefore mint an access token with the new key without logging the user out.

## 4. Existing files and endpoints that would need changes

Backend:

- `api/app/models/refresh_token.py` — new SQLAlchemy model.
- `api/app/models/__init__.py` — model registration/export.
- `api/alembic/versions/...` — additive table/index/foreign-key migration.
- `api/app/routers/auth.py` — login, refresh, and logout flows; cookie issuance/deletion remains here.
- `api/app/services/security.py` — opaque token generation/hash helpers and multi-key JWT `kid` issuance/verification.
- `api/app/config.py` — active key id, key map, and legacy-key transition settings.
- `api/app/services/auth.py` or a new `session_service.py` — transaction-bound issue/rotate/revoke operations.
- `api/app/services/auth_debug.py` — security-safe rotation/reuse event logging with no raw tokens.
- `api/tests/test_token_resilience.py` and a new focused session/token test module — rotation, locking/reuse, logout, expiry, legacy transition, and key rotation coverage.

Frontend:

- `web/lib/auth.ts` — preserve the existing refresh cookie contract, keep refresh failures distinct, and handle a reuse-detection `401` as a terminal session failure without adding client-side token storage for the opaque refresh value.
- `web/lib/api-origin.ts` — no functional redesign required; preserve timeout and origin behavior while ensuring refresh requests keep their explicit auth context.
- `web/components/app-shell-route.tsx` — no intended behavior change beyond consuming the same explicit refresh `401` contract.

No protected business endpoint should need to know the refresh-token table. Access-token validation continues through the shared current-user dependency.

## 5. Additive migration and existing sessions

The `refresh_tokens` table can ship additively without breaking existing sessions if the API is deployed in a compatibility order:

1. Add the table, indexes, model, and multi-key JWT verification support. Do not make the new table mandatory yet.
2. Deploy an API version that accepts both opaque refresh values and legacy stateless refresh JWTs.
3. On a valid legacy refresh JWT, create a one-time legacy transition row using the hash of the presented raw JWT, assign a new family, mark the legacy row as rotated, issue a new opaque token, and set the new cookie.
4. If that same legacy raw token is presented again, the transition row is already dead, so revoke its family and return `401`. This gives legacy tokens one successful migration exchange rather than an unconditional silent logout.
5. New logins issue only opaque refresh values.
6. Keep the legacy JWT verification secret configured for at least the existing refresh-token lifetime (14 days) plus a safety margin. After that window, remove legacy refresh acceptance and any remaining users with untouched legacy cookies will need to log in once.

The transition needs a concurrency-safe insert/claim operation. If two requests present the same legacy token at once, only one may create the transition row and succeed; the other must observe the dead row and trigger family revocation. No raw legacy token is stored.

This is preferable to silently logging out all currently logged-in users. Users who refresh during the migration move to the new scheme without noticing. Users who do not return before the legacy grace window expires will experience one required login, which should be communicated operationally if the migration is scheduled near the deadline.

The migration must not alter `users`, access-token validation, or setup/profile data. It is additive and reversible at the schema level, although rolling back after opaque tokens are issued would require a compatibility decision rather than simply dropping the table.

## 6. New risks and MVP mitigations

- **One database read/write transaction per refresh:** This is real but refreshes occur at token lifetime boundaries, not on every API request. At the current scale it is negligible compared with normal authenticated API traffic. Use the indexed unique `token_hash` lookup and one short transaction.
- **Concurrent refresh races:** Row locking and a unique hash constraint prevent two successful rotations. Keep the frontend promise deduplication as an optimization, not as security.
- **Table growth:** One row is created per login and refresh. Retain recent dead rows for reuse detection, then batch-prune rows past `expires_at + retention`. Add an index and monitor row count.
- **Database outage during refresh:** The client must preserve its local session for timeout, status `0`, `403`, and `5xx`. It should only clear on an explicit refresh `401`, consistent with the current session rule.
- **Cookie theft remains possible before use:** Rotation limits replay after a legitimate exchange and reuse detection revokes the family, but it cannot prevent the first thief use. Use HTTPS, HTTP-only cookies, correct SameSite/domain settings, no raw-token logging, and generic client errors.
- **Clock skew:** Use database/server UTC timestamps consistently and allow a small expiry safety margin. Do not rely on browser time for server token validity.
- **Key configuration mistakes:** Keep the current fail-loud secret configuration rule, log only key ids/fingerprints, and deploy key additions before switching the active id.
- **Operational false positives:** A duplicate request caused by a client retry after a successful rotation may look like reuse. The client should consume the returned replacement cookie reliably, and the server should treat a dead-token presentation as a security event by design. This is the standard tradeoff of rotation.

## 7. Relationship to existing rules and professional/subscription logic

The current `RULES.md` defines JWT sessions, refresh behavior, session persistence, and preservation during recoverable API failures. The proposed pattern strengthens those rules but should not change the user-facing rule: transient failures do not log users out; explicit invalid refresh sessions do.

The current repository search found no implemented professional verification, paid subscription, Pro badge, or day-8/day-64 revocation subsystem. The only related fields are account `is_verified` and notification/profile badge terminology. Therefore there is no existing revocation table to reuse and no direct schema conflict to resolve.

If professional verification or subscription entitlements are added later, do not overload `refresh_tokens` with entitlement state. Refresh-token revocation answers “may this login session continue?” Entitlement/subscription tables answer “what may this user access?” They can share the same `user_id`, audit timestamps, and administrative event conventions, but should remain separate. An account-wide suspension or security incident may revoke all refresh-token families for a user; ordinary subscription expiry should not invalidate login sessions.

Before implementation, update the stale `RULES.md` edge case that currently describes refresh failure clearing broadly. It should explicitly say that only an explicit refresh-endpoint `401` clears the web session, while ambiguous/transient failures preserve it.

## Review decisions needed before implementation

1. Approve the one-family-per-login/device model and family-wide reuse revocation.
2. Approve a 32-byte opaque token, SHA-256 hash, and 30-day dead-row retention after expiry.
3. Approve the legacy stateless-refresh grace migration rather than a forced one-time logout.
4. Choose the configuration format and naming for the multi-key `kid` map.
5. Decide whether explicit logout revokes only the presented family or all active families for the user; this proposal recommends only the presented family.

No implementation should begin until these decisions are reviewed and approved.
