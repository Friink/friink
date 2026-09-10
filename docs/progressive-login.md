# Progressive Login

Status: Implemented locally behind feature flags; staging verification pending

## Decision summary

Add a new public authentication entry point at `/start`.

The intended public-site primary CTA should say **Get started** and link to
`/start`. It is not enabled by this rollout yet; the existing public CTA and
explicit Login action remain unchanged until staging verification is complete.
The existing **Login** action should remain available as a secondary/fallback
route to `/login` while the new experience is introduced and validated.

`/start` is an intentless entry point: the visitor does not need to decide
between login and signup before entering an identifier. The existing login and
signup flows remain available and are reused underneath.

## Goal

Reduce friction for new users by removing the separate “click Sign up” step,
while preserving the existing authentication rules, password policy, security
checks, and recovery behavior.

The experience should support this mental model:

> Login or create account — enter your email or username to continue.

The system then continues the user through the appropriate existing-account or
new-account flow.

## Proposed UX

### Shared entry screen

Route: `/start`

Copy:

> Login or create account
>
> Enter your email or username to continue.

The field remains the existing `Email or username` field. It accepts email,
username, and a leading `@` for username lookup using the current
case-insensitive normalization rules.

At rollout, the public header and landing-page primary CTA should use `Get
started`. That CTA is not switched yet. An explicit `Login` link remains
available and points to `/login`.

The identifier submission uses a neutral presentation. The UI must not say
whether the identifier belongs to an existing account or a new user, and must
not label the next state as `Login` or `Sign up` at this point. The server may
select the underlying flow, but the browser copy and identifier-step response
must remain neutral.

### Existing account

For an existing email or username, continue into the current login experience:

```text
Email or username
  -> password
  -> recognized device: normal session
  -> new or suspicious device: existing OTP or approval challenge
  -> authenticated session
```

The existing password policy, failed-login throttling, account-lock behavior,
device recognition, OTP/approval challenge, session creation, and refresh
behavior do not change.

The password screen keeps the current recovery options:

- Forgot password
- Back/change identifier
- Existing sign-in-link alternative where that flow is offered

A wrong password remains a login failure. It must not silently turn into
signup or create another account.

### Failed attempt behavior

If an existing user submits an incorrect password, the progressive flow stays
on the login password step. It must:

- Show the existing generic invalid-credentials message.
- Preserve the submitted email or username.
- Clear the password field.
- Keep `Forgot password?` and Back/change-identifier controls available.
- Apply the existing server-authoritative cooldown and failed-login
  notification policy.
- Never offer automatic account creation as a response to the failed attempt.

Unknown identifiers must remain indistinguishable from wrong passwords in
user-facing copy and account-existence behavior. A new account is entered only
through the separately defined new-email verification branch. The identifier
step uses the resolved neutral presentation and must not visibly reveal that
branch or account existence.

### New user

Only an email can begin the new-account branch because signup requires email
ownership verification. The intended flow is:

```text
Email
  -> signup email OTP
  -> password
  -> required profile details
  -> account creation
  -> normal authenticated session
```

The UI should avoid an explicit “No account found” message if doing so would
expose account existence. Neutral copy such as `Continue by verifying your
email.` is preferred.

Signup reservations, OTP expiry, attempt limits, replacement, and account
creation timing remain server-controlled.

If an unknown username is submitted, the flow cannot create an account from
that value. It remains governed by the existing generic login behavior because
signup is email-only.

### Bootstrapped users

The bootstrapped `admin@friink.com` / `@admin` identity uses the existing-user
path:

```text
admin@friink.com or @admin
  -> existing password
  -> normal login security checks
  -> ordinary Friink session
  -> staff step-up when Control Panel is opened
```

The progressive flow must never create a signup reservation, send a public
signup OTP, create a duplicate reserved identity, or bypass staff
verification. The server enforces this using the existing reserved-identity
and bootstrap rules; the frontend does not need an admin-specific branch.

## Scope

### In scope

- New `/start` entry route and screen.
- Public-site `Get started` CTA pointing to `/start`.
- Reusing the current login/signup screens, field treatments, validation,
  loading, error, OTP, and session patterns.
- A server-authoritative routing/orchestration step after identifier entry.
- Feature-flagged rollout and fallback to `/login`.
- Responsive web and mobile-compatible auth presentation through shared
  components.
- Documentation, tests, analytics, and deployment verification for the new
  entry point.

### Out of scope

