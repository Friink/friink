# Friink Authentication and Session Architecture

Status: Living implementation/progress document. Each phase and subphase below
has an authoritative status plus implementation notes, test evidence, and
noteworthy follow-up items.

Last updated: 2026-09-10T13:30:00Z

## Database connection management

The API uses synchronous SQLAlchemy sessions over PostgreSQL/psycopg3. Connection
management is deployment-neutral: the API now uses environment-configurable
pooling rather than Neon-specific application logic. Neon Free uses
conservative pool limits, while the planned Ubuntu deployment may use a larger
pool based on API worker count and PostgreSQL `max_connections`.

The default profile uses 3 base connections plus 2 overflow connections, with
pre-ping, LIFO reuse, a five-minute recycle, and a bounded checkout timeout.
`DB_POOLING_ENABLED=false` remains available for runtimes that require
short-lived connections. Ubuntu deployments may increase the values only after
accounting for API worker count and PostgreSQL `max_connections`.

This document consolidates the agreed direction for Friink authentication,
ordinary login sessions, account identity changes, security notifications,
device enrollment, staff access, and administrative controls. It is a design
and implementation boundary document. It does not itself change runtime
behavior.

## 0. Decisions confirmed after review

The following points are part of the planned scope:

- Ordinary sessions use a persistent sliding idle window rather than the
  current fixed 14-day lifetime. The target is 30 days since the last valid
  session activity. Persistence is the default; there is no `Keep me logged
  in` choice.
- Refresh failures must distinguish a confirmed terminal session failure from
  an ambiguous server or configuration failure. Only a confirmed terminal
  result may clear local session state.
- Login security events and in-app notifications are in scope now. Future
  email notification delivery will consume the same durable event.
- Permanent email/username history and the database-backed reserved-username
  registry are in scope now.
- Signup email confirmation uses a fresh six-character alphanumeric OTP once
  email delivery is available. The user-facing signup order is email, OTP,
  password, then profile details. Login accepts either the account email or
  username, with both identifiers matched case-insensitively. Signup remains
  email-first and email ownership remains the OTP boundary. Ordinary password
  login does not require an OTP when the login is recognized as normal;
  risk-based OTP/MFA is used for a new or suspicious device/login and for
  defined high-risk actions. Access-token refresh never requires an OTP.
- The API-owned `OTP_ENABLED` master switch defaults to `true`. An explicit
  `OTP_ENABLED=false` is a local/test/staging testing override that bypasses
  signup, login-risk, lifecycle, and email-change OTP challenges; production
  API startup rejects the disabled value. Leaving the variable unset uses the
  secure default.
- Failed-login throttling follows the replacement policy in
  `docs/failed-login-policy.md`: failures 1–3 have no cooldown, failures 4–5
  use one minute, failures 6–8 use five minutes, and failures 9+ use a capped
  fifteen-minute cooldown. Successful login or password reset clears the
  state, which also expires after 24 hours of inactivity.
- Multiple-account support has a fixed web user flow: `Add account` in the side
  drawer opens a design-system login/signup modal; successful authentication
  adds the account to the current browser profile; and `Change account` appears
  only once at least two accounts are authenticated.
- A browser profile may remember the number of
  independent authenticated accounts configured by
  `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`. The safe default is `4`; this is a
  per-device switcher limit, not a limit on how many accounts a person may
  create. To exceed the configured limit, the user must remove one remembered
  account first.
- The setting accepts values from `1` through `16`. A value of `1` keeps the
  single-account path available while effectively disabling account
  switching. Sixteen is the current operational ceiling for the planned
  per-account-cookie design; supporting more accounts would require revisiting
  browser cookie and credential-storage architecture first.
- Ordinary sessions have both a 30-day sliding idle target and a 180-day
  maximum lifetime. Re-authentication is required after the absolute maximum,
  even if the account was used recently.
- `Log out` removes the active account from the current device and revokes its
  current device session only. Other remembered accounts remain available.
  Settings session controls remain scoped to the active account.
- Add-account authentication must preserve the active account's generic legacy
  refresh cookie and issue only the newly authenticated account's slot-specific
  refresh cookie. Ordinary standalone login retains the generic cookie behavior.
- Phase 1's ordinary-session behavior is the current implemented baseline.
  Its subphases below are verification boundaries, not a request to replace
  the working refresh/session foundation.

## 1. Product goals

Friink authentication should be simple for ordinary users and difficult to
abuse:

- A user creates an account with a unique email and username.
- Email ownership is verified without revealing whether an account already
  exists.
- Usernames are platform-level, case-insensitive identities with optional
  presentation casing.
- A successful login creates a durable session. Users should not repeatedly
  enter their password during normal use.
- Recoverable deployment, network, API, VPN, and platform-access problems must
  not unnecessarily log users out.
- Users can see and end their other active sessions.
- A successful new login creates an in-app security notification and is
  designed for future email notification delivery.
- After login, users can add and switch between multiple successfully
  authenticated Friink accounts on the web.
- Staff use normal Friink accounts plus role- and permission-controlled
  administrative features.
- Administrative access has stronger, time-limited protection without
  interrupting ordinary personal use of Friink.

## 2. Scope

### In scope

- Signup with unique email and username handling.
- Email ownership verification design and OTP integration when delivery is
  available.
- Six-character alphanumeric signup email OTP and risk-based OTP/MFA for new or
  suspicious logins once email delivery is available.
- Email and username changes from Settings.
- Permanent email and username history.
- Reserved usernames.
- Immutable internal UUID ownership and public post IDs.
- Persistent browser/app sessions and refresh-token rotation.
- A 30-day sliding idle session policy replacing the current fixed 14-day
  refresh lifetime.
- A terminal-versus-ambiguous refresh failure contract that prevents
  configuration or transient failures from logging users out.
- Session history, current-session identification, and user revocation.
- Login security notifications and future email notifications.
- Existing-session OTP enrollment for another device.
- Password hashing and password-change behavior.
- Superadmin bootstrap and future MFA capability.
- Staff roles, permissions, privileged session timeout, account locking, and
  administrative session revocation.
- Security/audit events for sensitive account and staff actions.
- Progressive failed-login throttling with independent IP/device protections.
- Multiple-account support with an authenticated web account switcher.

The initial staff discovery slice adds `users.is_staff`; authenticated user
responses may expose it so the shared web shell can show Control panel. This
flag does not authorize privileged control-panel actions.

### Out of scope for this design

- Final production email-provider selection, email-template wording, and
  production email-delivery rollout. Durable security events and the
  provider-neutral in-app notification path are in scope; the external email
  transport/outbox remains a later implementation step.
- Full staff dashboard and moderation product requirements.
- Staff permission names beyond the initial security boundaries.
- Billing, subscription entitlements, professional verification, or badges.
- Public display of IP addresses, locations, device fingerprints, or UUIDs.
- Immediate revocation of already-issued access JWTs on every ordinary session
  action.

## 2.1 Implementation division

The complete scope is divided into seven implementation phases. Phase 1 is
already implemented as the current session foundation, but it is split below
into smaller audit and release units so that staging evidence, production
verification, and future regressions have clear boundaries. Phases 2 through
6 are divided into ordered alphabetic chunks so that each dependency and
verification boundary is explicit. Every chunk must be reviewed and verified
before the next chunk changes shared auth/session behavior.

### Phase 1 — Session reliability

**Status:** Closed

**Implementation notes:** Ordinary one-account session reliability is implemented
and the staging release gate passed.

**Test results:** Phase 1 contract, refresh-rotation, web type-check, and
production-build checks passed; staging cookie/CORS/login/refresh evidence was
recorded.

**Noteworthy:** A true sliding-idle expansion and key-rotation rehearsal remain
explicit operational follow-ups, not blockers for the closed baseline.

Phase 1 is the implemented baseline for ordinary one-account sessions. The
subphases below do not change that behavior; they make its contract testable
and identify the remaining environment-specific evidence.

#### Phase 1a — Cookie, origin, and startup boundary

**Status:** Closed

**Implementation notes:** The API uses an HTTP-only refresh cookie, configured
origins, environment-specific API/web targets, and startup configuration
validation. Staging header/CORS evidence and the Phase 1 contract suite passed.

**Test results:** Credentialed CORS, cookie, login, and refresh checks passed in
the Phase 1 staging gate.

**Noteworthy:** Production evidence remains a release gate even after staging
success.

Keep the refresh credential in an explicit persistent HTTP-only cookie. Validate
at startup that the database URL, JWT signing configuration, cookie settings,
allowed origins, and environment-specific API/web origins are present and
consistent. Staging uses `https://staging.friink.com` and
`https://staging-api.friink.com`; production is a separate release target.

Verification gate: capture redacted login and refresh response headers,
credentialed CORS preflight, and a real browser request proving the cookie is
sent to the API and accepted after rotation.

#### Phase 1b — Sliding idle lifetime

**Status:** Closed

**Implementation notes:** The deployed session behavior and refresh lifetime
were verified through the Phase 1 staging gate. The current implementation
retains the established refresh/session contract; any future change to a true
sliding idle deadline must be tracked as a separate change.

**Test results:** Session lifetime, reload, restart, and terminal-action checks
passed for the accepted baseline.

**Noteworthy:** The documented 30-day sliding target remains a future explicit
enhancement where the current baseline does not yet implement it.

Use the 30-day target sliding idle window. Successful login and successful
refresh extend the server-side idle deadline. Explicit logout, revocation,
account lock, or confirmed terminal session failure ends the session. Access
token expiry alone must enter the refresh path.

Verification gate: test activity just before and after the idle boundary,
browser reload, ordinary deployment/restart, and explicit terminal actions.

#### Phase 1c — Rotation, replay, and recoverable refresh

**Status:** Closed

**Implementation notes:** Refresh rotation, bounded immediate replay grace,
dead-token family revocation, and terminal-versus-ambiguous client handling
are implemented. `test_refresh_token_rotation.py` and token-resilience
coverage passed; refresh reuse now also records a durable security event.

**Test results:** Rotation, replay, logout, and refresh-reuse regression tests
passed.

**Noteworthy:** Generic client-facing refresh failures remain unchanged while
reuse is separately observable server-side.

Rotate refresh tokens transactionally within a token family. A legitimate
retry or lost response may use the deliberately bounded grace/idempotency
contract. A confirmed reuse of a dead token revokes the family. Timeout,
network/CORS failure, 5xx, malformed response, and configuration failure are
ambiguous and must not clear local auth.

Verification gate: test concurrent refreshes, replacement-cookie acceptance,
lost-refresh responses, replay of a dead token, and each terminal versus
ambiguous outcome.

#### Phase 1d — Reactive web refresh and cross-tab coordination

**Status:** Closed

**Implementation notes:** The web client coordinates refresh work across tabs,
keeps access tokens in memory, and clears local state only for confirmed
terminal failures. TypeScript and production-build verification passed.

**Test results:** Web type-check, production build, expired-request retry, and
recoverable-failure checks passed.

**Noteworthy:** Proactive refresh and client-side clearing on arbitrary 401s
remain prohibited.

Keep the web client reactive: after `401 TOKEN_EXPIRED`, refresh once and retry
the original request once. Coordinate concurrent refreshes across tabs and
retain local auth through recoverable failures. Do not add proactive refresh or
clear auth because an arbitrary response happens to be `401`.

Verification gate: exercise multiple tabs, concurrent expired requests,
offline/online transitions, non-expiry `401` responses, and recovery after a
refresh response is lost.

#### Phase 1e — Token and key-handling boundary

**Status:** Closed

**Implementation notes:** JWT validation is server-authoritative with minimal
claims, signing-key identifiers, typed validation failures, and configured
key-rotation support. Key-rotation rehearsal remains an operational follow-up.

**Test results:** JWT validation, expiry, skew, and secret-redaction checks
passed for the current baseline.

**Noteworthy:** Full mixed-key rotation rehearsal is tracked under Phase 6c.

Keep access tokens short-lived and in memory on web clients. Verify JWTs by
key ID and retain the previous verification key throughout the documented
rotation overlap. Never log passwords, OTPs, raw refresh tokens, internal
UUIDs, or signing secrets. Keep server clocks on synchronized UTC with an
explicit, tested skew policy.

Verification gate: run mixed-key verification, expiry-boundary tests, clock
offset tests, and log inspection for secret leakage.

#### Phase 1f — Release evidence and regression gate

**Status:** Closed

**Implementation notes:** The Phase 1 staging gate passed and the API/web
regression/build checks passed. The later migrate-before-deploy safeguard now
blocks Vercel deployment on migration failure or schema drift.

**Test results:** The Phase 1 regression/build gate and staging release checks
passed.

**Noteworthy:** Production verification is not implied by staging success.

The implementation baseline is complete only when the preceding contracts are
verified in staging and the same checks pass against the permanent production
origins before release. A staging `Failed to fetch` result is not sufficient
evidence of an auth failure: inspect the API status, CORS headers, deployment
configuration, and database health separately.

Verification gate: record the staging evidence now; repeat the production
cookie/CORS, login, refresh, terminal-failure, and recovery evidence as a
pre-release gate. Production verification is not implied by staging success.

### Phase 2 — Account identity

**Status:** Closed

**Implementation notes:** Identity allocation, signup privacy/OTP, risk-based
login, identity changes, public handles, and stale-URL rules are implemented.

**Test results:** Phase 2 auth suites and the later hardening regression run
passed; staging and production verification was recorded for the phase gate.

**Noteworthy:** Live login-risk/email-change trace evidence and TOCTOU race
hardening remain tracked follow-ups; they do not reopen the accepted gate.

#### Phase 2a — Identity primitives and signup validation

**Status:** Closed

**Implementation notes:** Canonical email/username handling, password hashing,
validation, public handles, and signup response privacy are implemented and
covered by the Phase 2 auth/signup suites.

**Test results:** Normalization, validation, signup privacy, and identity
allocation checks passed.

**Noteworthy:** TOCTOU race hardening remains a tracked follow-up.

Implement the canonical case-insensitive email and username model: normalized
email uniqueness, `username_key`, `username_display`, username syntax, date-of-
birth and 13-year minimum validation, and authoritative database constraints
for signup races. Assign every user a random immutable internal UUID and keep
post ownership on immutable identifiers. UUIDs remain internal and are never
returned through normal user-facing surfaces.

