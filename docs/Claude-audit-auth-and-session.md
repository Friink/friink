# Claude Audit — Auth and Session

This file records verification evidence for `docs/auth-and-session.md`. Refresh-token values are intentionally redacted; cookie attributes and response results are preserved.

## Verification scope

All implementation verification in this audit is performed against the temporary staging environment only:

- Frontend: `https://staging.friink.com`
- API: `https://staging-api.friink.com`
- Branch/deployment: `staging`, commit `0c754ad`

Production verification is intentionally deferred until the permanent production infrastructure is deployed to the Droplet/EC2 environment. The production smoke test will then verify the same cookie, CORS, refresh, rotation, and deployment behavior against that final infrastructure. The temporary production environment is not a release target and is not used as evidence in this audit.

## Phase 1 — Session reliability (staging evidence)

### Verification status

**Staging verification passed:** 2026-09-03, against staging deployment commit `0c754ad`.

**Phase 1 staging gate passed:** implementation verification is complete for the temporary staging environment. Production verification is a separate pre-release gate and is deferred until the permanent infrastructure exists.

### Live successful-login and refresh headers

Target API: `https://staging-api.friink.com`

Origin: `https://staging.friink.com`

Sanitized login response:

```text
HTTP 200
Set-Cookie: friink_refresh_token=[REDACTED]; HttpOnly; Max-Age=2592000; Path=/; SameSite=none; Secure
Access-Control-Allow-Origin: https://staging.friink.com
Access-Control-Allow-Credentials: true
```

Sanitized refresh response:

```text
HTTP 200
Set-Cookie: friink_refresh_token=[REDACTED]; HttpOnly; Max-Age=2592000; Path=/; SameSite=none; Secure
```

The cookie lifetime is `2,592,000` seconds, exactly 30 days. It is host-only because no `Domain` attribute is emitted.

### Live refresh rotation and lost-response grace trace

```text
Login                                  200
Refresh with current cookie            200
Replay immediately previous token       200
Replay same previous token again         401
```

The first replay receives a replacement cookie with the same secure attributes. The second replay is rejected, proving the grace path is one-use and bounded rather than disabling replay detection.

### Live CORS preflight

```text
OPTIONS https://staging-api.friink.com/auth/login
Origin: https://staging.friink.com
Access-Control-Request-Method: POST

HTTP 200
Access-Control-Allow-Origin: https://staging.friink.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
```

### Local verification

```text
api: pytest tests/test_phase1_contract.py tests/test_refresh_token_rotation.py tests/test_token_resilience.py
10 passed

web: npm exec tsc -- --noEmit
passed

web: npm run build
passed
```

### Phase 1 implementation evidence

- `api/app/routers/auth.py`: persistent refresh cookie, allowed-origin enforcement, one-use immediate replay grace, strict stale replay family revocation.
- `api/app/config.py`: 30-day refresh lifetime and 60-second replay-grace setting.
- `api/app/models/refresh_token.py`: persisted `reuse_grace_used_at` state.
- `api/alembic/versions/20260902_0018_add_refresh_reuse_grace.py`: database migration.
- `web/lib/auth.ts`: memory-only access token, cross-tab coordination, and terminal refresh-failure classification.
- `web/components/app-shell-route.tsx`: redirect only for terminal refresh failures.

### Limitations of this evidence

- This is staging evidence by design, not production evidence.
- Production verification is deferred to the permanent deployment and is not required to continue implementation phases in staging.
- Phase 2 is now active. Its identity-foundation work is tracked in the working tree and has not yet reached its verification gate.

## Phase 2 — Account identity

**Status:** In progress.

The Phase 2 identity foundation currently includes canonical case-insensitive username keys with preserved display casing, reserved username enforcement, permanent identity-history tables, progressive login throttling, and hashed OTP storage. Its focused foundation suite currently passes 15 tests.

The Phase 2 gate remains open pending signup privacy behavior, delivery-independent OTP endpoint wiring, email/username-change verification behavior, public UUID exposure review, race-condition coverage, and the complete staging verification trace.