- Changing password policy or password hashing.
- Replacing or deleting `/login`.
- Changing signup profile requirements.
- Changing OTP configuration or challenge security.
- Changing failed-login cooldown tiers or account locking.
- Adding a new authentication method.
- Automatically creating an account after a wrong password.
- Changing admin bootstrap, roles, permissions, or staff step-up behavior.
- Changing the authenticated account-switcher/Add-account contract initially.

## Technical approach

The preferred implementation is a thin progressive-entry orchestration layer,
not a second authentication system.

1. The web client submits the identifier to `POST /auth/progressive/start`.
2. The API resolves the identifier using the existing authoritative email and
   username lookup rules.
3. The API returns a short-lived opaque flow token with neutral copy. The
   client sends that token to `POST /auth/progressive/continue`; the API then
   selects the existing password or new-email verification continuation. It
   must not return internal user IDs, account metadata, password state, or raw
   credential/session tokens.
4. The web client renders the next existing login or signup step.
5. Existing login, signup, OTP, challenge, throttling, and session services
   perform the actual authentication or account creation.

The flow token should be purpose-bound, short-lived, single-use where
appropriate, and safe to abandon. It must not contain credentials or encode
the user identity in a client-readable form.

The API remains authoritative. The client must not probe separate endpoints to
discover whether an account exists, bypass a challenge, or decide whether a
signup is allowed.

## Reused APIs and logic

The new page should reuse existing frontend functions and shared UI wherever
possible:

- `login`
- `signUp`
- `startSignupEmail`
- `verifySignupEmail`
- `completeSignup`
- `verifyLoginChallenge`
- `getLoginApprovalStatus`
- `completeApprovedLogin`
- `requestPasswordReset`
- `checkUsernameAvailability`
- Session persistence, refresh, cooldown, error formatting, password criteria,
  OTP input, password visibility, and authentication completion logic

The backend should continue using the existing:

- Login identifier lookup and normalization
- Password verification and password policy
- Signup reservation and email OTP services
- Login-risk OTP and existing-session approval services
- Failed-login throttling and account-lock state
- Refresh-token/session issuance and revocation
- Reserved superadmin and bootstrap protections

The current `LoginScreen` is reused through an opt-in progressive mode. Its
default mode remains the existing `/login` state machine; avoid duplicating
authentication logic in the new route.

## Introduced redundancy and fallbacks

The additive design intentionally creates temporary route and presentation
redundancy:

- `/start` becomes the low-friction public entry point.
- `/login` remains the complete legacy/fallback flow.
- Existing signup routes and APIs remain available to preserve direct links,
  tests, and operational recovery.
- The public header can retain an explicit Login link during rollout.
- The authenticated Add-account modal continues using its current contract
  until the new flow is proven there separately.

This redundancy is deliberate and reversible. If `/start` fails, is disabled by
feature flag, or produces an unexpected flow state, the user can be redirected
to `/login` without changing credentials, sessions, or account state.

Do not remove the fallback until direct-login links, mobile behavior, account
switching, bootstrap login, recovery, and production/staging telemetry have
been validated.

## Privacy and security requirements

- Unknown identifiers and wrong passwords must not produce distinguishable
  login errors.
- Response timing for `POST /auth/progressive/start` must not vary detectably
  based on whether the identifier exists. Content-neutral responses are not
  sufficient if one branch performs additional account or device work.
- Do not expose a user ID, account status, reserved identity, or internal
  account metadata to the browser.
- Do not create an account merely because password login failed.
- Keep existing signup privacy behavior for an already-registered email. If the
  existing-email signup/sign-in-link behavior is used as a fallback, the
  browser response remains neutral and no account is created.
- Preserve all existing OTP, rate-limit, cooldown, lockout, and device-risk
  checks.
- OTP-skip or device-trust-based routing must be decided only after correct
  password verification. It must never be decided from an identifier plus a
  device cookie alone.
- Rate-limit progressive-entry requests and email delivery to prevent probing
  and email flooding.
- Keep flow tokens opaque, short-lived, purpose-bound, and non-reusable after
  terminal completion.
- Ensure retries and refreshes do not create duplicate reservations, accounts,
  sessions, or OTP messages beyond existing replacement rules.

The timing requirement is a security requirement, not a decision to expose
account state. An implementation may need to normalize or pad the faster path
so the progressive-start response does not provide a practical existence
oracle; the exact technique remains an implementation detail.

## Risks and mitigations

### Account enumeration

Different screens can reveal whether an email exists. Use neutral copy,
consistent response handling where practical, and do not expose account
metadata. The privacy impact of the server-authoritative branch must be
reviewed before enabling it publicly.