Verification gate: test normalization, casing preservation, invalid and
underage dates of birth, duplicate races, concurrent signup attempts, and the
absence of UUIDs from URLs, normal API responses, UI, notifications, logs, and
emails.

#### Phase 2b — Reserved names and identity allocation

**Status:** Closed

**Implementation notes:** Reserved-name rejection is case-insensitive and
database-backed; username allocation and reuse follow the documented policy.
Staging reserved-name and syntax probes passed.

**Test results:** Reserved-name casing, syntax, and allocation probes passed in
staging.

**Noteworthy:** Concurrent allocation hardening remains tracked with the Phase
2 identity follow-ups.

Implement the database-backed reserved-username registry and enforce it during
both signup and username changes. Matching is case-insensitive. Seed the
initial reserved values `admin`, `staff`, `media`, `support`, and `security`,
with reason, active state, creation timestamp, and optional staff note.

Verification gate: test reserved-name rejection under every casing, inactive
reservations, signup/change races, and explanatory frontend checks that cannot
bypass the API or database rule.

#### Phase 2c — Signup email privacy and ownership OTP

**Status:** Closed

**Implementation notes:** Email-only reservation → OTP verification →
password/profile completion is implemented with hashed, expiring, single-use
codes, neutral responses, and bounded cleanup. Staging live delivery reached
the OTP screen; provider configuration remains environment-specific.

**Test results:** Signup OTP, expiry, replay, replacement, privacy, and staging
delivery checks passed for the accepted gate.

**Noteworthy:** Existing-vs-new email timing and response parity remains an
explicit follow-up to verify in a live trace.

Implement the delivery-independent signup contract and wire in the fresh
six-character alphanumeric email OTP when delivery is available. The UI starts
the flow with the email-only `/auth/signup/email/start` route, shows the OTP
screen immediately after the email step, verifies through
`/auth/signup/email/verify`, and collects password/profile details only after
email ownership succeeds. Final account creation uses
`/auth/signup/complete`. Responses for existing and unrecognized emails must be
neutral and indistinguishable in body, status, timing, and UI. Store OTPs
hashed; expire them after four minutes; allow five attempts; make each OTP
single-use; invalidate an older OTP when a newer one is issued; and rate-limit
requests and delivery.

Do not create a partially usable account before the required verification
decision. The pre-verification record stores only the normalized email and
hashed OTP; password/profile data is submitted after email verification. A
failed or abandoned signup reservation releases its email immediately, subject
to rate limits, and can never replace or duplicate an existing account.

Verification gate: compare existing versus new email behavior, test expiry,
replay, attempt exhaustion, replacement OTPs, hashed storage, incomplete-
signup reuse, delivery failure, and enumeration resistance.

#### Phase 2d — Login risk, device recognition, and failed-login throttling

**Status:** Closed

**Implementation notes:** Recognized-device records store hashes, new/changed
devices require OTP, lockout tiers are distinct, and missing device signals
fail closed. Staging regression coverage includes the lifecycle/lock boundary
and missing-cookie guard; the named hardening run passed 3 tests.

The login contract accepts either an email address or a username in one
identifier field. Email matching is case-insensitive; username matching uses
the authoritative case-folded `username_key`, so casing differences do not
create a second identity. The API accepts the canonical `identifier` field
and temporarily accepts the legacy `email` field for existing clients. Unknown
or malformed identifiers use the same generic invalid-credentials response as
an incorrect password and follow the same lockout and rate-limit policy. The
web login screen labels the field `Email or username` and keeps signup
email-only. This identifier support and the risk/device work below are
implemented in the current Phase 2 build; live staging deployment evidence
remains the final acceptance step for this phase.

Implement ordinary password login with risk-based OTP/MFA: recognized normal
logins do not require an OTP, while a new or suspicious login and defined
high-risk actions can require a fresh four-minute OTP/MFA. A user-enabled
two-factor setting may require OTP for every new login. Refresh never requires
password or OTP. Username login must pass through exactly the same risk,
device-recognition, lockout, and OTP decisions as email login.

Add server-authoritative device/session recognition using a protected random
device identifier and coarse signals. Do not trust a client claim, IP address
alone, or browser fingerprint alone. Missing or changed identifiers trigger a
step-up challenge rather than proving compromise. Apply the replacement
progressive policy in `docs/failed-login-policy.md`: the third failure notifies
without a cooldown, failures 4–5 use one minute, failures 6–8 use five
minutes, and failures 9+ use a capped fifteen-minute cooldown. Successful login
or password reset clears the progressive state. This phase adds the independent
per-IP control; device/session throttling is explicitly deferred and is not
part of this policy.

Verification gate: test email login, username login, mixed-case identifiers,
recognized versus new and suspicious logins, challenge skips and challenges,
refresh without OTP, device rotation/invalidation, concurrent failures,
cooldown boundaries, successful-login reset, and account privacy during all
failures.

#### Phase 2e — Email and username changes with permanent history

**Status:** Closed

**Implementation notes:** Email changes require current-password confirmation
and new-address OTP; username changes preserve history and enforce
case-insensitive uniqueness. Auth responses use public handles and omit
internal UUIDs and sensitive profile fields.

**Test results:** Email-change OTP, username-change, history, and public-response
regression checks passed.

**Noteworthy:** Live staging trace and concurrent-change hardening remain
tracked follow-ups.

Implement authenticated email changes with current-password or equivalent
step-up protection where required. Keep the old email active until the new
email's four-minute ownership OTP succeeds, then enforce uniqueness and retain
the old value in permanent private history. Implement username changes with an
authoritative unique `username_key` check, immediate release of the old key,
preserved display casing, and permanent history for both old and new values.

Use dedicated email and username history tables with timestamps and
actor/session references. History is never used to resolve a released
username to its former owner and is not exposed to ordinary users; email
history has stricter access controls.

Verification gate: test abandoned and successful email changes, OTP replay,
step-up behavior, username casing-only changes, immediate username reuse,
history retention/privacy, and concurrent changes.

#### Phase 2f — Public identity and stale URL handling

**Status:** Closed

**Implementation notes:** Non-auth identity fields serialize public handles;
chat, notifications, connections, blocking, posts, and like actors were
updated with regression coverage. Object UUIDs remain object identifiers.

**Test results:** Chat, notification, connection, blocking, post, and like-actor
public-handle regression checks passed.

**Noteworthy:** Internal user UUIDs must never be substituted for public handles
in future response schemas.

Preserve username-based profile URLs while making immutable public post IDs
authoritative. A stale username or cosmetic slug in a post URL must redirect
to the current canonical URL; the post remains owned by the original user UUID.
Username reuse must not transfer posts, followers, messages, mentions, or
history. Historical mention text remains historical text and must not silently
resolve to the new owner.

Verification gate: test post resolution across username changes and reuse,
canonical redirects, ownership checks, profile ownership after reuse, and
historical mention rendering.

### Phase 3 — Security events and notifications

**Status:** Closed

**Implementation notes:** Durable security events, in-app login notifications,
provider-neutral hooks, and retryable idempotent outbox processing are deployed.

**Test results:** Phase 3 acceptance passed on staging and production on
2026-09-05; migration `20260906_0032` and outbox retry/recovery checks passed.

**Noteworthy:** Failed-login email notification remains intentionally deferred
to Phase 7.

#### Phase 3a — Durable security-event model

**Status:** Closed

**Implementation notes:** Security events have durable identity, event type,
context, and delivery state; refresh-token reuse has its own durable signal.

**Test results:** Event uniqueness, transaction-boundary, login/refresh/failure,
and security-action coverage passed in the Phase 3 acceptance run.

**Noteworthy:** Internal UUIDs remain server-side and are not used as public
identity fields.

Implement durable login and security events with stable event identity,
timestamp, user/session/device context, event type, and delivery state. A
successful new login must be distinguishable from refresh, retry, and ordinary
session activity without exposing internal UUIDs in user-facing content.

Verification gate: prove event uniqueness and transaction boundaries for
successful logins, retries, refreshes, failed logins, and security actions.

#### Phase 3b — Login notifications and future email hooks

**Status:** Closed

**Implementation notes:** A successful new login creates one in-app security
notification through a provider-neutral delivery boundary; refreshes and
retries do not create duplicate user-visible notifications.

**Test results:** Staging and production acceptance traces passed.

**Noteworthy:** Notification delivery is asynchronous and cannot log out an
otherwise valid authenticated session.

Create the in-app login-security notification from the durable event and add a
provider-neutral integration point for future email delivery. Include
suspicious-login actions without making notification delivery a prerequisite
for keeping the authenticated session alive.

Verification gate: prove every successful new login creates one user-visible
in-app notification, while refreshes and duplicate request retries do not.

#### Phase 3c — Retryable outbox processing

**Status:** Closed

**Implementation notes:** Outbox work is idempotent and retryable, with provider
failure, delayed delivery, retry exhaustion, and stale-work recovery handling.

**Test results:** Duplicate-worker and provider failure/recovery scenarios passed
in the Phase 3 acceptance run on both environments.

**Noteworthy:** Delivery failure remains separate from authentication failure.

Implement retryable, idempotent outbox processing for in-app and future email
notifications. Temporary provider, network, or configuration failures remain
delivery failures, not authentication failures, and must not log the user out.

Verification gate: simulate duplicate workers, provider failures, delayed
delivery, retry exhaustion, and recovery while preserving exactly-once
user-visible event behavior.

### Phase 4 — User session controls

**Status:** Closed for the current web-focused release

**Implementation notes:** Phases 4a–4c and 4f are closed. Phase 4d and the
web/API portion of 4e are implemented, including approval notifications,
cross-tab account switching, loading boundaries, and lifecycle fallback.
The web/API implementation is complete for this release. Mobile-specific
requirements are maintained separately in `docs/auth-and-session-mobile.md`.

**Test results:** Existing session and refresh regression coverage passes;
web/API implementation and the current release checks are complete.

The account switcher refreshes its device account inventory when opened and
after Add account authentication completes. This keeps newly added accounts
visible without relying on a full-page reload and prevents an older in-flight
inventory request from overwriting the current list.

**Noteworthy:** Mobile requirements are intentionally outside this current
web-focused closure and are owned by `auth-and-session-mobile.md`.

#### Phase 4a — Session inventory and current-session identity

**Status:** Closed

**Implementation notes:** Session inventory and current-session identity use
server-derived metadata and keep tokens, device signals, network data, and
internal UUIDs out of responses.

**Test results:** Session-management and refresh-rotation regression coverage
passed for current-session and revocation boundaries.

**Noteworthy:** Safe device labels are presentation metadata, not trusted
device identity.

Complete the authenticated session list using server-derived session identity.
Show safe device labels and activity metadata without exposing refresh tokens,
device identifiers, IP addresses, locations, fingerprints, or internal UUIDs.
Mark the session represented by the presented refresh cookie as current.

Verification gate: test multiple browsers and browser profiles,
refresh rotation within one family, and current-session detection.

#### Phase 4b — Selective and bulk revocation

**Status:** Closed

**Implementation notes:** Selective, revoke-others, and current-session logout
use authoritative refresh-family revocation and preserve terminal-versus-
ambiguous failure semantics.

**Test results:** Refresh rotation/revocation tests passed, including replay and
logout behavior.

**Noteworthy:** Already-issued access-token behavior remains governed by the
documented deactivation-versus-lock boundary.

Implement ending one other session, ending all other sessions, and the current
session logout path. Revocation must be authoritative, idempotent, and
consistent with the terminal-versus-ambiguous refresh contract. Do not claim
immediate revocation of already-issued access JWTs beyond the documented
boundary.

Verification gate: test selective revocation, revoke-others, current logout,
replay of revoked refresh tokens, simultaneous actions, and recoverable API or
network failures.

#### Phase 4c — Password-change continuity

**Status:** Closed

**Implementation notes:** Password changes enforce the current-password/step-up
boundary and preserve the current session while applying the password policy.

**Test results:** Auth update and password/session continuity coverage passed.

**Noteworthy:** Other-session handling remains explicit and user-controlled.

Implement the revised password-change flow: verify the current password or
approved equivalent step-up, apply the signup password policy, keep the
current session active after success, and provide user-controlled other-
session controls. Define which sessions are revoked by policy and surface the
result clearly.

Verification gate: test wrong current passwords, password policy failures,
successful continuity, other-session behavior, refresh rotation, and failure
recovery.

#### Phase 4d — Existing-session device enrollment

**Status:** Implemented — staging request-flow verified

**Implementation notes:** New-device login accepts credentials once and offers
one verification path: emailed OTP or approval from an existing signed-in
session. Existing sessions show coarse device details with Approve/Deny; the
new device polls approval and creates its separate session on success.

**Test results:** Staging-backed acceptance covers approval completion and
separate session creation; the existing OTP path remains covered by the login
challenge regression suite.

**Noteworthy:** Phase 2 device recognition does not complete this enrollment
flow or separate-session creation.

Implement existing-session-assisted new-device login. The new device first
submits the normal email-or-username and password once. Friink then creates a
fresh four-minute verification request, sends one OTP to the registered email,
and shows an approval request in existing signed-in sessions. The user
completes exactly one verification method: enter the emailed OTP on the new
device, or approve the request from an existing session. Approval and OTP are
alternatives, not sequential checks. No second password, OTP, or risk check is
required. A successful verification creates a separate ordinary session and
recognition record; it does not expose tokens or device identifiers.

The existing-session prompt identifies the account and coarse new-device
details and provides Approve and Deny actions. It must not display the
plaintext email OTP. Denial, expiry, logout/revocation of the initiating
session, account lock, or lifecycle transition invalidates the pending request.
The OTP is single-use, stored hashed, attempt-limited, rate-limited, and bound
to the user, initiating login, intended device, and enrollment action.

Verification gate: test credentials, emailed OTP completion, existing-session
approval completion, denial, expiry, replay, replacement codes, wrong-device
use, rate limits, revocation during the request, and creation of the separate
session. Prove that OTP and approval are alternative paths and that no second
verification is requested.

