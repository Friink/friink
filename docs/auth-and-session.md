# Friink Authentication and Session Architecture

Status: Proposed architecture; Phase 1 ordinary-session baseline is implemented; multi-account and later phases remain planned

Last updated: 2026-09-05T03:00:00Z

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
- Failed-login lockout uses a configurable progressive policy: the third
  failure starts a 30-minute cooldown, the fourth starts a one-hour cooldown,
  and the fifth starts a 24-hour cooldown. A successful login resets the
  progressive failure state. The policy may be strengthened later.
- Multiple-account support has a fixed user flow: `Add account` in the side
  drawer opens a design-system login/signup modal; successful authentication
  adds the account to the current browser profile or mobile installation; and
  `Change account` appears only once at least two accounts are authenticated.
- A browser profile or mobile installation may remember the number of
  independent authenticated accounts configured by
  `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`. The safe default is `5`; this is a
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
  authenticated Friink accounts on web and mobile.
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
- Multiple-account support with an authenticated account switcher on web and
  mobile.

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

The complete scope is divided into six implementation phases. Phase 1 is
already implemented as the current session foundation, but it is split below
into smaller audit and release units so that staging evidence, production
verification, and future regressions have clear boundaries. Phases 2 through
6 are divided into ordered alphabetic chunks so that each dependency and
verification boundary is explicit. Every chunk must be reviewed and verified
before the next chunk changes shared auth/session behavior.

### Phase 1 — Session reliability

Phase 1 is the implemented baseline for ordinary one-account sessions. The
subphases below do not change that behavior; they make its contract testable
and identify the remaining environment-specific evidence.

#### Phase 1a — Cookie, origin, and startup boundary

Keep the refresh credential in an explicit persistent HTTP-only cookie. Validate
at startup that the database URL, JWT signing configuration, cookie settings,
allowed origins, and environment-specific API/web origins are present and
consistent. Staging uses `https://staging.friink.com` and
`https://staging-api.friink.com`; production is a separate release target.

Verification gate: capture redacted login and refresh response headers,
credentialed CORS preflight, and a real browser request proving the cookie is
sent to the API and accepted after rotation.

#### Phase 1b — Sliding idle lifetime

Use the 30-day target sliding idle window. Successful login and successful
refresh extend the server-side idle deadline. Explicit logout, revocation,
account lock, or confirmed terminal session failure ends the session. Access
token expiry alone must enter the refresh path.

Verification gate: test activity just before and after the idle boundary,
browser reload, ordinary deployment/restart, and explicit terminal actions.

#### Phase 1c — Rotation, replay, and recoverable refresh

Rotate refresh tokens transactionally within a token family. A legitimate
retry or lost response may use the deliberately bounded grace/idempotency
contract. A confirmed reuse of a dead token revokes the family. Timeout,
network/CORS failure, 5xx, malformed response, and configuration failure are
ambiguous and must not clear local auth.

Verification gate: test concurrent refreshes, replacement-cookie acceptance,
lost-refresh responses, replay of a dead token, and each terminal versus
ambiguous outcome.

#### Phase 1d — Reactive web refresh and cross-tab coordination

Keep the web client reactive: after `401 TOKEN_EXPIRED`, refresh once and retry
the original request once. Coordinate concurrent refreshes across tabs and
retain local auth through recoverable failures. Do not add proactive refresh or
clear auth because an arbitrary response happens to be `401`.

Verification gate: exercise multiple tabs, concurrent expired requests,
offline/online transitions, non-expiry `401` responses, and recovery after a
refresh response is lost.

#### Phase 1e — Token and key-handling boundary

Keep access tokens short-lived and in memory on web clients. Verify JWTs by
key ID and retain the previous verification key throughout the documented
rotation overlap. Never log passwords, OTPs, raw refresh tokens, internal
UUIDs, or signing secrets. Keep server clocks on synchronized UTC with an
explicit, tested skew policy.

Verification gate: run mixed-key verification, expiry-boundary tests, clock
offset tests, and log inspection for secret leakage.