Timing must be reviewed alongside response content. A database lookup on both
paths is not enough if only the existing-account path performs extra work such
as device or account-slot checks. The progressive-start response must be
normalized or otherwise made indistinguishable in observable duration.

### Device-trust read order

The progressive start step receives an identifier before credentials. It must
not use that identifier plus a saved-browser/device cookie to skip OTP, reveal
trusted-device state, or choose a trusted-device login path. Device trust and
OTP-skip decisions remain downstream of successful password verification, as
they are in the current login contract.

### Wrong-password confusion

Users may expect signup after entering the wrong password. Keep them in login,
explain that the password did not match, and provide reset or alternate
sign-in actions.

### Existing sign-in-link conflict

The current signup flow has a privacy-preserving existing-email sign-in-link
behavior. The progressive flow must explicitly decide whether that link is a
secondary method for existing accounts or remains available only through the
legacy signup path. It must not accidentally create a second account path.

### Duplicate account or reservation creation

Use existing database constraints, reservation expiry, idempotency, and
server-side identity checks. The progressive start operation must not itself
create a user.

### Bootstrap/admin regression

Reserved admin identities must always resolve to ordinary login and remain
protected from public signup. Add explicit tests for both admin email and
username identifiers.

### Session and device regression

Successful login and signup must continue to create the same session, device
recognition, account-slot, and security-event behavior. Verify both standalone
and remembered-account contexts.

### Recovery and abandonment

Back navigation, refresh, expired flow tokens, delayed OTP delivery, and
partial signup must restart safely without leaking state or creating orphaned
accounts. A progressive flow token expires after its short server-side TTL and
is not reusable. If a new email reaches signup OTP and abandons the flow, the
existing signup reservation and OTP rules continue to apply: the reservation
expires under the existing 30-minute policy, the OTP remains subject to its
existing expiry/attempt limits, and a later start from the same or another
browser replaces the pending reservation and sends a fresh OTP through the
existing signup-email service. No account or authenticated session exists
until the existing signup completion step succeeds.

In the web UI, Back from the progressive signup OTP step returns to the
progressive identifier entry. Submitting again creates a fresh progressive
flow and reselects the server-authoritative continuation, so it cannot fall
through to the password step merely because the earlier OTP attempt was
abandoned.

## Verification matrix

Before making `/start` the primary public CTA, verify:

- Existing email with correct password on a recognized device
- Existing email with a new or suspicious device
- Existing username, including a leading `@`
- Existing account with wrong password and cooldown behavior
- Existing account password reset
- Phase 7 failed-login notification parity: confirm the third-failure trigger,
  current cooldown behavior (the former 30-minute Phase 7 cooldown is not the
  current contract), and asynchronous delivery fire identically whether the
  failed attempt originated from `/start` or `/login`.
- New email with signup OTP enabled
- New email with OTP disabled in permitted non-production environments
- Expired, invalid, reused, and replaced signup OTPs
- Existing-email sign-in-link behavior
- `admin@friink.com` and `@admin` bootstrap login
- Device-trust read order: confirm an identifier plus device cookie cannot skip
  OTP or reveal trusted-device status before correct password verification.
- Account lock and lifecycle states
- Browser refresh/back/retry during every step
- Mobile viewport and keyboard behavior
- Add-account flow remains unchanged
- Feature-flag fallback to `/login`
- Duplicate-submit and network-timeout recovery

## Analytics and rollout

Track the new flow separately from legacy login/signup:

- Entry starts
- Identifier submissions
- Existing-account login completion
- New-account OTP completion
- Password-step abandonment
- Login failure and reset selection
- OTP delivery and verification failures
- Fallback-to-`/login` rate
- Completion by device and viewport

Roll out in phases:

1. Build `/start` without changing `/login`.
2. Validate API and web behavior in development.
3. Test staging with the fallback enabled.
4. Expose `/start` through the public `Get started` CTA while retaining Login.
5. Compare completion and failure metrics.
6. Expand usage only after security, bootstrap, recovery, and mobile checks
   pass.

## Product decision

- **Neutral branch presentation:** The identifier step must not visibly reveal
  whether an account exists. The browser uses neutral continuation copy while
  the server selects the existing-account or new-email flow. The underlying
  credential or ownership step may differ only when required to continue the
  selected server-authoritative flow; it must not expose account metadata or
  use timing/content differences as an existence signal.

## Open product decisions

- Whether existing-account sign-in links should be offered on `/start` as a
  secondary method.
- Whether `/start` should eventually become the destination of all public
  Login links, or whether `/login` should remain permanently available.