#### Phase 4e — Multiple-account device sessions and switching

**Status:** Implemented — web/API staging verified

**Implementation notes:** The device-scoped slot model, safe account APIs,
web drawer/modal flow, lifecycle fallback, security notifications, and
cross-tab switching are implemented. Mobile-specific requirements are
maintained in `docs/auth-and-session-mobile.md`.

**Test results:** Staging-backed account and approval acceptance passed (`2
passed`); API compilation, web TypeScript, production build, and Alembic
drift checks passed.

**Noteworthy:** Existing single-account cookies and refresh semantics remain a
compatibility constraint; user IDs and browser-readable refresh tokens stay
forbidden.

Implement the device-scoped session-slot and opaque account-slot model described in
section 8.5. Keep the existing login and signup endpoints as the authentication
authority, then register a successful account on the current browser profile.
Add safe account listing, account switching, account
removal, account-scoped refresh/session selection, and account-scoped client
state isolation. Do not expose user IDs or move refresh tokens into
JavaScript-readable storage. Preserve the single-account session path and
existing refresh/revocation semantics.

Break implementation into these delivery parts:

- **4e-a — Server contract:** additive slot/session data model, exact account
  summary and switch/remove response schemas, validated
  `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` enforcement, ownership checks,
  idempotency, and independent-account isolation.

  **Status:** Implemented — staging verified

  **Implementation notes:** Opaque device-scoped slots, safe summaries,
  server-side limits, switch/remove endpoints, and slot-specific HttpOnly
  refresh cookies are implemented.

  **Test results:** Dedicated two-account switch/refresh/remove acceptance passed.

  **Noteworthy:** The account limit must be enforced server-side.
- **4e-b — Web auth state:** one active account context, slot-scoped refresh
  cookies and cross-tab coordination, safe persisted summaries, state/cache
  partitioning, and recovery without logging out other accounts.

  **Status:** Implemented — web staging verified

  **Implementation notes:** Slot-scoped cookies, persisted active-slot state,
  BroadcastChannel coordination, and reload-based account state isolation are
  implemented.

  **Test results:** Web TypeScript and production build passed.

  **Noteworthy:** Existing single-account recovery is a compatibility
  constraint.
- **4e-c — Add-account experience:** design-system modal, reused login/signup
  flow, OTP handling, duplicate-account behavior, limit messaging, and
  accessibility.

  **Status:** Implemented — web staging verified

  **Implementation notes:** Existing Modal, LoginScreen, ProfileCard, and
  confirmation patterns are reused for Add account and Manage Accounts.

  **Test results:** Build and type checks passed; API acceptance covers account registration.

  **Noteworthy:** Additional duplicate, cancellation, limit, and accessibility
  UI tests remain useful follow-up coverage but do not block the web release.
- **4e-d — Account lifecycle:** switching, removal, logout, locked/revoked
  accounts, password changes/resets, session inventory, notifications, and
  security-event behavior.

  **Status:** Implemented — web/API staging verified

  **Implementation notes:** Confirmed removal, most-recent-account fallback,
  active logout, lifecycle messaging boundary, login-security notifications,
  approval toasts, and cross-tab refresh are implemented.

  **Test results:** Approval denial/OTP invalidation, notification creation,
  fallback, and dedicated Phase 4 acceptance passed.

  **Noteworthy:** Account lifecycle is a separate active product contract and
  must not be inferred from one-account session behavior.
Verification gate: test Add account login, Add account signup through OTP,
modal cancellation, duplicate/retry behavior, safe account-list fields,
switch success and failure, hidden Change account with fewer than two accounts,
account removal, logout/revocation boundaries, browser reload, multiple tabs,
account-scoped notifications, and cross-account data/cache isolation. Mobile
acceptance is defined separately in `docs/auth-and-session-mobile.md`.

#### Phase 4f — Expiry, recovery, and user messaging

**Status:** Closed

**Implementation notes:** Terminal session failures are separated from
recoverable network, CORS, timeout, 5xx, malformed, and configuration failures.

**Test results:** Refresh-resilience, logout, expiry, and client recovery tests
passed in the session regression coverage.

**Noteworthy:** Full multi-account recovery remains dependent on Phase 4e.

Implement session-expiry and recovery messaging that distinguishes confirmed
terminal session failure from network, CORS, timeout, 5xx, malformed, and
configuration failures. Preserve the user session through recoverable failures
and ask for login again only after a confirmed terminal result.

Verification gate: test idle expiry, explicit revocation, expired access-token
refresh, lost refresh responses, cross-tab recovery, browser reload, and
offline/online transitions.

### Phase 5 — Staff and superadmin security

**Status:** Phase 5a–5d server/UI implementation present; staging rollout and browser verification complete

**Implementation notes:** The initial slice adds `users.is_staff`, exposes it
only on authenticated user responses, and conditionally shows the Control panel
entry in the shared drawer. The privileged administration plane now includes
database-backed roles/permissions, opaque step-up sessions, and permissioned
lock/session-revocation routes.

**Test results:** Existing API suite and bootstrap acceptance pass; Python compilation,
web TypeScript, migration-head checks, and focused Phase 5/bootstrap tests pass.
Staging migrations are at `20260908_0039`; the deployed admin completed ordinary
login and privileged step-up in Chrome, and all five Control Panel sections
rendered successfully after redeployment. A missing `staff_mutation` application
enum member was found from the Vercel runtime log and corrected before final
verification.

**Noteworthy:** Existing backend staff hooks do not constitute the complete
bootstrap, role, step-up, or administrative-revocation phase.

#### Phase 5a — Reserved superadmin bootstrap

**Status:** Implemented; staging rollout and browser verification complete; production rollout deferred

**Implementation notes:** Phase 5a is the secure provisioning and recovery
boundary for the first reserved superadmin. The operator-invoked bootstrap
command validates explicit environment/database targeting, serializes the
check-and-create transaction, reuses normal signup/password validation, and
records redacted bootstrap events. It does not implement the staff dashboard,
general role-management UI, privileged sessions, or administrative actions;
those remain in later Phase 5 subphases.

**Test results:** `python -m pytest` passed with 118 tests; the focused bootstrap
suite passed with 14 tests. Compile and Alembic-head checks also passed. Staging
is at migration head `20260908_0039`; the existing reserved admin was confirmed,
the one-time bootstrap correctly refused to overwrite it, and ordinary admin
login was verified in Chrome. Production rollout remains deferred.

**Noteworthy:** No ordinary-user endpoint may become a superadmin bypass.

Implement a one-time, deployment-safe reserved superadmin bootstrap with
strong password handling, explicit configuration validation, protected audit
events, and safeguards against accidental takeover or repeated bootstrap.

#### Phase 5a contract

**Reserved identity:** The first superadmin has the fixed reserved identity
`admin@friink.com` and `@admin`. Email matching is case-insensitive and
username matching uses the canonical username key. Both values must be reserved
before ordinary signup can use them. Bootstrap must not accept arbitrary
identity values from a client request.

The `admin` username is reserved in the database-backed `reserved_usernames`
registry. The reserved admin email is enforced by the signup service as a
fixed system identity until the account exists; the users table's
case-insensitive unique index remains the final database uniqueness boundary.

**Source of truth:** The account is an ordinary `users` record with
`is_staff = true` and the normal active/verified account state. It uses the
same database and ordinary login flow. Role and permission assignment becomes
authoritative in Phase 5b; no ordinary-user endpoint may grant staff or
superadmin status.

**Execution boundary:** Bootstrap runs only through an explicit operator-
invoked deployment/server command or protected one-time job. It must not run
during application startup, signup, login, refresh, or a browser request. The
target environment must be explicit; staging and production configuration must
never fall back to one another.

**Configuration validation:** Validate the target database, environment name,
JWT/security configuration, and reserved identity before opening a write
transaction. The operator must provide an explicit `--environment` and the
deployment settings must contain matching `ENVIRONMENT`, `DATABASE_TARGET`,
`DATABASE_URL`, and `FRONTEND_URL` values. Reject missing, malformed,
ambiguous, or development-only configuration for production. Never print
connection strings, secrets, tokens, or password data.

**One-time and concurrency behavior:** A successful existing bootstrap is a
refusal, not an update. Refuse existing superadmins, email conflicts, username
conflicts, and inconsistent target records. Use database uniqueness constraints
plus a transaction and database-level serialization so concurrent invocations
cannot create duplicates or partial identities. Failed transactions must leave
no staff record, password hash, or misleading success audit event.

**Password handling:** Prompt through interactive secret input or approved
secret injection. Never accept a password in command-line arguments, a
migration, source, an ordinary environment file, logs, or API responses.
Enforce the normal minimum-8-character policy, request confirmation, hash through
the existing password service, and return a non-zero status on mismatch or
policy failure.

**Account initialization:** Create an active, verified, staff-enabled account
through the normal user schema. Do not overwrite profile, password, lifecycle,
or security fields on an existing record. The account must be usable through
ordinary login.

**Recovery:** After provisioning, use the ordinary email reset-link flow in
`docs/forget-password.md`. Successful recovery revokes refresh sessions and
requires fresh login. If mailbox access is lost, recovery is a separately
protected deployment/server operation; there is no ordinary-user superadmin
bypass.

**Audit:** Record immutable, redacted events for successful bootstrap, repeat or
conflict refusals, invalid configuration, and operator-level recovery. Events
must not contain passwords, reset tokens, token hashes, database URLs, JWT
secrets, or raw credential material.

**UI boundary:** The web UI may show Control panel when the authenticated
response reports `is_staff = true`. In Phase 5a this is discoverability only;
the flag alone does not authorize privileged actions. A staff user with no
assigned roles sees the Control panel entry but receives a calm empty state
explaining that staff access has not yet been assigned; the UI must not imply
that the user can perform administrative actions.

**Rollout:** Apply the additive migration, deploy compatible API code, run the
explicit `python -m scripts.bootstrap_admin --environment staging` command
against staging, verify login and recovery, then repeat with
`--environment production`. Do not create the account through an Alembic
migration or startup hook.

Verification gate: test first-run bootstrap, rerun behavior, invalid
configuration, secret rotation, recovery, and absence of superadmin bypasses
through ordinary user APIs. Also test email/username conflicts, concurrent
invocations, rollback, password-policy failures, redacted audit events,
environment separation, ordinary login, refresh-session revocation after
reset, and the Control panel discoverability boundary.

#### Phase 5a implementation audit and closure notes

The following audit was completed before implementation and is retained as the
evidence trail. The implementation follow-up below records how each finding was
addressed or remains intentionally outside this phase.

**1. Environment separation — Addressed.** `api/app/config.py:10-17`
defines an explicit `ENVIRONMENT` setting, but loads only `.env` by default;
there is no automatic `.env.staging` selection. `api/.env.staging:3-4` and
`api/.env:2-3` contain distinct frontend/environment values, while
`README.md:50-60` documents separate deployment projects. No staging-to-
production or production-to-staging fallback branch was found. However, the
application does not validate that database target, frontend URL, and
environment name belong together, and missing values can fall back to
development/local defaults in `api/app/config.py:13-17`. Phase 5a now rejects
those ambiguous targets through `api/scripts/bootstrap_admin.py:50-70`, which
requires matching `--environment`, `ENVIRONMENT`, `DATABASE_TARGET`, and
`FRONTEND_URL` values.

**2. Migration/startup conventions — Found.** Data-changing migrations exist,
including reserved-username seeding in
`api/alembic/versions/20260903_0019_identity_foundation.py:16-20,56-66`, a
profile-state backfill in `api/alembic/versions/20260831_0011_add_profile_setup_state.py:21`,
and public-handle backfill in
`api/alembic/versions/20260905_0030_user_public_handles.py:17`. Application
startup in `api/app/main.py:19-70` configures the FastAPI app, CORS, routers,
and health routes only; no startup/lifespan user seeding hook was found.
`api/alembic/env.py:16-24` only configures Alembic metadata and the database
URL. None of these mechanisms creates the superadmin, and Phase 5a must use a
standalone operator-invoked command.

**3. Reserved-identity uniqueness — Addressed for Phase 5a.** Database-level email
uniqueness is present on `users.email` at `api/app/models/user.py:21` and via
the case-insensitive index at `api/app/models/user.py:16`, created by
`api/alembic/versions/20260905_0029_casefold_email_uniqueness.py:15`.
Canonical username uniqueness is enforced at
`api/app/models/user.py:15` and
`api/alembic/versions/20260903_0019_identity_foundation.py:20`.
`is_staff` is intentionally non-unique at `api/app/models/user.py:36`, and no
database-level superadmin invariant exists because multiple staff users are
allowed. The hardened command at `api/scripts/bootstrap_admin.py:111-164`
uses transaction serialization, refuses repeat/email/username conflicts, and
rolls back account creation on failure. The reserved admin email is also
blocked by the signup service at `api/app/services/auth.py:20-37,75-78,105-107,145-147,173-175,207-209`.

**4. Audit event infrastructure — Addressed for Phase 5a.** The existing `security_events`
primitive is defined at `api/app/models/security_event.py:21-35` with UUID
identity, unique event key, optional user/session/device references, event
type, JSON payload, and timestamp. It is created by
`api/alembic/versions/20260906_0032_security_events_outbox.py:17-40` and
written through `api/app/services/security_events.py:13-39`; current uses are
login, refresh, logout, refresh-reuse, and failed-login paths at
`api/app/routers/auth.py:303-306,553-556,617-620,674-713` and
`api/app/services/auth.py:355-357`. Phase 5a extends this primitive with
bootstrap success/refusal event types and redacted payloads in
`api/app/models/security_event.py:18-19`,
`api/app/services/security_events.py:42-52`, and
`api/scripts/bootstrap_admin.py:151-164`; no second audit table was introduced.

**5. Password service reuse — Addressed.** `hash_password` and
`verify_password` are defined in `api/app/services/security.py:19-24`.
The required minimum-8-character policy is `validate_password_rules` in
`api/app/schemas/auth.py:11-26`, used by signup at `:47-54` and reset at
`:200-207`. The current bootstrap command imports/calls `hash_password` at
`api/scripts/bootstrap_admin.py:22-24,111,181-184`; the command validates the
policy before hashing, prompts for both password entries, and does not accept
passwords through command-line arguments or configuration.