#### Phase 1f — Release evidence and regression gate

The implementation baseline is complete only when the preceding contracts are
verified in staging and the same checks pass against the permanent production
origins before release. A staging `Failed to fetch` result is not sufficient
evidence of an auth failure: inspect the API status, CORS headers, deployment
configuration, and database health separately.

Verification gate: record the staging evidence now; repeat the production
cookie/CORS, login, refresh, terminal-failure, and recovery evidence as a
pre-release gate. Production verification is not implied by staging success.

### Phase 2 — Account identity

#### Phase 2a — Identity primitives and signup validation

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

Implement the database-backed reserved-username registry and enforce it during
both signup and username changes. Matching is case-insensitive. Seed the
initial reserved values `admin`, `staff`, `media`, `support`, and `security`,
with reason, active state, creation timestamp, and optional staff note.

Verification gate: test reserved-name rejection under every casing, inactive
reservations, signup/change races, and explanatory frontend checks that cannot
bypass the API or database rule.

#### Phase 2c — Signup email privacy and ownership OTP

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
step-up challenge rather than proving compromise. Add the configurable
progressive policy: the third failure starts a 30-minute cooldown, the fourth
starts one hour, the fifth starts 24 hours, and a successful login resets the
progressive state. Independent IP/device rate limits remain required.

Verification gate: test email login, username login, mixed-case identifiers,
recognized versus new and suspicious logins, challenge skips and challenges,
refresh without OTP, device rotation/invalidation, concurrent failures,
cooldown boundaries, successful-login reset, and account privacy during all
failures.

#### Phase 2e — Email and username changes with permanent history

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

#### Phase 3a — Durable security-event model

Implement durable login and security events with stable event identity,
timestamp, user/session/device context, event type, and delivery state. A
successful new login must be distinguishable from refresh, retry, and ordinary
session activity without exposing internal UUIDs in user-facing content.

Verification gate: prove event uniqueness and transaction boundaries for
successful logins, retries, refreshes, failed logins, and security actions.

#### Phase 3b — Login notifications and future email hooks

Create the in-app login-security notification from the durable event and add a
provider-neutral integration point for future email delivery. Include
suspicious-login actions without making notification delivery a prerequisite
for keeping the authenticated session alive.

Verification gate: prove every successful new login creates one user-visible
in-app notification, while refreshes and duplicate request retries do not.

#### Phase 3c — Retryable outbox processing

Implement retryable, idempotent outbox processing for in-app and future email
notifications. Temporary provider, network, or configuration failures remain
delivery failures, not authentication failures, and must not log the user out.

Verification gate: simulate duplicate workers, provider failures, delayed
delivery, retry exhaustion, and recovery while preserving exactly-once
user-visible event behavior.

### Phase 4 — User session controls

#### Phase 4a — Session inventory and current-session identity

Complete the authenticated session list using server-derived session identity.
Show safe device labels and activity metadata without exposing refresh tokens,
device identifiers, IP addresses, locations, fingerprints, or internal UUIDs.
Mark the session represented by the presented refresh cookie as current.

Verification gate: test multiple browsers, browser profiles, app installs,
refresh rotation within one family, and current-session detection.

#### Phase 4b — Selective and bulk revocation

Implement ending one other session, ending all other sessions, and the current
session logout path. Revocation must be authoritative, idempotent, and
consistent with the terminal-versus-ambiguous refresh contract. Do not claim
immediate revocation of already-issued access JWTs beyond the documented
boundary.

Verification gate: test selective revocation, revoke-others, current logout,
replay of revoked refresh tokens, simultaneous actions, and recoverable API or
network failures.

#### Phase 4c — Password-change continuity

Implement the revised password-change flow: verify the current password or
approved equivalent step-up, apply the signup password policy, keep the
current session active after success, and provide user-controlled other-
session controls. Define which sessions are revoked by policy and surface the
result clearly.

Verification gate: test wrong current passwords, password policy failures,
successful continuity, other-session behavior, refresh rotation, and failure
recovery.

#### Phase 4d — Existing-session device enrollment

