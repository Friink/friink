# Friink Authentication and Session Architecture

Status: Proposed design; requirements below approved for planning, implementation not yet approved

Last updated: 2026-09-02T20:22:34Z

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
  email delivery is available. Ordinary password login does not require an OTP
  when the login is recognized as normal; risk-based OTP/MFA is used for a new
  or suspicious device/login and for defined high-risk actions. Access-token
  refresh never requires an OTP.
- Failed-login lockout uses a configurable progressive policy: the third
  failure starts a 30-minute cooldown, the fourth starts a one-hour cooldown,
  and the fifth starts a 24-hour cooldown. A successful login resets the
  progressive failure state. The policy may be strengthened later.

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

### Out of scope for this design

- Email provider selection or automated email delivery implementation.
- Choosing a final OTP delivery vendor.
- Full staff dashboard and moderation product requirements.
- Staff permission names beyond the initial security boundaries.
- Billing, subscription entitlements, professional verification, or badges.
- Public display of IP addresses, locations, device fingerprints, or UUIDs.
- Immediate revocation of already-issued access JWTs on every ordinary session
  action.

## 2.1 Implementation division

The complete scope is divided into six implementation phases. Each phase must
be reviewed and verified before the next phase changes shared auth/session
behavior.

### Phase 1 — Session reliability

Implement the persistent cookie contract, 30-day sliding idle policy, explicit
terminal-versus-ambiguous refresh outcomes, refresh retry grace/idempotency,
CSRF protection, secure access-token handling, JWT key-rotation compatibility,
clock policy, and startup configuration validation.

Verification gate: capture real staging and production cookie/CORS headers;
test login, refresh, timeout, network/CORS/5xx failure, key rotation, clock
boundaries, cross-tab refresh, and lost-refresh-response recovery.

### Phase 2 — Account identity

Implement signup requirements, email verification OTP, risk-based OTP/MFA for
new or suspicious logins, progressive failed-login throttling, email/username changes, permanent
identity history, reserved usernames, and immutable UUID/public-ID behavior.

Verification gate: test existing versus new email privacy, OTP expiry/replay,
incomplete-signup reuse, username casing/reuse, account-age validation, race
conditions, and stale post URL redirects.

### Phase 3 — Security events and notifications

Implement durable login/security events, in-app login notifications, future
email-notification integration points, suspicious-login action handling, and
retryable outbox processing.

Verification gate: prove every successful new login creates one durable event;
prove refreshes do not create login notifications; simulate notification
failure and retry without logging the user out.

### Phase 4 — User session controls

Complete the session list and revocation UX, revised password-change flow,
selective/all-other-session controls, device enrollment through a four-minute
OTP, and session-expiry/recovery messaging.

Verification gate: test multiple browsers/devices, current-session detection,
selective revocation, revoke-others, password-change continuity, OTP replay,
and browser/network recovery behavior.

### Phase 5 — Staff and superadmin security

Implement the reserved superadmin bootstrap, staff roles and granular
permissions, privileged staff sessions, future MFA/OTP support, account
locking, and administrative session revocation.

Privileged sessions use 16 minutes of inactivity and an eight-hour maximum
continuous lifetime. Expiry locks staff screens only; it does not log the user
out of ordinary Friink.

Verification gate: test permission separation, superadmin protection, staff
step-up access, privileged-session expiry, account lock behavior, target
session revocation, and self-lockout safeguards.

### Phase 6 — Operations and incident response

Implement migration/rollback safeguards, observability, append-only audit
protection, secret/key rotation procedures, mass session revocation, account
lockdown, compromised-admin recovery, and documented incident runbooks.

Verification gate: rehearse key compromise, refresh-token compromise, admin
compromise, mass revocation, rollback, and recovery without guessing or
manually editing production authentication data.

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

1. Verify email and password.
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
unique constraint on `username_key`. No email OTP is required for an ordinary
username change, although a future step-up challenge may protect high-risk
accounts.

The old username is released immediately after the transaction succeeds. The
new display casing is stored as the current presentation value, and both old
and new values are retained in username history with timestamps.

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
or temporarily protected names after a high-profile username change.

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
- Session revocation, explicit logout, account lock, or a confirmed security
  action ends it immediately.
- Access-token expiry alone does not log the user out; it triggers refresh.

This is an implementation target rather than a claim about any specific
third-party platform's private expiry policy.

### 8.2 Session identity

One refresh-token family represents one user-visible session:

- Separate browsers are separate sessions.
- Separate browser profiles are separate sessions.
- Separate mobile-app installations are separate sessions.
- Logging in again creates a new session.
- Refresh rotation within one family does not create a new visible session.