**6. Reset-link flow — Drift Detected.**
`docs/forget-password.md:3-13` matches the implemented email-only,
generic-response, hashed single-use token, 30-minute expiry, and session
revocation behavior. The implementation is in
`api/app/services/password_reset.py:25-50` and
`api/app/routers/auth.py:738-767`; the UI calls it through
`web/lib/auth.ts:93-98` and `web/app/reset-password/page.tsx:1-33`.
Previously issued tokens are invalidated at
`api/app/services/password_reset.py:29-32`. Drift remains because the doc
identifies reset-specific rate limiting as required at
`docs/forget-password.md:27-28`, but no such limiter was found in the reset
router/service, and no reset-specific security event is emitted. Phase 5a
must not assume those controls are already provided by password recovery.

#### Phase 5b — Staff roles and granular permissions

**Status:** Implemented; staging browser verification complete

**Implementation notes:** Phase 5b uses database-backed roles and permissions.
Role and permission records are separate from the `users.is_staff` discovery
flag. The only initially seeded role is `superadmin`. Other roles, such as
`admin`, `moderator`, `support`, or a future `marketer`, are created only when
needed by a superadmin. Each role has an immutable internal ID and stable key,
plus an editable unique display name. Permission keys are stable system
identifiers. Roles may be renamed and permissions may be assigned or removed
from roles by a superadmin; staff users receive permissions through role
assignments. The model also supports additive per-user permission grants for
narrowly scoped exceptions, such as giving one user `sessions.revoke` without
changing their role. Direct grants add to role permissions; they cannot subtract
or deny a role permission in this release.

**Test results:** Existing API suite and focused Phase 5 tests pass. Staging
Roles & Permissions loaded the seeded `superadmin` role and its administrative
permission set; Users & Accounts loaded the live account inventory with the
admin's effective permissions.

**Noteworthy:** New permissions require a documented key, server-side
enforcement, and tests before they are exposed in the control panel.

Implement staff roles and least-privilege permissions with server-side checks
on every administrative action. Keep permission names and moderation-product
details extensible, while enforcing the initial security boundaries and
separating ordinary personal access from staff access.

Initial permission keys are `staff.access`, `users.view`, `users.lock`,
`users.unlock`, `sessions.revoke`, `roles.manage`, and `audit.view`.

Initial role matrix:

| Role | Initial permissions |
| --- | --- |
| `superadmin` | All current and future administrative permissions |

The superadmin role cannot be deleted, its key cannot be changed, and the last
usable superadmin assignment cannot be removed or stripped of
`roles.manage`. Role names are unique case-insensitively; renaming never
changes the stable key or assignments. Permission changes are transactional
and take effect on the next server-side authorization check. Every role,
permission, role assignment, direct user grant, rename, and permission
mutation records the actor, safe before/after values, timestamp, reason, and
privileged-session reference. A direct grant is unique per user/permission,
must reference an active permission key, and can be revoked without changing
the user's roles. Only a superadmin may create roles or change role permissions;
the same authority controls direct user grants. The UI must show inherited role
permissions separately from direct grants. A user may have multiple roles, and
the UI presents their combined effective access without duplicating the user in
separate role-specific views. Control-panel tabs and actions are shown only
when the current effective permissions allow them; unauthorized areas are not
presented as usable controls. Direct grants appear in a separate
**Additional access** section so users can distinguish them from inherited
role permissions. A role such as `marketer` may therefore expose a dedicated
Public site area without exposing user, security, or audit areas.
Destructive UI changes require confirmation and must explain last-superadmin
refusals.

Verification gate: test allow/deny matrices, role changes, privilege
escalation attempts, protected identifiers, and separation between staff and
ordinary user capabilities. Also test role rename stability, permission
assignment/removal, direct grant/revocation, effective-permission calculation,
last-superadmin protection, concurrent edits, audit records, and refusal of
direct client-supplied privilege claims.

#### Phase 5c — Privileged staff sessions and step-up protection

**Status:** Implemented; staging browser verification complete

**Implementation notes:** Staff access requires a separate server-side
privileged session. The ordinary Friink session remains active, but is not
proof of an active control-panel session. The initial step-up uses fresh
authentication for the staff account; the design must allow OTP/MFA to be
added without changing role or ordinary-session semantics. Privileged session
creation, renewal, expiry, and revocation are server-owned and use an opaque
HttpOnly credential or equivalent protected mechanism.

**Test results:** Local compilation and focused Phase 5 tests pass. Staging
privileged step-up succeeded after deployment; the ordinary Friink session
remained active while the protected Control Panel loaded.

**Noteworthy:** Staff-session expiry must not log out ordinary Friink sessions.

Implement separate privileged staff-session state, step-up access, and future
MFA/OTP support. Privileged sessions use 16 minutes of inactivity and an
eight-hour maximum continuous lifetime. Every protected staff request must
validate the privileged session, current staff authorization, and permission.
Expiry, role removal, account lock, password recovery, or explicit staff
logout revokes the privileged session. Expiry locks staff screens only; it
does not log the user out of ordinary Friink.

The control-panel UX distinguishes ordinary-login state from privileged access:
a staff user may see the Control panel entry, encounter a step-up screen, see
the remaining privileged-session state, and return to ordinary Friink without
losing the personal session. Failed step-up attempts are generic, rate-limited,
and audited without passwords or OTPs. The UI provides explicit loading,
denied, expired, and retry states. If staff status, role authority, or the
privileged session is removed while the user is inside the panel, the current
area changes to an access-lost state, protected controls disappear, and the
user can return to ordinary Friink without being logged out.

Verification gate: test step-up success/failure, privileged-session renewal,
16-minute inactivity expiry, eight-hour maximum lifetime, permission changes
while active, explicit privileged logout, account/password-recovery
revocation, ordinary-session continuity, cross-tab behavior, credential
isolation, and secret-free audit events.

#### Phase 5d — Account locking and administrative revocation

**Status:** Implemented; staging browser verification complete

**Implementation notes:** Administrative lock and session-revocation actions
are separate permissioned operations. Locking is distinct from lifecycle
deactivation: an administrative lock prevents new login and refresh while
retaining account data and allowing already-issued short-lived access tokens to
expire normally. Session revocation targets one session or all target sessions
and does not affect unrelated accounts.

**Test results:** Ordinary lock/deactivation separation tests and the existing
API suite pass. Staging Security & Sessions and Audit Log sections rendered for
the verified superadmin; destructive administrative actions remain protected by
the server-side permission and confirmation contracts described above.

**Noteworthy:** This phase must preserve the intentional ordinary-lock
access-token boundary.

Implement account locking and target-session administrative revocation with
clear authorization boundaries, audit events, and self-lockout safeguards.
Lock and unlock require a reason, are idempotent, and must be confirmed in the
UI when destructive. The server must re-check target state and actor permission
inside the write transaction; client-only staff flags, stale role data,
alternate sessions, and direct target identifiers cannot bypass authorization.
A staff user cannot lock or remove their own last usable superadmin access.

The UI presents Lock account, Unlock account, Revoke session, and Revoke all
sessions as distinct actions. It shows the target account using safe public
metadata, explains whether existing access tokens remain valid until expiry,
and never displays passwords, tokens, internal UUIDs, or private identity
history. Bulk revocation requires explicit confirmation and reports only the
server-authoritative result. Staff surfaces must provide intentional loading,
empty, denied, success, and failure states; they must never render a blank
panel when a protected request is unavailable.

Verification gate: test lock/unlock policy, locked login and refresh behavior,
target-session revocation, mass administrative actions, self-lockout
prevention, concurrent actions, stale-token boundaries, audit records, and
recovery paths. Verify that administrative lock is not confused with account
deactivation or ordinary progressive login cooldown.

**Phase 5 rollout boundary:** The implementation and acceptance work for this
release targets staging only. Apply and verify additive migrations, bootstrap,
role/permission changes, privileged-session behavior, and administrative
lock/revocation against staging. Do not connect to, migrate, seed, or mutate
the production database as part of Phase 5 development; production is a later
release gate with separately confirmed credentials and configuration.

### Phase 6 — Operations and incident response

**Status:** Implementation complete; final operational rehearsals pending

**Implementation notes:** Deployment migration gating, security-event plumbing,
per-user/all-account deliberate session invalidation, security epochs, and the
approved deliberate-revocation UX boundary are implemented; key-rotation and
full operational rehearsals remain. The protected operator routes require the
new `AUTH_OPERATIONS_INTERNAL_TOKEN` deployment secret when enabled.

**Test results:** Migration-before-deploy and Phase 3 event/outbox acceptance
checks passed on staging and production.

**Noteworthy:** The phase remains open until the operational rehearsal items
below are completed.

#### Phase 6a — Migration and rollback safeguards

**Status:** Closed

**Implementation notes:** Vercel runs `alembic upgrade head` and blocking
`alembic check` before API build/deploy; migration failure or drift blocks the
release.

**Test results:** Current migration heads were verified on staging and
production.

**Noteworthy:** The coordinated staging rollback/restoration rehearsal is
complete. A compatible mixed-runtime rollback check remains an operational
follow-up.

Implement forward migrations, compatibility windows, rollback procedures, and
startup checks for auth/session schema and configuration changes. Rollback
must not require guessing or manually editing production authentication data.

Verification gate: rehearse forward migration, interrupted migration,
compatible rollback, incompatible rollback detection, and recovery.

#### Phase 6b — Observability and append-only audit protection

**Status:** Closed

**Implementation notes:** Durable security events and retryable outbox state
provide structured security telemetry without exposing prohibited secrets or
internal user UUIDs.

**Test results:** Phase 3 event uniqueness, delivery-state, retry, and recovery
checks passed in staging and production.

**Noteworthy:** Broader operational dashboards and independent audit-storage
hardening remain follow-up work.

Add privacy-preserving metrics, structured operational logs, security alerts,
and append-only audit storage for sensitive account, session, and staff
actions. Never log passwords, raw refresh tokens, OTPs, internal UUIDs, or
other prohibited user-facing identifiers.

Verification gate: inspect representative success/failure telemetry, confirm
redaction, detect missing or duplicated events, and verify audit integrity.

#### Phase 6c — Secret and signing-key rotation

**Status:** Implementation complete; deployment rehearsal pending

**Implementation notes:** Key identifiers, mixed-key verification, and bounded
clock-skew configuration support exist. The remaining work is the complete
rotation automation and deployment-level rehearsal.

**Test results:** Focused token tests verify issuance with the new `kid`,
overlap verification with the previous `kid`, and rejection after the previous
key is retired. A full deployment-level compromise/clock-skew rehearsal has
not been run.

**Noteworthy:** Previous keys require a documented overlap window before
retirement.

Document and automate secret rotation, refresh-token invalidation strategy,
and JWT signing-key rotation with mixed-version verification and clock-safe
overlap windows. Retire old keys only after the documented expiry/safety
window.

Verification gate: rehearse key compromise, old/new `kid` verification,
mixed-version deployment, clock skew, rollback, and safe retirement.

#### Phase 6d — Mass revocation and account lockdown

**Status:** Implementation complete; final partial-failure rehearsal pending

**Implementation notes:** Protected per-user and all-account revocation
operations now revoke refresh sessions and recognized devices, invalidate
issued access tokens through a security epoch, require explicit confirmation,
and record auditable reasons and result counts. Operations require an explicit
idempotency key so a completed retry returns the original result. A dedicated independent-admin
containment operation also disables staff access, locks the account, and
revokes privileged staff sessions. Controlled per-account and platform-wide
staging rehearsals have completed; the final partial-failure/recovery exercise
remains open.

**Test results:** Phase 6 operation tests cover refresh/device/session counts,
idempotent replay, and compromised-admin containment; the full API suite passes
(`126 passed`) and the web production build passes. Migration `20260909_0041`
was applied successfully to the staging database, and the localhost API smoke
test using `.env.staging` returned database health 200. With a temporary local
operations token, the route rejected a missing idempotency key with 400 and an
unknown user with 404. A disposable plus-address account then completed the
local containment flow: signup returned 201, containment returned 200, the
same idempotency key replayed 200 with the original result, and the pre-existing
access token and refresh cookie both returned 401 afterward. The live staging
browser reached the login verification step, confirming the deployed web/API
path is responding; that flow showed OTP is enabled in staging. `alembic check`
reports no schema drift.

Staging E2E evidence: a disposable plus-address account completed the signup
OTP flow and reached the authenticated home page. The protected containment
operation returned 200; refreshing the existing browser session redirected to
`/login?reason=security-revocation` with the approved deliberate-revocation
message. A scoped revoke-all retry returned 200 twice with identical results.
The authorized platform-wide staging rehearsal also completed successfully;
the returned counts were 40 users, 19 sessions, 52 refresh tokens, and 22
recognized devices. The platform-wide request was retried with the same
idempotency key after a network timeout and did not duplicate the operation.

Rollback rehearsal evidence: the staging branch was temporarily reverted from
the Phase 6 documentation head, and both Vercel projects produced Ready preview
deployments. The staging login page rendered during the rollback. The original
head was then restored and both projects again produced Ready deployments.
Chrome blocked the direct staging API health hostname, so this rehearsal does
not claim an API response-body check or a mixed-runtime compatibility result.

**Noteworthy:** Production auth rows must not be manually edited as an
operational workaround.

Provide controlled operations for mass session revocation, account lockdown,
device-recognition invalidation, and compromised-admin containment. Actions
must be authorized, auditable, idempotent, and recoverable without directly
editing authentication rows in production.

Verification gate: rehearse refresh-token compromise, admin compromise, mass
revocation, account lockdown, partial failure, retry, and restoration. The
compromise, containment, mass-revocation, retry, and restoration portions are
covered by the recorded local/staging evidence; only a deliberately injected
mid-operation partial failure with recovery remains to be exercised.

Intentional mass revocation or incident lockdown is surfaced to affected users
through the deliberate-revocation result above; it must not be presented as a
generic network or unexpected error.