Allow an existing authenticated session to enroll another device through a
fresh four-minute OTP. The code is single-use, stored hashed, rate-limited,
and bound to the enrollment intent. Successful enrollment creates a separate
ordinary session and recognition record; it does not expose tokens or device
identifiers.

Verification gate: test enrollment approval, expiry, replay, replacement
codes, wrong-device use, rate limits, and creation of the separate session.

#### Phase 4e — Multiple-account device sessions and switching

Implement the device-scoped session-slot and opaque account-slot model described in
section 8.5. Keep the existing login and signup endpoints as the authentication
authority, then register a successful account on the current browser profile
or mobile installation. Add safe account listing, account switching, account
removal, account-scoped refresh/session selection, and account-scoped client
state isolation. Do not expose user IDs or move refresh tokens into
JavaScript-readable storage. Preserve the single-account session path and
existing refresh/revocation semantics.

Break implementation into these delivery parts:

- **4e-a — Server contract:** additive slot/session data model, exact account
  summary and switch/remove response schemas, validated
  `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` enforcement, ownership checks,
  idempotency, and independent-account isolation.
- **4e-b — Web auth state:** one active account context, slot-scoped refresh
  cookies and cross-tab coordination, safe persisted summaries, state/cache
  partitioning, and recovery without logging out other accounts.
- **4e-c — Add-account experience:** design-system modal, reused login/signup
  flow, OTP handling, duplicate-account behavior, limit messaging, and
  accessibility.
- **4e-d — Account lifecycle:** switching, removal, logout, locked/revoked
  accounts, password changes/resets, session inventory, notifications, and
  security-event behavior.
- **4e-e — Mobile:** platform secure-storage entries, app restart/background
  recovery, account switching, and mobile-specific failure/accessibility tests.

Verification gate: test Add account login, Add account signup through OTP,
modal cancellation, duplicate/retry behavior, safe account-list fields,
switch success and failure, hidden Change account with fewer than two accounts,
account removal, logout/revocation boundaries, browser reload, multiple tabs,
mobile secure-storage recovery, account-scoped notifications, and cross-account
data/cache isolation.

#### Phase 4f — Expiry, recovery, and user messaging

Implement session-expiry and recovery messaging that distinguishes confirmed
terminal session failure from network, CORS, timeout, 5xx, malformed, and
configuration failures. Preserve the user session through recoverable failures
and ask for login again only after a confirmed terminal result.

Verification gate: test idle expiry, explicit revocation, expired access-token
refresh, lost refresh responses, cross-tab recovery, browser reload, and
offline/online transitions.

### Phase 5 — Staff and superadmin security

#### Phase 5a — Reserved superadmin bootstrap

Implement a one-time, deployment-safe reserved superadmin bootstrap with
strong password handling, explicit configuration validation, protected audit
events, and safeguards against accidental takeover or repeated bootstrap.

Verification gate: test first-run bootstrap, rerun behavior, invalid
configuration, secret rotation, recovery, and absence of superadmin bypasses
through ordinary user APIs.

#### Phase 5b — Staff roles and granular permissions

Implement staff roles and least-privilege permissions with server-side checks
on every administrative action. Keep permission names and moderation-product
details extensible, while enforcing the initial security boundaries and
separating ordinary personal access from staff access.

Verification gate: test allow/deny matrices, role changes, privilege
escalation attempts, protected identifiers, and separation between staff and
ordinary user capabilities.

#### Phase 5c — Privileged staff sessions and step-up protection

Implement separate privileged staff-session state, step-up access, and future
MFA/OTP support. Privileged sessions use 16 minutes of inactivity and an
eight-hour maximum continuous lifetime. Expiry locks staff screens only; it
does not log the user out of ordinary Friink.

Verification gate: test step-up success/failure, privileged-session renewal,
16-minute inactivity expiry, eight-hour maximum lifetime, ordinary-session
continuity, and cross-tab behavior.

#### Phase 5d — Account locking and administrative revocation