- Whether the Add-account modal should adopt the same progressive entry later.

## Audit findings

The `/start` route and progressive start/continue endpoints are implemented
locally behind separate web/API feature flags. The public CTA is intentionally
not switched, and staging cross-origin cookie, latency, device-cookie, and
end-to-end parity verification remain required before rollout. `/login`,
signup, OTP, session, device-recognition, and account-slot behavior remain the
live source of truth.

### Current device-trust read order

The current implementation checks device trust only after correct password
verification:

1. `api/app/services/auth.py:348-400`, `authenticate_user()`, resolves the
   identifier, checks account state/cooldown, and verifies the password at
   line 390. It returns the authenticated user only after the password is
   correct.
2. `api/app/routers/auth.py:366-436`, `login()`, calls
   `authenticate_user()` at line 378. Only after that does it read the
   `friink_device_id` cookie at line 401, call `get_recognized_device()` at
   line 402, and evaluate `device_signals_changed()` at lines 403-405.
3. `api/app/services/session_service.py`, `get_recognized_device()`, hashes
   the cookie and looks up the user/device pair. The lookup requires both the
   authenticated user ID and the device-token hash; it is not identifier-only.
4. If a challenge is required, the route creates the login challenge and sends
   the OTP at `api/app/routers/auth.py:406-435`. Otherwise it calls
   `_issue_login_session()` at line 436, where the recognized device/session
   and account slot are created or reused.

Therefore `/start` must not use an identifier plus a device cookie to establish
trust, reveal trusted-device status, or skip the password step. This ordering
must remain true even if the progressive-entry endpoint performs an identifier
lookup before credentials are submitted.

### Timing and privacy findings

Neutral response content is not sufficient. If the existing-account path
performs additional database or device work, response timing could become an
account-existence oracle. The progressive-start response must not vary
detectably based on whether the identifier exists. Normalizing or padding the
faster path is a likely implementation technique, but the exact technique is
not decided here.

The earlier visible-branch contradiction is resolved in favor of the neutral
single-screen presentation. The identifier step must not reveal whether an
account exists. Existing-account password and new-email ownership steps remain
distinct server-authoritative continuations, but the browser must use neutral
copy and must not use content or timing differences as an existence signal.

### Current failed-login notification contract

The requested audit terminology refers to the former Phase 7 third-failure
30-minute cooldown. That is not the current contract. Today:

- `api/app/services/auth.py:403-451`, `register_failed_login()`, increments
  account failure state and triggers the notification condition on the third
  failure.
- `api/app/services/login_throttling.py:11-16` defines the active cooldowns as
  one minute for failures 4-5, five minutes for 6-8, and a capped fifteen
  minutes for 9+. The third failure has no cooldown.
- `api/app/services/auth.py:440-451` schedules
  `deliver_failed_login_alert` through FastAPI `BackgroundTasks`, so delivery
  is asynchronous and non-blocking.
- `api/app/services/failed_login_notifications.py` performs the alert work and
  creates the suspicious-login reset flow.

The verification matrix therefore requires `/start` and `/login` parity for
the third-failure notification, the current cooldown behavior, and
asynchronous delivery. It does not describe the superseded 30-minute policy as
live behavior.

### Other implementation gaps

- The new routing endpoint and flow token are proposals only; they must not be
  treated as existing APIs.
- Existing-email signup currently remains neutral, creates no signup
  reservation or signup OTP, and uses the registered-address sign-in-link
  behavior. This is defined in `RULES.md` and
  `packages/design/design.md`. Whether that link becomes a secondary method on
  `/start` remains an explicit product decision.
- A future `/start` implementation must reach the same failed-login path as
  `/login`, or demonstrate equivalent third-failure notification behavior. The
  current `/login` path passes `BackgroundTasks` into `authenticate_user()`;
  this is a future parity requirement, not a current regression.

No additional non-speculative gaps were identified in this documentation-only
audit. Flow-token replay, duplicate reservation races, and client recovery are
already documented as risks to verify once `/start` exists.

## Related rules and documentation

- `RULES.md` — authentication, signup privacy, login security, bootstrap, and
  session rules
- `docs/auth-and-session.md` — implemented auth/session contracts and rollout
  boundaries
- `docs/auth-and-session-mobile.md` — mobile auth flow requirements
- `docs/forget-password.md` — password recovery behavior
- `docs/failed-login-policy.md` — failed-login cooldown policy
- `docs/account-switcher.md` — Add-account and remembered-account behavior
- `packages/design/design.md` — auth surface and interaction contracts