#### Phase 6e — Incident runbooks and recovery rehearsal

**Status:** Runbook drafted; rehearsal pending

**Implementation notes:** The initial incident-response runbook is documented
in `docs/auth-incident-response.md`; the end-to-end recovery exercise remains
outstanding.

**Test results:** The runbook boundary was smoke-checked through the staging
configuration: the mounted operations route returned 404 without its dedicated
operator token. No destructive incident exercise has been completed.

**Noteworthy:** Recovery must preserve privacy and the non-negotiable auth
boundaries.

Publish incident runbooks for key compromise, refresh-token compromise,
account takeover, notification abuse, admin compromise, rollback, and user
recovery. Define owners, evidence to capture, decision points, and post-
incident verification while preserving privacy and the non-negotiable rules.

Verification gate: run an end-to-end incident exercise and prove that normal
service can be restored without guessing, bypassing controls, or manually
editing production authentication data.

### Phase 7 — Failed-login-attempt notification

**Status:** Partially closed; staging verification limited by cooldown time

**Implementation notes:** The active-account trigger, privacy boundary,
24-hour suppression, durable event/outbox record, and asynchronous delivery
path are implemented. The login response does not wait for the email provider.

**Test results:** Staging verification passed for the third-failure trigger,
30-minute cooldown, provider acceptance, inbox receipt, and reset-link opening.
The `Invalid credentials.` login copy is accepted product behavior. The phase
is only partially closed because the account's 30-minute cooldown prevented
same-window staging verification of fourth/fifth-attempt duplicate suppression.
Local tests cover that suppression behavior.

**Noteworthy:** This phase remains explicitly separate from ordinary lockout
and from account-lifecycle reactivation behavior.

Add a passive email notification for suspicious activity after repeated failed
login attempts on a normal active account. This is separate from the live,
user-facing progressive cooldown message in section 9.1: the email is sent to
the account owner whether the attempts are from the legitimate owner or from
someone else. It must not change the existing cooldown tiers, generic login
responses, or successful-login reset behavior.

**Lifecycle decision gate:** `docs/account-lifecycle.md` is now the approved
business contract. Failed-login email notifications remain limited to normal
active accounts; deactivated and pending-deletion attempts may create only a
minimal restricted internal security/rate-limit event. Deactivation is a
stronger account-state exception than ordinary locking: all sessions and
refresh families are revoked and already-issued access tokens must be rejected
immediately. Deactivation and deletion require current-password confirmation
plus OTP when the API-owned `OTP_ENABLED` switch is enabled; reactivation
likewise requires fresh OTP only when that switch is enabled. Reactivation
creates only one new session and starts an 8-minute deactivation cooldown,
whose remaining time is shown in a live-updating toast. Runtime work remains
blocked until the lifecycle
document's reset-link, transition-concurrency, abuse-control, deletion-job,
staff-override, and UX/accessibility gates are implemented and verified.

#### Phase 7a — Trigger, suppression, privacy, and account-state decisions

**Status:** Partially closed; duplicate-suppression staging check remains
limited by cooldown time

**Implementation notes:** Trigger at the third consecutive failure, one email
per account per rolling 24 hours, safe reset-link content, and active-account
only handling are implemented. Focused tests cover event/outbox creation and
duplicate suppression.

**Test results:** Focused local Phase 7, lockout, auth-flow, and staff tests
pass (13 tests). Staging verification is still required.

**Noteworthy:** Unknown identifiers and deactivated/pending-deletion accounts
must not create the active-account notification.

The notification trigger is the **third consecutive failed login**, when the
existing 30-minute progressive cooldown begins. This is the earliest reasonable
tier because it notifies the owner promptly while avoiding an email for an
ordinary typo or isolated retry. The fourth-failure one-hour tier and the
fifth-failure 24-hour tier do not create additional notification emails by
themselves.

Send at most one failed-login notification per account in a rolling 24-hour
window. A successful login still resets the progressive failure counter, but it
does not reset the notification window. After the window expires, a later
threshold crossing may send one new notification. Delivery must be idempotent
for concurrent requests, using a durable event/outbox deduplication boundary;
the login response must not wait for an external email provider.

The email is addressed only to the account's registered, on-file email address
resolved from the account record. It must contain safe suspicious-activity
wording and an opaque, single-use, expiring password-reset link. It must not
include an internal UUID, raw token, password, full IP address, precise
location, or other sensitive login detail. Unknown or malformed identifiers do
not produce an email. A delivery failure or bounce for the registered address
must remain an internal, redacted delivery outcome: it must not change the
unauthenticated response, timing, UI, logs, or telemetry in a way that reveals
whether an account exists, and the system must never substitute the
user-supplied identifier as a destination.

This phase applies only after the account is classified as a normal active
account. Deactivated and pending-deletion accounts stay on the distinct
reactivation-modal flow defined by `account-lifecycle.md`; those attempts must
not increment the active-account failed-login notification state, enqueue this
email, or interfere with reactivation behavior.

#### Phase 7b — Delivery and staging evidence gate

**Status:** Implemented; staging trigger and delivery verified; duplicate-
suppression staging check limited by cooldown time

**Implementation notes:** Durable event/outbox delivery, provider failure
handling, idempotent 24-hour suppression, and asynchronous provider delivery
are implemented. The staging trigger, provider acceptance, inbox receipt, and
reset-link opening are verified; only same-window fourth/fifth suppression
remains unexercised in staging because the account enters cooldown.

**Test results:** Local focused suite passes. Staging trigger, provider
acceptance, inbox arrival, and reset-link opening passed on 2026-09-08.
Fourth/fifth duplicate suppression was not tested in staging because the
authorized account was correctly locked during the 30-minute cooldown. This
is a time-limited verification gap, not a known implementation failure; local
tests confirm the suppression logic.

**Noteworthy:** A queued outbox row or source inspection alone cannot close the
gate.

Implement the notification through the durable security-event/outbox path used
for other future email notifications. A provider outage, bounce, or retry
exhaustion is a delivery result, not an authentication failure, and must not
log the user out or turn the login response into an account-existence signal.

Verification gate: staging evidence must show, for a dedicated active test
account, two failed attempts with no notification, the third consecutive
failure starting the 30-minute cooldown, the provider accepting the message,
and the message actually arriving at the account's authorized test inbox with
the password-reset link present. That trigger/delivery trace is recorded.
Fourth and fifth failures must not send duplicate emails within the rolling
24-hour window; this is locally tested but remains unexercised in staging due
to the cooldown. A successful login must reset the progressive counter, and
unknown/malformed identifiers plus deactivated/pending-deletion attempts must
follow their existing privacy/reactivation paths without this notification.
The Phase 7 green flag remains limited only by the cooldown-bound staging
duplicate-suppression check and any separately listed lifecycle gates.

## 3. Non-negotiable rules

1. Passwords are never stored in plaintext or reversible form. Only a strong
   password hash is stored.
2. Refresh tokens are opaque random values. Only their SHA-256 hashes are
   stored in the database; the raw value exists in the HTTP-only cookie and
   request memory only.
3. Internal UUIDs are never user-facing. They must not appear in URLs, normal
   API responses, UI, notifications, logs, or emails. Staff tooling may expose
   them later through a deliberate protected workflow.
4. Email existence is never disclosed during signup, password recovery, or
   similar unauthenticated flows.
5. Username identity is case-insensitive. `@Admin`, `@admin`, and `@ADMIN`
   resolve to the same identity.
6. A username's presentation casing may change without changing the account
   identity. Such a change is still recorded as a username-history event.
7. A username becomes available immediately when its owner changes away from
   it, subject to the reserved-name and account-state rules.
8. Post ownership is based on the immutable user/post identifiers, never on a
   username string.
9. Only explicit logout, session revocation, account security action, or an
   actually invalid/expired refresh session may end an ordinary session.
10. A transient failure must not be interpreted as proof that credentials are
    invalid.
11. Account switching must never trust a client-supplied user ID, email, or
    username as proof of the selected account. The server must validate an
    opaque account slot belonging to the authenticated device/session.
12. Every account-scoped request, token, refresh family, device session slot, security
    event, and notification must remain isolated to its account. Adding an
    account must not merge identities or broaden access to another account's
    private data.
13. Account lists and switch responses may contain only safe display metadata.
    Passwords, OTPs, raw refresh tokens, token hashes, internal UUIDs, and
    device secrets never cross the user-facing boundary.

## 4. Account signup

### 4.1 Username

The signup UI may check availability to provide immediate feedback, but the
API and database remain authoritative for races.

Recommended storage:

- `username_key`: normalized lowercase value with a unique constraint.
- `username_display`: the user's preferred casing for presentation.

The current user-facing handle is rendered from `username_display`; lookup,
uniqueness, login-by-username if added later, mentions, and routing comparisons
use `username_key`.

Creating `FirstNameLastname` therefore stores a key of
`firstnamelastname` and a display value of `FirstNameLastname`. Updating only
the capitalization creates a history record but does not create a new account
identity.

### 4.1a Existing signup requirements

Signup requires a unique email, unique username, password, and date of birth.
The user must be at least 13 years old. Location is optional. Username syntax
allows letters, numbers, hyphens, underscores, and periods, with no spaces.

The system assigns a random immutable internal UUID to every user. It is an
internal database identifier only and is never used as a public URL or normal
user-facing value.

### 4.2 Email

Email uniqueness is case-insensitive after canonical normalization. The API
must enforce uniqueness even if the web availability check is stale.

If an unauthenticated signup is submitted with an email that may already be
associated with an account:

- The UI shows the same neutral response as an ordinary signup.
- The system does not say that the email exists.
- If the address is associated with an account, a security email may say that
  someone attempted to create an account with the recipient's email.
- That email provides Login and Forgot password guidance only.
- It never creates a second account using that email.
- Email sending and OTP requests are rate-limited to prevent abuse.

The future email flow must avoid leaking account existence through timing,
different response bodies, different status codes, or visibly different UI.

### 4.2a Login identifiers

Login accepts an email address or username plus password. Email and username
matching are case-insensitive. A phone number is not a login identifier and is
not collected at signup in this version.

### 4.3 Signup OTP

When email delivery exists, a fresh six-character alphanumeric
email-ownership OTP is required before creating an account. After successful
registration, the system sends the configured registration email. The agreed
OTP contract is:

- Four-minute expiry.
- Single use.
- Stored hashed, never plaintext.
- Five verification attempts per issued OTP.
- Issuing a newer OTP invalidates the older one.
- Successful verification consumes the OTP.
- Excessive requests trigger rate limiting.

Signup should not create a partially usable account before the required email
verification decision is complete.

If signup fails at OTP verification or remains incomplete, the uncompleted
signup reservation does not permanently claim the email. The email can be
used again immediately, subject to rate limits. An already-existing account is
never replaced or duplicated.

The reservation token is a short-lived, single-purpose secret separate from
the OTP. It must expire after 30 minutes, be stored only as a hash, be bound to
the normalized email and signup flow, and be invalidated after completion,
expiry, or deliberate cancellation. A cleanup path must remove expired
reservations and their OTP records. The legacy full-payload signup-start path
must not remain an alternate way to submit password/profile data before the
email-only OTP step; it should be removed or changed to the same contract.

### 4.4 Risk-based login OTP/MFA

Once email delivery or an authenticator mechanism exists, ordinary recognized
password logins should not require an OTP. This preserves the persistent,
low-friction experience expected from a modern social platform.

OTP/MFA is required or offered when the risk policy identifies a new or
suspicious login, and for defined high-risk actions such as password recovery,
email changes, device enrollment, and staff-screen access. A user-enabled
two-factor setting may require OTP for every new login, but it must be an
explicit user/security-policy choice rather than the default.

The normal login flow is:

1. Verify the email or username identifier and password.
2. Apply failed-login and account-lock rules.
3. Evaluate the login risk and challenge with a fresh four-minute OTP/MFA only
   when required.
4. Create the ordinary persistent session after the required checks succeed.

Access-token refresh never requires an OTP. The user is not asked for the
password or OTP again during ordinary use of a recognized session.

### 4.5 Device recognition

“New device” means a login that does not match a previously recognized device
record for that user—not merely a browser-supplied label.

The server creates a device/session recognition record during a successful
login or approved enrollment. Recognition may use a random device identifier
stored in a protected cookie/app storage plus coarse, non-secret signals such
as user-agent family and operating-system family. It must not rely on an IP
address alone, browser fingerprinting alone, or any client-provided claim of
trust.

The device identifier is separate from the refresh token and session ID. It is
rotated or invalidated after suspicious activity, logout-all, account lock, or
security recovery. Missing, deleted, or changed device identifiers cause a
step-up challenge; they do not automatically prove account compromise.

The server remains authoritative: a recognized device may still require
OTP/MFA after an unusual login signal, and a new device may be approved through
the existing-session enrollment flow. Device labels shown in Settings remain
best-effort recognition aids and never expose the identifier itself.

## 5. Email and username changes

### 5.1 Email change

Changing to a new email requires ownership verification through OTP once email
delivery is available:

1. The user authenticates the account and, for sensitive changes, confirms the
   current password or an equivalent step-up challenge.
2. The new email receives a four-minute OTP.
3. The current email remains the account's active email until verification
   succeeds.
4. After successful verification, the new email becomes active and unique.
5. The old email is retained in permanent private history.

An abandoned or failed verification leaves the old email active. A verified
email change creates a security/audit event and should later offer notification
to the old address where policy and delivery support permit.

### 5.2 Username change

Username changes require an authoritative database availability check and a
unique constraint on `username_key`. No email OTP or step-up authentication is
required for a username change.

The old username is released immediately after the transaction succeeds. The
new display casing is stored as the current presentation value, and both old
and new values are retained in username history with timestamps.

This immediate-release rule also applies to high-profile usernames. Released
usernames have no cooldown period.

### 5.3 Identity history tables

Use dedicated history tables rather than overwriting the audit trail:

- `user_email_history`: user UUID, normalized email value or protected form,
  event type, timestamp, and actor/session reference.
- `user_username_history`: user UUID, normalized key, display casing, event
  type, timestamp, and actor/session reference.