Implement account locking and target-session administrative revocation with
clear authorization boundaries, audit events, and self-lockout safeguards.
Ensure lock state is enforced server-side and cannot be bypassed by stale
access tokens, alternate sessions, or client-only state.

Verification gate: test lock/unlock policy, locked login and refresh behavior,
target-session revocation, mass administrative actions, self-lockout
prevention, and recovery paths.

### Phase 6 — Operations and incident response

#### Phase 6a — Migration and rollback safeguards

Implement forward migrations, compatibility windows, rollback procedures, and
startup checks for auth/session schema and configuration changes. Rollback
must not require guessing or manually editing production authentication data.

Verification gate: rehearse forward migration, interrupted migration,
compatible rollback, incompatible rollback detection, and recovery.

#### Phase 6b — Observability and append-only audit protection

Add privacy-preserving metrics, structured operational logs, security alerts,
and append-only audit storage for sensitive account, session, and staff
actions. Never log passwords, raw refresh tokens, OTPs, internal UUIDs, or
other prohibited user-facing identifiers.

Verification gate: inspect representative success/failure telemetry, confirm
redaction, detect missing or duplicated events, and verify audit integrity.

#### Phase 6c — Secret and signing-key rotation

Document and automate secret rotation, refresh-token invalidation strategy,
and JWT signing-key rotation with mixed-version verification and clock-safe
overlap windows. Retire old keys only after the documented expiry/safety
window.

Verification gate: rehearse key compromise, old/new `kid` verification,
mixed-version deployment, clock skew, rollback, and safe retirement.

#### Phase 6d — Mass revocation and account lockdown

Provide controlled operations for mass session revocation, account lockdown,
device-recognition invalidation, and compromised-admin containment. Actions
must be authorized, auditable, idempotent, and recoverable without directly
editing authentication rows in production.

Verification gate: rehearse refresh-token compromise, admin compromise, mass
revocation, account lockdown, partial failure, retry, and restoration.

#### Phase 6e — Incident runbooks and recovery rehearsal

Publish incident runbooks for key compromise, refresh-token compromise,
account takeover, notification abuse, admin compromise, rollback, and user
recovery. Define owners, evidence to capture, decision points, and post-
incident verification while preserving privacy and the non-negotiable rules.

Verification gate: run an end-to-end incident exercise and prove that normal
service can be restored without guessing, bypassing controls, or manually
editing production authentication data.

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
- Separate mobile-app installations are separate sessions.
- Logging in again creates a new session.
- Refresh rotation within one family does not create a new visible session.
- A device may hold multiple account-specific sessions after multiple-account
  support is enabled; one account is active at a time.
- The active account is selected through a server-validated opaque account
  slot, not a client-supplied user ID or username.

The server determines the current account/session from the presented
account-specific refresh credential and its device-scoped session slot. The browser
or mobile client never supplies a session ID or user ID to claim that it is
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

The API should use appropriate status/code combinations so a deployment or
configuration problem is not mislabeled as an invalid refresh session. The web
client should clear local state only for an explicitly recognized terminal
refresh result, not merely because an arbitrary refresh response has status
401. This protects the intended UX: users are asked to log in again only when
their session is actually no longer usable.

## 8.5 Multiple logged-in accounts and account switching

Multiple-account support is a confirmed product requirement for both web and
mobile. Each account is a fully independent Friink identity: there is no
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
   an available independent account session for the current browser profile or
   mobile app installation. The newly authenticated account becomes active.
5. `Change account` is hidden until at least two accounts have successfully
   authenticated on that browser profile or app installation.
6. `Change account` lists only accounts registered on that device and switches
   to the selected account without merging identities.
7. The switcher supports up to the server-configured
   `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` value, defaulting to five. When the
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

### 8.5.4 Mobile credential boundary

The mobile client keeps one secure-storage entry per account slot using the
platform Keychain/Keystore/Secure Storage facility or its equivalent. The
mapping contains only what is required to recover that account's session and
safe display metadata. Tokens are never logged, placed in analytics payloads,
or stored in ordinary unencrypted application preferences.

