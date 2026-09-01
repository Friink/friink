# Friink Session Updates — Claude Handoff

Last updated: 2026-08-31

This document is a handoff summary for the session-hardening work. The implementation is already in the working tree and the database migration has already been applied to the configured database. Do not re-implement the same work without first checking the files and migration state below.

## Current result

Friink now uses server-side opaque refresh tokens instead of stateless JWT refresh tokens:

- Login creates one random 32-byte refresh token and stores only its SHA-256 hash.
- The raw refresh token is sent only in the HTTP-only `friink_refresh_token` cookie.
- Every refresh rotates the token and creates a replacement row.
- The old token is marked dead with `rotated_at` and `replaced_by_id`.
- Reusing a rotated or revoked token revokes the entire refresh-token family for that login/device and returns `401`.
- Logout revokes only the presented family and deletes the cookie.
- Expired rows are rejected and retained for 30 days before the bounded cleanup hook may delete them.
- The frontend does not store the opaque refresh token; it remains cookie-only.

Access JWTs now include a `kid` header. The API can issue with one active key while accepting multiple configured keyed verification secrets during a safe future key rotation.

## Important compatibility decision

The approved implementation intentionally skipped the legacy migration path. Old stateless JWT refresh cookies are not transitioned. They fail with the normal generic refresh `401` and require one login after the new API is deployed.

Do not add a legacy dual-secret refresh window or transition-row logic unless the product decision changes. Friink is not live and the one-time re-login was explicitly accepted.

The live `JWT_SECRET_KEY` was not rotated during this work.

## Files changed

Backend:

- `api/app/models/refresh_token.py` — SQLAlchemy model.
- `api/app/models/__init__.py` — model registration.
- `api/alembic/env.py` — Alembic metadata import.
- `api/alembic/versions/20260831_0012_create_refresh_tokens.py` — additive migration.
- `api/app/services/session_service.py` — token generation, hashing, lookup/locking, issue, revoke, and cleanup hook.
- `api/app/routers/auth.py` — login, refresh, logout, and cookie behavior.
- `api/app/services/security.py` — JWT `kid` issuance and multi-key verification.
- `api/app/config.py` — `JWT_ACTIVE_KID` and `JWT_KEYS` configuration.
- `api/app/services/auth_debug.py` — safe refresh-token event logging without raw values.

Tests:

- `api/tests/test_refresh_token_rotation.py` — real FastAPI/database integration coverage.
- `api/tests/test_token_resilience.py` — JWT configuration and `kid` coverage.

Documentation:

- `RULES.md` — updated session rules and explicit-401 behavior.
- `docs/session-hardening-design.md` — full design and approved simplification.
- `CHANGELOG.md` and `AGENTLOG.md` — implementation and verification records.

The frontend now follows the authoritative reactive-only model in `RULES.md`: authenticated requests send the current access token and refresh only after `401 TOKEN_EXPIRED`, then retry once. Refreshes use a shared localStorage lease/result protocol across tabs; only an explicit refresh `401` clears local session state. Network, timeout, CORS, 403, 5xx, and malformed-response failures remain retryable. API requests resolve one configured environment origin with no cross-environment fallback.

## Database state

Migration `20260831_0012` was applied with:

```text
python -m alembic upgrade head
python -m alembic current
20260831_0012 (head)
```

The configured database inspection confirmed the `refresh_tokens` table exists with these columns:

```text
id, user_id, family_id, token_hash, replaced_by_id,
issued_at, expires_at, rotated_at, revoked_at,
revocation_reason, created_at
```

Indexes confirmed:

```text
unique token_hash,
user_id,
family_id,
expires_at,
(family_id, revoked_at, expires_at)
```

The configured settings reported `ENVIRONMENT=development` while using the repository’s configured Neon database. The repository has one shared database arrangement, so confirm the deployment target and database before applying any future migration.

## JWT key configuration

Current defaults remain backward-compatible:

- `JWT_SECRET_KEY` — current/default secret and fallback for no-`kid` legacy access JWTs.
- `JWT_ACTIVE_KID` — defaults to `default`.
- `JWT_KEYS` — optional JSON object mapping key ids to secrets, for example `{ "access-v1": "old-secret", "access-v2": "new-secret" }`.

Safe future rotation:

1. Deploy verification support with both old and new keys configured.
2. Set `JWT_ACTIVE_KID` to the new key id.
3. Keep the old key configured for at least the access-token lifetime plus safety margin.
4. Remove the old key only after that window.

Never log raw keys or tokens. The existing API startup log uses only a secret fingerprint.

## Verification evidence

Real endpoint integration testing created and cleaned a disposable account against the configured database. It verified:

- Fresh login creates exactly one `refresh_tokens` row.
- Refresh creates a new row, changes the cookie, and sets the old row’s `rotated_at` and `replaced_by_id`.
- Replaying the old cookie returns `401` and revokes every row in that family.
- Logout returns `204`, emits cookie deletion, and revokes the active family.
- An old-style stateless refresh JWT returns the generic `401` with no transition handling.
- Direct server-side reuse of one cookie remains protected by row locking and family revocation. Browser tabs coordinate before reaching that server-side reuse path, so the old client-level `[200, 401]` concurrency expectation was removed from the API test; cross-tab coordination is a web-client concern.
- Access JWT issuance includes the active `kid`, and an overlapping previous keyed secret still verifies.

Checks:

- Full API suite: `55 passed`.
- Web TypeScript check passed.
- Python compilation passed.
- `git diff --check` passed.

Two non-blocking warnings appeared in the API suite: Starlette/httpx deprecation and Windows pytest-cache permission warnings.

## Deployment checklist

Before deploying the new API:

1. Confirm the migration is present in the target checkout and the target database is at `20260831_0012 (head)`.
2. Deploy the API code that understands opaque refresh cookies before expecting new rotation behavior.
3. Confirm `JWT_SECRET_KEY` remains unchanged across environments unless an intentional key rotation is being performed.
4. Confirm `JWT_ACTIVE_KID` is `default` unless `JWT_KEYS` contains the selected key id.
5. Confirm API cookie settings, HTTPS, CORS, and `FRONTEND_URL` remain correct.
6. Expect existing stateless refresh-cookie users to log in once after their access token expires and refresh is attempted.
7. Verify a fresh login, refresh, logout, and old-cookie replay in staging after deployment.
8. Do not rotate the live JWT secret in the same release unless separately planned and tested.

## Remaining follow-up

- Deploy and verify the updated API in staging; the repository change and database migration do not themselves deploy Vercel code.
- Decide whether to add an authenticated administrative endpoint or maintenance command for account-wide family revocation. The current cleanup function is a service hook, not a scheduled job.
- Consider operational metrics for refresh failures, reuse detections, family counts, and cleanup volume.
- Keep professional verification, subscriptions, and Pro-badge entitlement revocation separate from login-session revocation. No such implementation currently exists in the repository.
- Update this handoff if the legacy compatibility decision or JWT key-rotation configuration changes.

## Guardrails for future changes

- Never store or log raw refresh tokens.
- Never clear a client session for a timeout, network/CORS failure, `403`, `5xx`, or unknown error.
- Only explicit refresh-endpoint `401` is terminal for refresh recovery.
- Keep refresh rotation transactionally locked with `SELECT ... FOR UPDATE`.
- Treat dead-token replay as a security event and revoke the whole family.
- Do not alter the shared database schema manually; use additive Alembic migrations.
- Read `README.md`, `CHANGELOG.md`, `AGENTLOG.md`, and `RULES.md` before further auth work.