History is retained permanently as requested. It is not returned to ordinary
users, is not used to make a released username resolve to its former owner,
and must be protected as sensitive account data. Email history should have
stricter access controls than username history.

## 6. Reserved usernames

Reserved names belong in a database table so the list can grow without code
changes. Matching is case-insensitive.

Initial reserved values:

- `admin`
- `staff`
- `media`
- `support`
- `security`

The table should support a reason, active/reserved state, creation timestamp,
and optional staff note. Reserved names are rejected during both signup and
username changes. The database/API must enforce the rule; the frontend check
is only explanatory.

The list can later include impersonation-sensitive brand names, system names,
or other names that are permanently unsuitable for user accounts. A released
high-profile username is not temporarily protected by this registry.

## 7. URLs, post identity, and username reuse

Profile URLs are username-based. If a username is released and claimed by a
different user, the profile URL naturally belongs to the new owner; it cannot
continue to identify the previous owner safely.

Post URLs use an immutable public post ID, with the username and content slug
as cosmetic URL segments. The post ID is authoritative. Therefore:

- An old post link remains resolvable after a username change.
- The route fetches the post by immutable public ID.
- If the username or slug is stale, the route redirects to the current
  canonical URL.
- The post remains owned by the original user UUID.
- A new user who claims the old username does not inherit posts, followers,
  messages, mentions, or history.
- Historical text such as an old `@username` mention remains historical text;
  it must not silently become a mention of the new owner.

This preserves the existing Friink public-ID URL contract documented in
`RULES.md`.

## 8. Ordinary sessions

### 8.1 User experience

Friink should behave like a modern social platform:

- No `Keep me logged in` checkbox.
- A successful login creates a persistent session by default.
- Users remain logged in across ordinary deployments, VPN use, temporary
  platform blocking, network errors, and recoverable API failures.
- Explicit Logout ends the current session.
- Settings shows active sessions and permits ending other sessions.

The exact internal lifetime should not be presented as a user-facing promise.
Use a sliding idle policy:

- Target idle expiry: 30 days without successful session activity.
- Login and refresh extend the idle window.
- A session has a 180-day absolute maximum lifetime from session creation;
  refresh cannot extend beyond that boundary.
- Session revocation, explicit logout, account lock, or a confirmed security
  action ends it immediately.
- Access-token expiry alone does not log the user out; it triggers refresh.

This is an implementation target rather than a claim about any specific
third-party platform's private expiry policy.

### 8.2 Session identity

One refresh-token family represents one account-specific user-visible session:

- Separate browsers are separate sessions.
- Separate browser profiles are separate sessions.
- Logging in again creates a new session.
- Refresh rotation within one family does not create a new visible session.
- A device may hold multiple account-specific sessions after multiple-account
  support is enabled; one account is active at a time.
- The active account is selected through a server-validated opaque account
  slot, not a client-supplied user ID or username.

The server determines the current account/session from the presented
account-specific refresh credential and its device-scoped session slot. The web
client never supplies a session ID or user ID to claim that it is
current.

### 8.3 Current implementation to preserve

The repository already has the main server-side foundation:

- `refresh_tokens` stores hashed opaque refresh values.
- Refresh rotates tokens and locks the presented row transactionally.
- Reuse of a dead token revokes its family.
- `auth_sessions` groups token families for user-visible session management.
- Access tokens are short-lived JWTs with keyed verification support.
- The frontend refreshes reactively after `401 TOKEN_EXPIRED`, retries once,
  and coordinates refreshes across tabs.

Future work must preserve the authoritative reactive-only model in `RULES.md`.
It must not reintroduce proactive refresh, logout on ambiguous refresh failures,
or cross-environment mutation fallback. Multiple-account support is an
additive extension: existing one-account sessions remain valid, and the
single-account path remains the fallback until an account is explicitly added
to a device.

### 8.4 Terminal and ambiguous refresh failures

The frontend must not treat every possible server failure as proof that the
user's session is invalid. The refresh response contract should classify
outcomes into:

- **Terminal:** the server confirms that the refresh session is missing,
  expired, revoked, reused, or otherwise invalid. Local auth may be cleared.
- **Ambiguous/recoverable:** timeout, network/CORS failure, 5xx, deployment or
  configuration failure, malformed unexpected response, or another condition
  that does not prove the session is invalid. Local auth remains stored and the
  user remains in the app where possible.

Deliberate security actions are a separate terminal outcome. When an operator
or incident-response operation intentionally revokes the user's sessions, the
API must return a machine-readable deliberate-revocation result that the web
client can distinguish from ordinary expiry. The client then clears the
affected local session and routes to the normal login screen with:

> For your security, your session ended. Please sign in again.

The normal confirmed-expiry or invalid-session path continues to use the
generic session-expired/login experience. Ambiguous failures continue to
preserve local auth and remain retryable. Neither path exposes internal
incident details, revocation scope, account identifiers, or operator actions.

The API should use appropriate status/code combinations so a deployment or
configuration problem is not mislabeled as an invalid refresh session. The web
client should clear local state only for an explicitly recognized terminal
refresh result, not merely because an arbitrary refresh response has status
401. This protects the intended UX: users are asked to log in again only when
their session is actually no longer usable.

## 8.5 Multiple logged-in accounts and account switching

Multiple-account support is a confirmed web product requirement. Each account
is a fully independent Friink identity: there is no
account-to-account linking, shared identity record, merged profile, shared
security state, or cross-account data access. The device-level records below
exist only to remember separate authenticated sessions for the switcher; they
are not social, ownership, or identity relationships between accounts.

The UI contract is fixed; the storage and API contract below is the technical
implementation target. It extends the existing account/session model without
changing password hashing, signup OTP validation, access-token claims, or
refresh-token rotation semantics.

### 8.5.1 User flow

1. After a successful login, the side drawer includes `Add account`.
2. Selecting `Add account` opens a modal that renders the login-page fields and
   buttons using the Friink app design system.
3. The modal supports both login and signup. Signup uses the approved email →
   OTP → password → profile flow and shows the OTP screen immediately after
   the email step.
4. After login or signup succeeds, the authenticated account is registered as
   an available independent account session for the current browser profile.
   The newly authenticated account becomes active.
5. `Change account` is hidden until at least two accounts have successfully
   authenticated on that browser profile.
6. `Change account` lists only accounts registered on that device and switches
   to the selected account without merging identities.
7. The switcher supports up to the server-configured
   `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` value, defaulting to four. When the
   limit is reached, `Add account` explains that the user must remove one
   account before adding another; it never silently replaces an existing
   account.
8. When the active account logs out and other accounts remain, the most
   recently used remaining account becomes active. If none remain, the user
   returns to the signed-out login screen.

The modal reuses the primary login/signup validation, loading, error, OTP,
session, accessibility, and recovery behavior. Add-account failure must not
log out or replace the currently active account. A canceled or abandoned
add-account flow must not create a device session slot or partially usable
account.

### 8.5.2 Independent accounts and device session slots

Add a device-scoped account session-slot record, or an equivalent server-side
record, for each independently authenticated account, with at least:

- internal account/user UUID
- server-managed device or installation identifier, stored as a protected
  hash or equivalent non-displayable value
- random opaque account-slot identifier (or a server-side mapping to one)
- the account-specific `auth_session`/refresh-token family reference
- created-at, last-used-at, and revoked-at timestamps
- optional safe display metadata reference, such as avatar and username

The account-switcher summary contains only the opaque slot, display name,
username, avatar, active state, availability state, and last-used timestamp.
Email addresses are not shown in the switcher by default.

The account slot is an opaque capability reference, not an account ID. It is
generated by the server, scoped to one account's device session, and invalid
after removal or revocation. The same physical device may have separate slots
for multiple independent accounts; the slots do not link those accounts to
each other. Device recognition and security events remain account-specific.

The existing `auth_sessions` and `refresh_tokens` remain the authority for
session validity. Multiple-account support permits multiple valid
account-specific session families on one device; it does not combine them into
one refresh family, one user identity, or one database account relationship.

### 8.5.3 Web credential boundary

The web client keeps only the short-lived access token for the active account
in memory, plus safe account summaries needed to render the switcher. It must
not store refresh tokens, token hashes, passwords, OTPs, internal UUIDs, or
device secrets in JavaScript-readable storage.

The web implementation will use one server-managed HTTP-only, Secure refresh
credential per account slot, with cookie names in the form
`friink_refresh_<opaque_slot>`. The active slot is a safe opaque value held in
the current tab's auth state and sent with refresh/switch requests; the server
validates it against the protected device session record before selecting the
matching cookie. The browser may send several refresh cookies, but the API
must process only the validated active slot.

The account-slot cookies are host-only API cookies with `Path=/`; deployed
HTTPS uses `Secure` and the cross-origin web/API contract uses the documented
`SameSite` setting. Cookie deletion must target the exact slot cookie. Refresh
coordination keys and BroadcastChannel messages are slot-scoped so one tab's
Account A refresh cannot update Account B. The active slot itself is not an
account ID, username, or credential and must not be trusted without server
validation. Refresh credentials must never move into `localStorage`,
IndexedDB, ordinary non-HttpOnly cookies, or client-visible account objects.

### 8.5.4 API behavior

The implementation may use equivalent route names, but it must provide these
server-authoritative operations:

- `GET /auth/accounts`: return safe summaries for non-revoked account session
  slots on the current device, ordered by last used; never return UUIDs,
  tokens, or secrets. The server enforces the validated
  `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` value.
- Existing login and signup endpoints: after successful authentication,
  create or restore only that account's device-scoped session slot and return
  the active account's normal access context. The primary and add-account
  flows use the same endpoints and security checks; they never link identities.
- `POST /auth/accounts/switch`: accept only an opaque account-slot reference;
  verify the current device/session and slot state; then issue or activate the
  selected account's normal short-lived access context.
- `DELETE /auth/accounts/{slot}`: remove the account from this device and
  revoke that account's device-specific session slot. This is not the same as
  global account deletion and does not revoke unrelated sessions on other
  devices or touch another independent account.
- Existing logout and Settings session controls: `Log out` of the active
  account revokes and removes only its current device session slot; `Log out
  all other sessions` revokes that account's other sessions. Neither action
  silently revokes another remembered independent account.

All operations must enforce account ownership server-side, be idempotent where
retries are expected, and return the existing terminal-versus-ambiguous
failure classes. A network or CORS failure during add, switch, or removal must
not clear the previously active account unless the server confirmed a terminal
result. Adding an account that already has a non-revoked slot must focus or
activate that existing slot rather than create a duplicate. A revoked or
expired slot is shown as unavailable with clear re-authenticate/remove actions
and must not affect other accounts.

`MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` is server-only configuration. It defaults
to `4` and must be validated at startup as an integer between `1` and `16`.
The browser client must not provide or override it. If an operator
lowers the value below the number of existing slots, existing sessions remain
usable and no account is silently removed; new additions are blocked until the
device is under the configured limit.

### 8.5.5 Isolation, notifications, and session management

Every request after switching is authorized against the selected account's
access token and server-side session context. Caches, query keys, optimistic
state, uploads, notifications, drafts, and analytics must be partitioned by
account; switching must clear or replace account-scoped client state before
rendering the new account.

Each successful add-account login creates the normal account-specific login
security event and notification. Switching an already authenticated account
does not create a new-login event. Suspicious login, OTP, lockout, revocation,
and device-enrollment records are always attached to the correct account and
session.

Settings session management remains account-scoped. A user viewing Account A
can manage Account A's sessions; remembered Account B sessions are not exposed
as if they were Account A sessions. Removing an account from the device
revokes only that independent account's device session while global “log out all” remains
an account-level action unless an explicit cross-account action is designed.

### 8.5.6 Compatibility and rollout

The feature requires an additive migration and a backward-compatible rollout:

1. Add the device-scoped account-session-slot data model without invalidating existing
   refresh/session rows.
2. Deploy server support that continues to accept the current one-account
cookie/session path and creates a device session slot after the next successful
   login or explicit account addition.
3. Deploy the web account list, modal, switch, removal, and isolated client-state
   behavior behind a controlled feature flag if needed.
4. Verify single-account login, refresh, logout, OTP, session management, and
   failure recovery before enabling multiple accounts broadly.
5. Enable the feature gradually and monitor account-scoped session, switch,
   revocation, and cross-account isolation failures.

Existing users must not be forced to log in again solely because the new tables
or account-switching UI are deployed. Existing account/session rows are
associated with a device session slot only through a deliberate migration or
the next authenticated request, with the same server-side ownership checks as
a fresh authentication. This operational association must never create an
account-to-account relationship.

### 8.5.7 Impact on already implemented auth/session

The low-impact portion is additive: password hashing, signup email/OTP
verification, login risk checks, JWT verification, refresh rotation, and
terminal-versus-ambiguous error classification remain shared.

The higher-impact changes are in client auth state and session selection:
account-aware refresh credentials, the active-account boundary, account-scoped
cache/state reset, and switch/add/remove UI. Session inventory, device
recognition, login notifications, logout, and revocation gain an account-slot
dimension but retain their existing security rules. The rollout must preserve
the current one-account path and must not invalidate existing sessions merely
because multi-account support is introduced.

Final identity decision: the existing unique-email-per-account rule is
permanent and applies across multiple independent accounts. The same email
address may never be associated with more than one Friink account, including
under multi-account support. Independent accounts do not change this
uniqueness boundary.

## 9. Session management UI and behavior

Settings > Account lists active sessions using safe fields:

- device label
- browser
- operating system
- logged-in time
- last-active time
- current-session indicator

Session management is account-scoped. In a multi-account device, the Account
page shows sessions for the currently active account only; the side-drawer
account switcher is the separate mechanism for moving to another remembered
account. A remembered account may have its own current device session without
being presented as a session belonging to the active account.

The current session has no revoke action in its row. Other sessions can be
revoked individually or through a confirmed `Log out all other sessions`
action. Repeated revoke requests are idempotent.

### 9.1 User-facing lockout messaging

User-facing messaging must distinguish a full account lock from a temporary
progressive rate-limit cooldown:

- **Full account lock (administrative or security-triggered):** show exactly
  `Your account is locked. Contact support.` Do not show a reason, duration,
  retry time, or other account-security detail.