Switching loads the selected account's access context, refreshes only that
account's session when necessary, and replaces the active in-memory account
state atomically. A failed switch leaves the previously active account usable
when its session is still valid.

### 8.5.5 API behavior

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
to `5` and must be validated at startup as an integer between `1` and `16`.
The browser and mobile client must not provide or override it. If an operator
lowers the value below the number of existing slots, existing sessions remain
usable and no account is silently removed; new additions are blocked until the
device is under the configured limit.

### 8.5.6 Isolation, notifications, and session management

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

### 8.5.7 Compatibility and rollout

The feature requires an additive migration and a backward-compatible rollout:

1. Add the device-scoped account-session-slot data model without invalidating existing
   refresh/session rows.
2. Deploy server support that continues to accept the current one-account
cookie/session path and creates a device session slot after the next successful
   login or explicit account addition.
3. Deploy the web/mobile account list, modal, switch, removal, and isolated
   client-state behavior behind a controlled feature flag if needed.
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

### 8.5.8 Impact on already implemented auth/session

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
- **Temporary progressive cooldown:** after the failed-login tiers in section
  16, show a distinct message such as `Too many attempts. Try again in about
  30 minutes, around 3:45 PM.` Use the applicable 30-minute, one-hour, or
  24-hour tier and an approximate retry time when available. This message is
  not the full-account-lock message and must never be conflated with it.

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
Mobile implementations must use platform secure storage with one isolated
credential entry per account slot.

### 10.2 Password recovery

Password recovery is part of the account lifecycle and uses the same privacy
and OTP protections as signup:

1. An unauthenticated request accepts an email and always returns the same
   neutral response, whether or not an account exists.
2. If appropriate, the account receives a six-character alphanumeric,
   single-use password-reset OTP. Store only its hash, expire it after four
   minutes, allow five attempts, invalidate older reset requests when a newer
   one is issued, and rate-limit by IP, email, and device.
3. The user sets a new password using the standard 8–16 character policy.
4. Successful recovery revokes every existing refresh-token family for that
   account, invalidates remembered device session slots, creates a security
   event, and requires a fresh login. Already-issued access tokens may remain
   valid only until their documented short expiry.

Recovery must not reveal whether an email exists, and reset OTPs must not
appear in URLs, analytics payloads, browser history, or support screenshots.

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

1. Commit the login, session, and login-security event together.
2. Process the in-app notification and future email delivery from that durable
   event.
3. Retry temporary notification/delivery failures without logging the user out
   or losing the security event.

This avoids making a non-critical notification provider a reason for a valid
login to fail while still ensuring the event is not silently forgotten.

## 12. OTP and new-device enrollment

Once OTP delivery exists, a user with an existing authenticated session may
enroll another device without entering the account password again:

1. The existing session requests a device-enrollment OTP.
2. The system displays or delivers the short-lived code through the approved
   flow.
3. The new device enters the code within four minutes.
4. The code is consumed and a new ordinary session is created.

Enrollment OTPs are single-use, stored hashed, attempt-limited, and bound to
the initiating user/session and intended action. Issuing a new code invalidates
the previous code. Revoking the initiating session invalidates its pending
enrollment requests.

The UI should clearly identify the device being added and show a confirmation
after enrollment. A future stronger flow may require approval from the
existing device in addition to code entry.

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

Exact role names and additional permissions remain to be defined.

### 13.3 Privileged staff sessions

Entering staff screens requires an OTP/MFA step once that capability exists.
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
- two authenticated accounts in one browser profile and one mobile
  installation, including reload, concurrent refresh, and active-account
  state/cache isolation
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
- `CHANGELOG.md` and `AGENTLOG.md` must be updated alongside implementation or
  documentation changes according to the repository rules.

## 21. Decisions still intentionally deferred

- Final email provider and email-template wording.
- Final OTP delivery method: email, authenticator, or another mechanism.
- Exact staff role names and complete permission catalog.
- Final staff/superadmin recovery procedure after MFA is available.
- Exact outbox implementation details, while durable login/security events and
  retryable notification processing are required.