The server determines the current session from the presented refresh cookie.
The browser never supplies a session ID to claim that it is current.

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
or cross-environment mutation fallback.

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

## 9. Session management UI and behavior

Settings > Account lists active sessions using safe fields:

- device label
- browser
- operating system
- logged-in time
- last-active time
- current-session indicator

The current session has no revoke action in its row. Other sessions can be
revoked individually or through a confirmed `Log out all other sessions`
action. Repeated revoke requests are idempotent.

Revoking a session:

- Marks its session and refresh family unusable.
- Prevents future refresh from that session.
- Retains history for audit and display rules.
- Does not delete posts or account data.
- Does not necessarily invalidate an already-issued access JWT before its
  normal short expiry.

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

The preferred web implementation keeps the short-lived access token in memory
and uses the HTTP-only refresh cookie for session recovery. It must not persist
the access token in `localStorage` unless a later security review explicitly
accepts the increased impact of an XSS vulnerability. The refresh token itself
must never be readable by JavaScript.

### 10.2 CSRF protection

Credentialed cookie requests must include explicit CSRF protection for
state-changing endpoints. CORS and `SameSite` are not sufficient by
themselves. The implementation may use a CSRF token, strict `Origin` checking,
or a combination appropriate to the deployment, but it must be tested for
cross-site state-changing requests and legitimate staging/production requests.

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
- optionally blocking protected API access immediately if the security policy
  requires it
- retaining all account content and history

Whether existing access JWTs are rejected immediately is a deliberate security
tradeoff. The privileged account-locking design must support immediate
enforcement later without requiring ordinary API requests to perform a session
database lookup.

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
rendering, history/audit records, reserved names, and possible future cooldowns
reduce confusion but cannot make an old profile URL identify its former owner.

### Already-issued access tokens

Session revocation and account locking primarily stop refresh. A previously
issued access token may remain valid until its short expiry unless protected
requests add a revocation/version check. Immediate enforcement has a request-
time database/cache cost and should be added deliberately for staff lock and
high-risk security actions if required.

### Cookie and deployment configuration

Persistent sessions depend on correct HTTP-only cookie, Secure, SameSite, CORS,
frontend-origin, and API-origin configuration. A deployment that changes the
JWT secret, cookie behavior, domain, or environment incorrectly can appear to
users as a mass logout. Deployment verification is part of the feature.

The implementation must not rely on a browser session cookie or on server-side
expiry alone. The deployed API must issue an explicit persistent refresh cookie
with a `Max-Age` covering the agreed session policy, together with the required
`HttpOnly`, `Secure`, `SameSite`, and `Path` attributes. Domain behavior must be
intentional: a host-only cookie for the API host is acceptable when the browser
only needs to send it to the API; a parent-domain cookie must not be added for
convenience without a documented security reason.

The staging and production web/API origins must be tested independently. A
successful authenticated request must demonstrate that the browser sends the
refresh cookie cross-origin, and the API must return the exact configured web
origin—not `*`—with `Access-Control-Allow-Credentials: true`.

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
- current-session detection and selective session revocation
- revoke-others preserving the current session
- login notification creation and durable retry behavior
- password change preserving the current session
- device enrollment OTP expiry, replay, and revocation
- role/permission enforcement for staff screens and actions
- privileged 16-minute idle and eight-hour absolute timeout
- account locking and target-session revocation
- audit records without secrets or raw identifiers
- migration state and at least one real request/response check for each new
  endpoint

### Mandatory auth/session evidence

The implementation is not complete until the following evidence is recorded.
Source inspection or compilation alone is insufficient.

#### Cookie and cross-origin browser contract

For both staging and production, capture the complete response headers from a
successful login with the token value redacted but the attributes preserved.
The evidence must show:

- cookie name `friink_refresh_token`
- explicit persistent-cookie behavior
- `Max-Age` covering the configured session policy
- `Path=/`
- `HttpOnly`
- `Secure` in deployed HTTPS environments
- intentional `SameSite` behavior
- intentional domain/host-only behavior

Also capture credentialed CORS preflight and authenticated request evidence for
both web/API pairs showing the exact `Access-Control-Allow-Origin`,
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
- Whether account locking immediately rejects already-issued access JWTs.
- Whether high-risk username changes require step-up authentication.
- Whether released high-profile usernames receive a temporary cooldown.
- Final staff/superadmin recovery procedure after MFA is available.
- Exact outbox implementation details, while durable login/security events and
  retryable notification processing are required.
