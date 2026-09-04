# Claude Audit — Auth and Session

This file records verification evidence for `docs/auth-and-session.md`. Refresh-token values are intentionally redacted; cookie attributes and response results are preserved. Staging signup OTP implementation notes are recorded separately from live evidence.

## Verification scope

All implementation verification in this audit is performed against the temporary staging environment only:

- Frontend: `https://staging.friink.com`
- API: `https://staging-api.friink.com`
- Branch/deployment: `staging`, latest Phase 2 deployment commit `a234b35` (Phase 1 evidence references the earlier `0c754ad` deployment)

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

The Phase 2 gate remains open pending signup privacy behavior, live staging OTP/provider evidence, email/username-change verification behavior, public UUID exposure review, race-condition coverage, and the complete staging verification trace. Delivery-independent signup OTP endpoint wiring is implemented; it is no longer an outstanding implementation item.

### Phase 2 staging deployment checkpoint (not a gate pass)

The Phase 2 signup-start slice was deployed to staging with OTP explicitly
disabled because no email provider was configured at that checkpoint.

Target API: `https://staging-api.friink.com`

Staging database health:

```text
GET /health/db
HTTP 200
{"database":true}
```

Signup-start probes at `2026-09-02T22:37:03Z` used disposable, unrecognized
emails and distinct usernames. Both returned the same status and public field
shape; reservation tokens are opaque and redacted here:

```text
POST /auth/signup/start
Origin: https://staging.friink.com

HTTP 202 Accepted
Access-Control-Allow-Origin: https://staging.friink.com
Access-Control-Allow-Credentials: true
Vary: Origin
{"accepted":true,"verification_required":false,
 "reservation_token":"[REDACTED]",
 "message":"If the signup details can be accepted, verification instructions will be sent."}
```

Credentialed preflight for the same endpoint returned:

```text
OPTIONS /auth/signup/start
HTTP 200
Access-Control-Allow-Origin: https://staging.friink.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
Vary: Origin
```

This checkpoint proves that the deployed endpoint was reachable and that the
staging default was safe while delivery was unavailable. It is not a complete
existing-versus-new email privacy test because the two probes did not use a
known existing account, and it does not test OTP completion while
`SIGNUP_OTP_ENABLED=false`.

### Phase 2c staging implementation checkpoint (not a gate pass)

The working-tree implementation now enables signup email-ownership OTP through
the existing reservation and verification endpoints when
`SIGNUP_OTP_ENABLED=true`. Resend is used as the staging delivery adapter:

- `RESEND_API_KEY` is read only by the API; `RESEND_FROM_EMAIL` and
  `RESEND_FROM_NAME` configure the sender.
- The web signup flow submits `/auth/signup/email/start` immediately after the
  email step, collects the six-character verification code, submits
  `/auth/signup/email/verify`, then collects password/profile details and
  submits `/auth/signup/complete` before logging in.
- Direct `/auth/signup` account creation is rejected while OTP is enabled, so
  the browser cannot bypass email ownership verification.
- Delivery failures return a generic `503`; provider credentials and recipient
  existence are not exposed.
- The existing backend policy remains authoritative: four-minute expiry,
  single-use codes, newer-code replacement, and five-attempt exhaustion.

This is a staging implementation checkpoint, not live evidence. The API and web
deployments still need to contain these changes, and the staging API hostname
must resolve before a browser/signup trace can be recorded. The final production
provider/account, durable email outbox, and production delivery rollout remain
deferred.

### Phase 2 phase-boundary clarification

The phase labels are intentionally distinct:

- **Phase 2c** owns signup email-ownership OTP: neutral signup responses,
  reservation reuse, hashed six-character codes, expiry, replay, attempt
  exhaustion, replacement codes, and verification before account creation.
- **Phase 2d** owns login-risk OTP/MFA: recognized versus new or suspicious
  devices, step-up challenges, device invalidation, failed-login throttling, and
  privacy-preserving failure behavior. Refresh does not require OTP.
- **Phase 2e** does **not** mean OTP generally. It owns email and username
  changes, verification where required for an email change, permanent private
  identity history, casing preservation, immediate username-key reuse, and
  race-condition behavior.

Phase 2e has not started. This is a phase-ordering decision: the overall Phase 2
gate remains open because Phase 2c still lacks live OTP/provider evidence and
existing-versus-new email comparison, while Phase 2d still lacks the live device
cookie trace and the new/suspicious-device OTP/MFA challenge evidence. Phase 2e
is therefore blocked by the preceding verification gates, not because Phase 2e
itself is an OTP phase.

### Phase 2 identity-rule checkpoint (not a gate pass)

Read-only staging checks against the deployed identity foundation returned:

```text
GET /auth/username-availability?username=AdMiN
HTTP 200
{"username":"AdMiN","available":false}

GET /auth/username-availability?username=SECURITY
HTTP 200
{"username":"SECURITY","available":false}

GET /auth/username-availability?username=bad%20name
HTTP 422
{"detail":"... Username may contain only letters, numbers, '-', '_', and '.' with no spaces. ..."}
```

All responses included `Access-Control-Allow-Origin:
https://staging.friink.com`, `Access-Control-Allow-Credentials: true`, and
`Vary: Origin`. These checks confirm case-insensitive reserved-name rejection
and syntax validation on staging. Signup/change race coverage and the full
Phase 2 gate remain open.

### Phase 2d device-recognition implementation checkpoint (not a gate pass)

The server-authoritative recognition substrate was implemented and its additive
migration was applied to the configured staging database. No production systems
were accessed.

Implementation evidence:

- `api/app/models/recognized_device.py` stores only a 32-byte hash of an opaque
  random identifier, with browser/OS coarse signals and revocation timestamps.
- `api/app/models/auth_session.py` links each new login session to the recognized
  device record through nullable `device_id`.
- `api/app/routers/auth.py` issues `friink_device_id` as an HttpOnly cookie with a
  one-year lifetime; the raw identifier is not in the JSON response.
- `api/alembic/versions/20260903_0022_add_recognized_devices.py` adds the device
  table and session foreign key without invalidating existing sessions.

Database and focused-test trace:

```text
python -m alembic upgrade head
INFO  Running upgrade 20260903_0021 -> 20260903_0022,
     add server-managed recognized devices

python -m alembic current
20260903_0022 (head)

python -m pytest tests/test_phase2_device.py tests/test_phase2_signup.py \
  tests/test_phase2_identity.py tests/test_otp_storage.py tests/test_lockout.py
5 passed, 1 warning in 30.52s

python -m compileall -q app alembic
passed

git diff --check
passed (LF-to-CRLF working-tree warnings only)
```

The focused test proves two logins with the same client cookie reuse one
recognition record, a separate client receives a separate record, three sessions
are linked to the two records, raw identifiers are absent from the login JSON,
and stored identifiers are 32-byte hashes.

Staging live-header evidence is still pending deployment of this checkpoint:

```text
Expected next staging trace after deployment:
POST /auth/login
HTTP 200
Set-Cookie: friink_device_id=[REDACTED]; HttpOnly; Max-Age=31536000; Path=/; SameSite=none; Secure
```

This is deliberately not asserted as live evidence yet. The 2d verification gate
also remains open for new/suspicious-device OTP/MFA challenges, challenge skip
rules, device invalidation, concurrent failures, cooldown boundaries, and privacy
checks. `SIGNUP_OTP_ENABLED=true` is permitted only in an environment with a
configured delivery provider; ordinary login remains password-only unless the
separate Phase 2d risk-based flow is enabled.