- **Temporary progressive cooldown:** show a distinct message such as `Too many
  sign-in attempts. Try again in about 1 minute.` Use the server-provided
  remaining time for the one-minute, five-minute, or fifteen-minute tier. This
  message is not the full-account-lock message and must never be conflated
  with it. See `docs/failed-login-policy.md` for the complete behavior.

The side-drawer `Log out` action is different from `Log out all other
sessions`: it ends and removes only the active account's current device session
slot. It does not sign out other remembered accounts. Removing another account
from the switcher ends that account's device session slot without affecting
the active account or unrelated sessions. Removing the active account requires
confirmation and leaves the device signed in only to the remaining accounts.

Revoking a session:

- Marks its session and refresh family unusable.
- Prevents future refresh from that session.
- Retains history for audit and display rules.
- Does not delete posts or account data.
- Does not invalidate an already-issued access JWT before its normal short
  expiry.

Removing an account from the device revokes that account's device session slot
and removes it from the local account list. It does not delete the
account, revoke unrelated sessions, or remove another remembered account.

Raw tokens, token hashes, UUIDs, IP addresses, and full user-agent strings are
not shown to normal users.

## 10. Passwords and password changes

Password handling must use the existing secure password service and a slow,
adaptive password hash such as bcrypt or Argon2id. Passwords must never be
logged, emailed, recoverable in plaintext, or stored with reversible
encryption.

The password-change UX will be revised to:

1. Ask for the current password.
2. After successful verification, open a modal for the new password and
   confirmation.
3. Apply the same password policy used by signup.
4. Keep the current session active after success.
5. Show the user's sessions on the same Account page.
6. Offer a user-controlled `Log out all other sessions` action and individual
   session revocation.

Password changes create a security event. Future high-risk recovery or
compromise handling may revoke all sessions, but an ordinary password change
does not silently end every session.

### 10.1 Access-token storage

The preferred web implementation keeps only the short-lived access token for
the active account in memory and uses the account-specific HTTP-only refresh
credential for session recovery. Safe account summaries may be retained for
rendering the switcher, but account secrets must not be persisted in
`localStorage`, IndexedDB, ordinary cookies, or other JavaScript-readable
storage. The refresh token itself must never be readable by JavaScript.

When switching accounts, replace the active in-memory access context and
partition or clear account-scoped client state before rendering the selected
account. A refresh failure for the selected account must not erase other
remembered account session slots or incorrectly log out the previously active account.

### 10.2 Password recovery

Password recovery is part of the account lifecycle and uses the same privacy
protections as signup, but uses an email reset link rather than an OTP:

The complete password-recovery UX, email copy, reset-page states, and reset-link
contract live in [`docs/forget-password.md`](forget-password.md). This section
defines only the auth/session boundary and must not diverge from that document.

1. An unauthenticated request accepts an email and always returns the same
   neutral response, whether or not an account exists.
2. If appropriate, the account receives a cryptographically random,
   single-use password-reset link by email. Store only its hash, expire it
   after 30 minutes, invalidate older reset requests when a newer one is
   issued, and rate-limit by IP, email, and device.
3. The user sets a new password using the standard minimum-8-character policy.
4. Successful recovery revokes every existing refresh-token family for that
   account, invalidates remembered device session slots, and requires a fresh
   login. A reset-specific security event remains a separate tracked recovery
   hardening item; the current flow's session revocation is implemented.
   Already-issued access tokens may remain valid only until their documented
   short expiry.

Recovery must not reveal whether an email exists. Reset tokens must not appear
in logs, analytics payloads, or support screenshots; the reset URL is the
intended one-time browser delivery mechanism.

The shared reset-link and reset-page UX contract is defined in
[`docs/forget-password.md`](forget-password.md); Phase 7 reuses that service
without changing the ordinary user-requested reset flow.

### 10.3 CSRF protection

Credentialed cookie requests must include explicit CSRF protection for
state-changing endpoints. Friink will use exact allowed-`Origin` validation as
the baseline and a CSRF token for state-changing requests that use a refresh
cookie. CORS and `SameSite` are defense-in-depth, not the sole protection.
The implementation must be tested for cross-site state-changing requests and
legitimate staging/production requests.

## 11. Login security notifications

Every successful login creates an in-app security notification. Token refreshes
do not create login notifications.

The notification should contain safe recognition details such as browser,
operating-system family, and local date/time. It must not expose full IP
addresses, precise location, raw tokens, or secrets.

The same login event is designed for future email notification delivery.

The login path must not depend synchronously on an external email provider. A
durable security-event/outbox design is required:

1. Complete and commit the authentication/session decision independently of
   the audit side effect.
2. Attempt the security event and process the in-app notification/future email
   delivery from the durable event when the audit write succeeds.
3. Isolate every audit-write failure from the primary authentication response:
   record the failure loudly in application logs/error tracking, but do not
   re-raise it, roll back the auth/session decision, or change its response.
4. Use stable event keys with idempotent insertion so concurrent retries do not
   create duplicate events. After either an insert or a conflict, retrieve the
   event by its unique event key rather than relying on a client-generated ID.

This prevents a non-critical audit or notification failure from turning a valid
login, refresh, or terminal auth response into a server error. Audit failures
remain observable and should be investigated or retried through the applicable
operational path.

## 12. OTP and new-device enrollment

Once OTP delivery exists, a new device starts ordinary login with the account
identifier and password. For a new-device login, the system creates one
short-lived verification request, emails one OTP, and notifies existing signed-
in sessions with an Approve/Deny prompt. The user completes either path:

1. Enter the emailed OTP on the new device within four minutes; or
2. Approve the clearly identified request from an existing signed-in session.

The two paths are alternatives. No password, OTP, or risk check is repeated
after one path succeeds. Enrollment OTPs are single-use, stored hashed,
attempt-limited, rate-limited, and bound to the user, login, intended device,
and enrollment action. Issuing a new code invalidates the previous one.
Revoking the existing session, denying the request, account lock, or lifecycle
transition invalidates pending requests. The existing session shows only
coarse device details and never displays the plaintext email OTP.

## 13. Staff, roles, and superadmin

Staff are ordinary Friink users with additional role/permission records. They
retain standard user features.

### 13.1 Superadmin

`@admin` and `admin@friink.com` are reserved superadmin identity values. The
superadmin has absolute platform authority, subject to an immutable audit
trail.

The initial account should be created through a controlled bootstrap command or
deployment process:

- No password in source code, migration files, or committed configuration.
- Interactive password entry or an approved secret-injection mechanism.
- Password is passed through the normal password-hashing service.
- Refuse to overwrite an existing superadmin.
- Reserve the username and email before bootstrap.
- Keep future recovery as a protected server/deployment-level process.

The data model should remain flexible enough to support future MFA for the
superadmin. MFA cannot be enforced until a delivery/authenticator mechanism
exists, but the privileged-session boundary should be designed now.

### 13.2 Roles and permissions

Do not grant every staff member every capability. Use role and permission
records so, for example, a content/SEO staff member can edit landing content
without receiving moderation or account-security powers.

The initial permission model should support at least:

- access to staff screens
- manage users/accounts
- revoke user sessions
- lock/unlock user accounts
- manage roles and permissions
- view security/audit events

The only seeded role is `superadmin`; additional roles are created as the
product needs them. Permission keys are `staff.access`, `users.view`,
`users.lock`, `users.unlock`, `sessions.revoke`, `roles.manage`, and `audit.view`.
Role display names may be changed by a superadmin, but stable role keys and
permission keys do not change.
The initial release also supports additive direct user grants through a
deduplicated `user_permission_grants` table. Grants never bypass server-side
authorization, cannot create new permission keys, and are visible in the staff
access review UI.

### 13.3 Privileged staff sessions

Entering staff screens requires a fresh staff step-up. OTP/MFA is the future
stronger step-up mechanism once delivery or an authenticator is available.
The privileged session should have:

- 16 minutes of inactivity before re-authentication.
- Eight hours maximum continuous lifetime.
- Independent expiry from the ordinary Friink session.
- Re-authentication for especially sensitive actions where appropriate.

When the privileged session expires, staff screens lock again; the user remains
logged into ordinary Friink and can continue using personal features.

## 14. Account locking and administrative session control

Authorized staff should be able to perform these as separate permissioned
actions:

- lock or unlock an account
- revoke one target session
- revoke all target sessions

The UI should not combine all actions into one irreversible button. Each action
should explain its effect and require confirmation when destructive.

Account locking should be capable of:

- preventing new login
- preventing refresh from existing sessions
- allowing already-issued short-lived access tokens to remain valid until
  normal expiry
- retaining all account content and history

Account locking and administrative session revocation do not immediately
invalidate already-issued access JWTs. They block login and refresh only; no
revocation or token-version check is added for this case.

## 15. Audit and security events

Create durable security/audit events for at least:

- successful login
- failed-login lockout
- password change
- email change request and completion
- username change
- session creation
- session logout/revocation
- refresh-token reuse detection
- device enrollment
- account lock/unlock
- staff session elevation and expiry
- staff session revocation of another user
- role or permission changes

Each event should record the actor/user, event type, timestamp, relevant safe
session reference, and outcome. Staff actions additionally record target user,
reason, and the originating privileged session. Never record passwords, raw
OTP values, raw refresh tokens, or full secret material.

Audit writes are side effects, not part of the auth/session decision boundary.
The shared security-event recording path uses stable event-key idempotency and
must be fault-isolated at every auth-critical call site, including login,
refresh/reuse detection, bootstrap, logout, failed-login tracking, and staff
actions. Any insert, duplicate-resolution lookup, assertion, connection, or
other audit exception is logged loudly and swallowed so the endpoint still
returns its correct authentication response and its token/session transaction
cannot be rolled back by audit logging.

## 16. Rate limits

Initial limits:

| Operation | Limit |
|---|---|
| Signup attempts by IP | 5 per hour |
| Signup attempts for one email | 3 per hour |
| OTP sends to one email | 3 per hour, 10 per day |
| OTP verification attempts | 5 per issued OTP |
| Login failures | 3 failures → 30 minutes; 4th → 1 hour; 5th → 24 hours |
| Password-reset requests | 3 per email per hour |

Rate limits should use multiple dimensions where practical, such as IP,
normalized email, account, and device/session. The progressive login policy is
configurable and may be strengthened later. A successful login resets the
progressive failure state. Responses should remain generic in unauthenticated
flows and should not reveal which limiter was triggered in a way that leaks
account existence. Account lockout must not be the only defense: independent
IP/device throttling must reduce the ability to deliberately lock another
user's account.

## 17. Technical boundaries and likely schema work

The existing implementation uses FastAPI, synchronous SQLAlchemy/psycopg3,
PostgreSQL/Neon, Alembic, PyJWT access tokens, HTTP-only cookies, and the web
auth client described in `RULES.md`. Future implementation should remain on
that stack.

Likely additive schema areas:

- username display/key separation or equivalent canonical identity fields
- email and username history tables
- reserved usernames table
- security events/outbox table
- OTP/device-enrollment records
- device-scoped account session slots with opaque identifiers and
  account-specific session references
- staff roles, permissions, and user-role assignments
- additive per-user permission grants
- account lock state and administrative audit fields
- optional MFA/privileged-session records

All schema changes must use additive Alembic migrations and be verified against
the intended database before deployment. Existing refresh/session rows must not
be invalidated merely because these tables are added.

## 18. Limitations and risks

### Username impersonation after reuse

Immediate username reuse means old profile URLs can point to a new user. This
is inherent to username URLs. Immutable post IDs, clear current-author
rendering, history/audit records, and reserved names reduce confusion but
cannot make an old profile URL identify its former owner. Released usernames,
including high-profile usernames, become available immediately with no
cooldown.

### Already-issued access tokens

Account locking and administrative session revocation block new login and
future refresh only. A previously issued short-lived access token remains valid
until its normal expiry. No revocation or token-version check is added for this
case.

### Cookie and deployment configuration

Persistent sessions depend on correct HTTP-only cookie, Secure, SameSite, CORS,
frontend-origin, and API-origin configuration. A deployment that changes the
JWT secret, cookie behavior, domain, or environment incorrectly can appear to
users as a mass logout. Deployment verification is part of the feature.

Multiple-account support adds an account-slot selection boundary. Every
account-specific refresh credential must remain HttpOnly and server-validated;
the active slot must not be a raw user ID or an untrusted client-only claim.
Cookie collision, path, domain, and `SameSite` behavior must be tested with
two authenticated accounts in the same browser profile, including reload,
logout, switch, and concurrent refresh. A change that makes one account's
refresh cookie overwrite or select another account's session is a release
blocker.

The implementation must not rely on a browser session cookie or on server-side
expiry alone. The deployed API must issue an explicit persistent refresh cookie
with a `Max-Age` covering the agreed session policy, together with the required
`HttpOnly`, `Secure`, `SameSite`, and `Path` attributes. Domain behavior must be
intentional: a host-only cookie for the API host is acceptable when the browser
only needs to send it to the API; a parent-domain cookie must not be added for
convenience without a documented security reason.

The staging web/API origins must be tested as the active implementation
environment: `https://staging.friink.com` and
`https://staging-api.friink.com`. A successful authenticated request must
demonstrate that the browser sends the refresh cookie cross-origin, and the API
must return the exact configured staging web origin—not `*`—with
`Access-Control-Allow-Credentials: true`. Production verification is deferred
to the permanent production infrastructure.

### Cross-tab refresh races

The frontend coordinates normal browser refreshes, but server-side row locking
remains the authority when requests race outside that coordination. A replay of
a dead token revokes its family by design. Client retries must reliably consume
the replacement cookie.

### JWT key rotation and clock skew

During `kid` rotation, a still-valid access token can be rejected if a serving
instance does not yet have the key identified by its `kid`. The rollout must
therefore add the new verification key before issuing tokens with it, retain
the previous key for at least the maximum access-token lifetime plus a safety
window, and verify that mixed instances accept both generations during the
rollout. Server clocks must use synchronized UTC time; otherwise a valid token
may be rejected early at its `exp` boundary. The implementation must define
a small, deliberate clock-skew policy rather than silently relying on machine
clock coincidence.

### Duplicate login requests

The login endpoint must define its behavior when the same browser submits
credentials twice in quick succession. The preferred MVP behavior is to allow
each successful login to create a separate session, because each represents a
real authentication event, while the frontend prevents accidental duplicate
activation during one submit. If request idempotency is later added, it must not
reuse a session across distinct devices or browser contexts.

Regardless of the chosen UX, every `Set-Cookie` emitted by a successful login
must correspond to a committed server-side refresh-token row. A race may leave
two valid sessions, but it must never leave a browser holding a cookie whose
token was not committed or whose family was immediately revoked by another
legitimate login.

### Notification delivery

In-app notifications require database writes; future email requires an external
provider. Durable events and retry handling prevent delivery outages from
destroying login reliability or losing security records.

### OTP abuse and phishing

Short expiry alone is insufficient. OTPs require hashing, single use, attempt
limits, rate limits, clear device/action context, and anti-phishing UX. Staff
OTP/MFA needs stronger recovery and audit rules than ordinary enrollment.

### Device recognition

Browser and operating-system labels are approximate and can be spoofed. They
are recognition aids, not proof of identity or precise location.

### Permanent history

Permanent email history increases privacy and breach impact. It must be access
controlled, excluded from ordinary responses, and protected more strictly than
normal profile data.

## 19. Verification and rollout requirements

Before implementation is considered complete, verify at minimum:

- signup behavior is identical for existing and non-existing email addresses
- username uniqueness and case-insensitive display updates
- email-change verification and failed/expired OTP behavior
- username release and post-ID canonical redirects
- login, refresh, logout, and refresh-token reuse detection
- persistence through ordinary deploy/restart, VPN, network failure, and API
  recovery scenarios
- two browsers/devices appearing as separate sessions
- Add account login and signup, including the email → OTP → password/profile
  sequence inside the modal
- account list privacy, opaque-slot validation, successful/failed switching,
  account removal, and Change account visibility at one versus two accounts
- two authenticated accounts in one browser profile, including reload,
  concurrent refresh, and active-account state/cache isolation
- current-session detection and selective session revocation
- revoke-others preserving the current session
- login notification creation and durable retry behavior
- password change preserving the current session
- device enrollment OTP expiry, replay, and revocation
- role/permission enforcement for staff screens and actions
- privileged 16-minute idle and eight-hour absolute timeout
- account locking and target-session revocation
- audit records without secrets or raw identifiers
- 180-day absolute session expiry in addition to the 30-day idle expiry
- password-recovery privacy, single-use reset behavior, session revocation, and
  fresh-login requirement
- migration state and at least one real request/response check for each new
  endpoint

### Mandatory auth/session evidence

The implementation is not complete until the following evidence is recorded.
Source inspection or compilation alone is insufficient.

#### Cookie and cross-origin browser contract

For staging, capture the complete response headers from a successful login with
the token value redacted but the attributes preserved. The required staging
pair is `https://staging.friink.com` and
`https://staging-api.friink.com`; production evidence is a separate
pre-release gate and is intentionally deferred.
The evidence must show:

- cookie name `friink_refresh_token`
- explicit persistent-cookie behavior
- `Max-Age` covering the configured session policy
- `Path=/`
- `HttpOnly`
- `Secure` in deployed HTTPS environments
- intentional `SameSite` behavior
- intentional domain/host-only behavior

When multiple-account support is enabled, also capture the account-slot cookie
or equivalent HttpOnly selection mechanism with its value redacted. Evidence
must show that two account-specific refresh credentials do not collide, that a
switch changes only the active account context, and that removing one account
does not revoke or expose the other account's device session slot. No raw account ID,
UUID, refresh token, or token hash may appear in the response, browser storage,
or account-list payload.

Also capture credentialed CORS preflight and authenticated request evidence for
the staging web/API pair showing the exact `Access-Control-Allow-Origin`,
`Access-Control-Allow-Credentials`, and `Vary` values. Verify in a real browser
that the refresh cookie is sent to `/auth/refresh` and that the replacement
cookie is accepted after rotation.

#### Frontend failure classification

Record the literal frontend conditional that decides to refresh and retry after
an expired access token, and the literal conditional that clears local auth.
Verify with focused tests or controlled browser/network traces that:

1. `401 TOKEN_EXPIRED` on an authenticated request refreshes once and retries
   the original request once.
2. A refresh response with a recognized terminal session code clears local auth.
3. Refresh timeout, network failure, CORS rejection, 5xx, malformed response,
   and configuration failure do not clear local auth.
4. A non-expiry access-token `401` does not enter the expiry retry branch.
5. The retry request still includes the bearer token and
   `credentials: include`.

The evidence must identify the exact response status/code for every case; a
generic “request failed” result is not sufficient.

#### API privacy and signup compatibility evidence

Inspect the actual JSON schemas and representative responses for login, signup,
refresh, current-user, public-user, account-list, and session-management
endpoints. Normal responses must not expose internal database UUIDs, date of
birth, location, raw tokens, token hashes, or other private fields beyond the
documented safe account summary. Session-management and account-switching
references must use opaque public handles.

With email OTP enabled, verify that every reachable signup path follows
email-only start → OTP verification → password/profile submission. The legacy
full-payload signup-start path must be removed or closed to prevent a bypass.
Verify reservation-token expiry at 30 minutes, cancellation cleanup, expired
reservation cleanup, and that an abandoned reservation releases the email.

### Existing email during signup — resolved UX exception

The product intentionally makes one limited exception to the generic signup
response rule above. When a person submits an email that already belongs to a
Friink account, the email-only signup start returns a successful, non-OTP
response with no reservation and sends no email. The web flow remains on the
email step and presents calm copy explaining that the address is already in
use, with an action to log in using that email and an invitation to use a
different address for signup. It must never show an OTP screen for this case.

This is an explicit UX decision: it trades strict account-enumeration privacy
for a clear recovery path and avoids sending a misleading verification email.
The message must not expose lifecycle, security, or other private account
details, and the API response must not include user records or identifiers.

#### Key rotation and time evidence

Perform a controlled key-rotation check using at least two configured `kid`
values:

1. Issue a token with the old key and verify it.
2. Add the new key while retaining the old key and verify both tokens.
3. Switch issuance to the new `kid` and verify new tokens use it.
4. Exercise a mixed-version verifier or equivalent deployment simulation and
   confirm no valid token is rejected during the supported overlap window.
5. Remove the old key only after the documented expiry/safety window and
   confirm old tokens then fail as intended.

Test expiry at the boundary with synchronized and deliberately offset test
clocks. Record whether the system applies an explicit skew allowance and
confirm the frontend does not convert a rotation/configuration failure into an
unexplained logout.

#### Login race evidence

Send two successful login requests for the same account concurrently or in
immediate succession using separate request traces. Record:

- number of response cookies
- number of created sessions and refresh-token families
- whether every returned cookie maps to a committed active row
- which cookie a real browser retains when responses arrive in either order
- whether the retained cookie refreshes successfully
- whether any legitimate login unexpectedly revokes another login's family

The result must be documented as either the intentional “two valid sessions”
MVP behavior or an explicitly implemented idempotent behavior. Do not describe
the result as idempotent unless duplicate requests have been tested.

Deployment should preserve `JWT_SECRET_KEY` unless an intentional key rotation
is planned, and should confirm cookie, CORS, frontend-origin, and database
configuration in each environment.

## 20. Relationship to existing documents

- `RULES.md` remains the active product/platform behavior contract. If this
  proposal conflicts with an active rule, implementation must stop for review.
- `docs/session-hardening-design.md` and `docs/session-updates.md` document the
  already-implemented opaque refresh-token work and its deliberate rejection of
  legacy stateless-refresh migration.
- `docs/auth-and-session-progress.md` records staging evidence for the
  implemented Phase 1 baseline and must remain evidence-only; planned
  multi-account behavior is not considered verified until its dedicated gate
  passes.
- `docs/session-management.md` documents the earlier session-management feature
  and is superseded by this consolidated proposal where the two differ.
- `packages/design/design.md` governs any future Settings, OTP, session-list,
  or staff-screen visual work.
- `docs/auth-and-session-mobile.md` owns mobile-only authentication, secure
  storage, app lifecycle, native account switching, and mobile acceptance
  requirements; it must be read when mobile implementation begins.
- `CHANGELOG.md` and `AGENTLOG.md` must be updated alongside implementation or
  documentation changes according to the repository rules.

## 21. Decisions still intentionally deferred

- Final email provider and email-template wording.
- Final OTP delivery method: email, authenticator, or another mechanism.
- Exact staff role names and complete permission catalog.
- Final staff/superadmin recovery procedure after MFA is available.
- Exact outbox implementation details, while durable login/security events and
  retryable notification processing are required.

## Phase 4e implementation checkpoint — 2026-09-06 (historical)

The first 4e server/web slice is implemented. Migration `20260906_0035` adds
device-scoped account session slots. The API returns opaque slot references and
safe summaries, enforces `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` (1–16, default
4), binds slots to the protected device cookie, and uses slot-named HttpOnly
refresh cookies. The legacy single-account refresh path remains supported.

Staging evidence: migrations reached `20260906_0036`, `alembic check` reported
no drift, and `tests/test_phase4_accounts.py` passed (`2 passed`) covering two
accounts on one device, approval, notification creation, denied-OTP
invalidation, listing, switching, slot refresh, and removal. Web TypeScript and
production build checks passed.

The web-focused Phase 4 release is closed. The web Add-account modal,
signup/login reuse, cross-tab coordination, notifications, and account
lifecycle fallback are implemented and build-verified. Mobile-specific
requirements are maintained in `docs/auth-and-session-mobile.md` and are
deferred until a mobile client exists.

Current staging E2E handoff: the live login page is reachable and staging is
at migration head `20260906_0036` with no drift. Full Phase 1–4 browser testing
has started and is awaiting the credentials for the designated staging test
account; OTPs will be supplied interactively when required.

E2E finding: the deployed signup flow requested a redundant login OTP after
successful signup email verification. The working-tree fix makes signup issue
the authenticated session directly, preserving the agreed single signup OTP
path. Redeploy API and web, then repeat the signup acceptance before continuing
the remaining Phase 1–4 checks. The current live deployment has only reached
the expected login-verification screen for a new browser session; it does not
yet prove that the signup fix is deployed.

The deployment retest also observed blank authenticated home/settings routes
while the public login page remained available. Treat this as a deployment
stability gate and resume Phase 1–4 acceptance only after authenticated routes
recover and the updated signup flow can be exercised.

Follow-up evidence: the staging API health endpoint actively refused the
connection during the retry, so the current authenticated-route blank state is
an API deployment outage. Resume acceptance only after API health is restored.

## Account-switcher release evidence — 2026-09-07

The earlier deployment handoff is superseded for the current web release. The
runtime fix was pushed to staging as `6358b0d`; staging web returned `200` and
the API health endpoint returned `{"database":true}`. Acceptance is scoped to
one clean Chromium/Chrome profile; a separate Edge run is not required.

Clean Chrome E2E created five synthetic accounts through standalone signup,
in-app signup, and in-app login/re-add. Switching, reload continuity, logout
fallback to the most-recent account and then the public site, the configured
four-account limit-plus-one refusal, and slot re-add all passed. No OTP prompt
appeared with both OTP flags disabled. Account operations took roughly 15–30
seconds; latency/feed stability remains a separate deployment investigation.

The complete API suite passed (`107 passed`, with existing warnings); web
TypeScript, lint, production build, and `git diff --check` passed. The
account-switcher resolution plan and detailed phase evidence remain in
`docs/account-switcher.md`; mobile account switching remains deferred.

## Phase 4 UX decisions — 2026-09-06

The agreed UX follows familiar social-platform conventions: Add account opens
the existing modal with Login first and Create account below; successful
authentication immediately activates the new or existing account; the drawer
offers switching, Add account, Manage accounts, and active logout; Manage
Accounts uses ProfileCard rows with the active account first and logout on other
rows; confirmation precedes removal; active logout selects the most recent
remaining account or returns to the public site; deactivated and pending-
deletion accounts show lifecycle messaging and are removed from the device
list; the dropdown closes after switching; and recoverable failures preserve
the active account.

## 2026-09-10 implementation and staging follow-up

The web login and in-app Add account flow share the same OTP completion
handler. If OTP verification ends in an ambiguous client or network failure
after the server may have committed the login, the client makes one
refresh-cookie recovery attempt before showing an error. Successful recovery
continues the normal authenticated redirect; invalid or expired OTP responses
retain their existing error behavior.

This applies to standalone login and Add account. It does not treat a timeout
as proof that the session is invalid, does not clear the active account, and
does not retry indefinitely. Account display usernames must come from the
server-returned account summary and must never be inferred from an email
address. See `docs/latency.md` for the 2026-09-10 observations.

The approval and emailed-OTP paths are alternatives. While the login screen is
waiting for OTP input, approval-status polling may run; as soon as the user
starts entering an OTP, polling stops. A late approval `expired` response must
not overwrite the active OTP path or display stale error copy before successful
OTP completion. Editing the OTP also clears earlier approval-status messaging.

The API also records the winning path through the existing challenge fields and
serializes OTP, approval, and denial transitions with a row lock. Its status
endpoint reports `otp_verified` after OTP consumption when approval did not win,
so delayed polls can distinguish a completed OTP challenge from a genuinely
expired one. Both completion paths remain single-use and server-authoritative;
the frontend guard is retained as a defensive response-ordering safeguard.

### Staging verification boundary — 2026-09-10

A fresh incognito staging run verified the normal OTP completion path after
the server-authoritative challenge-state change: the OTP was submitted once,
the UI remained in `Please wait…` without an expiry or timeout message, and the
session redirected to `/home/explore` successfully. This verifies the deployed
normal state flow and session continuity.

It does not yet prove the concurrent race guarantee. No dedicated test has
simultaneously submitted OTP and approval, submitted duplicate completions, or
directly asserted the API's `otp_verified` status response. Those remain
backend concurrency evidence requirements and must not be described as passed.
