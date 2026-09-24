# Account Access

Account Access establishes, maintains, and ends a person's authenticated
access to Friink. It covers signup, login, verification, password recovery,
sessions, refresh, logout, device recognition, and switching between
independent accounts remembered on one web device.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-24T19:55:59Z
**Platforms:** Web and API; mobile requirements are deferred  
**Canonical sources:** [`docs/rules.md`](../rules.md), `api/app/routers/auth.py`, `web/lib/auth.ts`

---

## Canonical ownership

This document owns how Friink establishes and maintains authenticated account
access, including ordinary sessions and web account switching.

It does not own account deactivation, deletion, reactivation, or pending
deletion; those belong to [Account Lifecycle](./account-lifecycle.md). It does
not own the settings presentation; [Settings](./settings.md) owns that surface
while this document owns the underlying access and session semantics.

## Related units

- [Account Lifecycle](./account-lifecycle.md) — lifecycle states may prevent
  login, refresh, or switching and may end sessions.
- [Navigation](./navigation.md) — owns the shared TopBar and drawer surfaces
  that expose navigation and account-switcher entry points.
- [Settings](./settings.md) — exposes password, email, and active-session
  controls.
- [Notifications](./notifications.md) — receives login-security and failed-login
  events without controlling the authentication result.
- [Staff Admin](./staff-admin.md) — privileged access builds on ordinary access
  but has a separate step-up boundary.
- [Design System](../design-system.md) — shared form, modal, loading, error,
  and recovery presentation patterns.
- [Business Rules](../rules.md) — cross-unit rules are referenced rather than
  duplicated here.

---

## 1. Product definition

### Purpose

Allow people to create or access Friink accounts safely, remain signed in
through ordinary use, recover access when needed, and manage authenticated
devices and remembered accounts without exposing credentials or account
existence.

### Scope

- Signup and email ownership verification.
- Login by email or username.
- Login challenges, OTP, and existing-session approval.
- Password validation, password changes, and password recovery.
- Access JWTs, refresh-token cookies, rotation, and reuse detection.
- Device recognition and device-scoped remembered-account slots.
- Active-session listing and revocation.
- Logout and terminal-versus-recoverable failure handling.
- Add-account, account switching, remembered-account removal, and fallback.

### Non-goals

- Account lifecycle transitions; see [Account Lifecycle](./account-lifecycle.md).
- Account linking, merged identities, or shared security state.
- Billing, subscription entitlement, or professional registration.
- Public display of IP addresses, device fingerprints, tokens, hashes, or UUIDs.
- Mobile secure-storage implementation before a mobile client exists.

## 2. Actors, permissions, and security

### Actors

- **Signed-out visitor:** may start signup, login, or password recovery.
- **Authenticated user:** may use the active account and manage its sessions.
- **Existing signed-in session:** may approve or deny an eligible new-device
  login challenge.
- **API:** is authoritative for identity, credentials, risk, sessions, device
  slots, and authorization.
- **Email/outbox system:** may deliver security messages but must not determine
  the primary authentication result.

### Permissions and privacy

- Users may list and revoke only their own active sessions.
- The current session cannot be revoked through the other-session control.
- Account switching validates an opaque device slot server-side.
- Add-account authentication must not disturb the current account before the
  new authentication and session succeed.
- Unknown identifiers, wrong passwords, and existing-email signup recovery use
  neutral responses that do not reveal account existence.
- Passwords, OTPs, refresh tokens, token hashes, signing secrets, UUIDs, IP
  addresses, and device secrets must not appear in UI, logs, URLs, ordinary
  responses, or email content.

## 3. Domain model

### Entities

- **Account:** independent identity with normalized email, username, password
  hash, lifecycle state, and profile data.
- **Access token:** short-lived bearer JWT for authenticated API calls.
- **Refresh token:** opaque credential stored server-side by hash and rotated
  within a refresh-token family.
- **Auth session:** server-managed account session with device, refresh family,
  timestamps, and best-effort device metadata.
- **Recognized device:** server record associated with an opaque device cookie
  and coarse signals, separate from tokens and sessions.
- **Account session slot:** device-scoped remembered-account record with an
  opaque slot identifier, account association, recency, and active state.
- **Signup reservation, login challenge, password-reset token, and security
  event:** temporary or durable records supporting their respective flows.

### Relationships and states

- One account may have many active sessions.
- One device may remember multiple independent accounts up to the configured
  slot limit.
- A slot never grants access to another account; slot, device, session, and
  lifecycle state are validated together.

```text
Signed out → credentials accepted → verification required or session issued
Session issued → authenticated → refreshed or ended
Authenticated → logged out, revoked, expired, locked, or lifecycle-blocked
```

Login challenges are pending until exactly one of OTP verified, approved,
denied, or expired wins. Late responses cannot replace a terminal result.

## 4. Subunits

### 4.1 Signup and email ownership

#### UX and flows

With verification enabled, signup is email → six-character code → password and
profile details → account completion and authenticated setup. Resending a code
invalidates the previous code. Invalid, expired, or over-attempt codes show
recoverable feedback without creating an account.

The password step shows a left-aligned checklist whose satisfied requirements
use the accent color. The profile step presents username guidance with the same
left alignment and accent feedback when the 2–32 character allowed-character
rule is satisfied; server validation remains authoritative.

If the email already belongs to an account, the browser remains on the email
step with neutral copy. No signup reservation or signup OTP is created; a
separate single-use sign-in link may be sent to the registered address.

#### Business rules

- **ACCESS-R-001:** Email ownership is the signup verification boundary.
- **ACCESS-R-002:** Completed signup creates a normalized unique email,
  case-insensitive username identity, hashed password, public default
  visibility, and verified state.
- **ACCESS-R-003:** API and database constraints are authoritative for identity
  uniqueness and age validation.
- **ACCESS-R-004:** OTP configuration is API-owned; production keeps the master
  switch enabled.

#### Technical contract

- `POST /auth/signup` supports the direct path only when policy permits it.
- `POST /auth/signup/email/start` starts an email reservation.
- `POST /auth/signup/email/verify` verifies the code.
- `POST /auth/signup/complete` creates the verified account and session.
- `GET /auth/username-availability` is a pre-submit hint only.
- Signup codes are hashed, single-use, attempt-limited, short-lived, and
  invalidated when a newer code is issued.

#### Acceptance criteria

- [ ] **ACCESS-AC-001** Required signup verification cannot be bypassed.
- [ ] **ACCESS-AC-002** Existing-email signup remains neutral in the browser.
- [ ] **ACCESS-AC-003** Duplicate identity races are rejected authoritatively.
- [ ] **ACCESS-AC-004** Successful signup creates one authenticated session.
- [ ] **ACCESS-AC-005** Credentials and internal identifiers are not exposed.

### 4.2 Password and username login

#### UX and flows

The login field is labeled `Email or username`. A normal successful login
creates a session and opens the authenticated app. Unknown identifiers and
incorrect passwords use the same generic result. Progressive cooldowns preserve
the identifier, clear the password, disable submission, and show server-
provided remaining time. A full lock uses exactly `Your account is locked.
Contact support.`

#### Business rules

- **ACCESS-R-006:** Email and username matching is case-insensitive; a leading
  `@` may be stripped for username lookup.
- **ACCESS-R-007:** Passwords require at least eight characters, upper/lowercase
  letters, a number, a special character, no whitespace, and the current bcrypt
  byte limit.
- **ACCESS-R-008:** Failed-login behavior follows the active schedule in
  [`rules.md`](../rules.md) without exposing attempts, tiers, IPs, or device data.
- **ACCESS-R-009:** Ordinary account locking blocks password login and refresh;
  already-issued short-lived access JWTs are not force-invalidated solely by it.

#### Technical contract

`POST /auth/login` accepts the identifier contract and returns a session
response or verification/lifecycle challenge. A successful fresh login creates
one durable security event and one login-security notification idempotently;
delivery failure cannot change the authentication result.

#### Acceptance criteria

- [ ] **ACCESS-AC-006** Email and username login share identity and lockout rules.
- [ ] **ACCESS-AC-007** Unknown identifiers do not reveal account existence.
- [ ] **ACCESS-AC-008** Cooldown and full-lock copy remain distinct.
- [ ] **ACCESS-AC-009** Security-event failure cannot fail a successful login.

### 4.3 Risk verification and login approval

#### UX and flows

Credentials are submitted once. A new-device login completes through one path:
an emailed OTP or approval from an existing signed-in session. Approval shows
only coarse device details and Approve/Deny actions. Once one path begins, the
other cannot overwrite it.

#### Business rules and contract

- **ACCESS-R-010:** Risk is server-authoritative; recognized devices may proceed
  without OTP while new or suspicious devices may require it.
- **ACCESS-R-011:** OTP and approval cannot both complete one challenge.
- **ACCESS-R-012:** Existing sessions never display plaintext OTP or sensitive
  device metadata.
- Login pending, approval, denial, status, and completion operations are
  exposed through `api/app/routers/auth.py`.
- Challenge completion is serialized, single-use, short-lived, and bound to the
  intended login and device.

#### Acceptance criteria

- [ ] **ACCESS-AC-010** Recognized normal login does not show unnecessary OTP.
- [ ] **ACCESS-AC-011** Required new-device verification cannot be bypassed.
- [ ] **ACCESS-AC-012** Late responses cannot overwrite terminal results.
- [ ] **ACCESS-AC-013** Add-account failures preserve the active account.

### 4.4 Sessions, tokens, refresh, and logout

#### UX and flows

The web client sends its in-memory access token. After `401 TOKEN_EXPIRED`, it
performs one coordinated refresh and retries the original request once.
Network, timeout, CORS, 403, 5xx, malformed-response, and other recoverable
failures do not clear local session state. Only an explicit terminal refresh
response clears local state and redirects to `/login`.

On a full browser reload, the client may use the previously stored safe user
metadata to mount the application shell immediately while the refresh-cookie
exchange runs in the background. This cached metadata is presentation-only:
authenticated API effects and actions still wait for the in-memory access token
created by a successful refresh. A failed refresh returns to the existing
recovery surface.

The public landing route and authenticated app entry use the shared
`restoreAuthSessionForEntry()` contract. While the refresh-cookie exchange
runs, the loading recovery surface says “Reconnecting…” and “Just a moment
while we get you back in.” A successful refresh redirects an
already authenticated visitor to the app; a confirmed terminal refresh failure
shows the public landing page; and a recoverable network, timeout, CORS, or
server failure shows an explicit retry surface instead of silently treating the
visitor as signed out. Public pages that do not use this guard remain
accessible without authentication.

#### Multi-account terminal-session recovery

The current implementation first tries remembered slots after a confirmed
terminal refresh failure. The behavior is implemented locally and remains
subject to staging browser acceptance:

1. Preserve the device-scoped remembered-account summaries locally, without
   storing or replaying passwords.
2. Keep refresh coordination, cached session metadata, active-account state,
   and cross-tab notifications isolated by remembered account slot rather than
   using one origin-global namespace.
3. When the active account's refresh is terminal, try the remembered slots in
   most-recent order by calling the existing slot-aware refresh contract.
4. Restore the first slot whose refresh succeeds and refresh the account-
   scoped shell without exposing an intermediate signed-out state.
5. If no remembered slot can be restored, show `/login` with the most-recent
   remembered account preselected. Normal password authentication and any
   required OTP or device challenge remain mandatory; remembered metadata does
   not authenticate the account.

This flow applies to session expiry or revocation observed by the
active account. Explicit logout and account removal retain their existing
fallback semantics. The API's existing slot-aware refresh endpoint is the
intended contract; no schema change is expected for this recovery behavior.

#### Business rules and contract

- **ACCESS-R-014:** Access tokens use the current 30-minute implementation
  default.
- **ACCESS-R-015:** Refresh tokens are opaque, HttpOnly on web, stored by hash,
  and rotated within a token family.
- **ACCESS-R-016:** Presenting a rotated/revoked token revokes its family and
  records a durable security event, subject to bounded retry grace.
- **ACCESS-R-017:** Refresh is reactive and occurs only after `TOKEN_EXPIRED`.
- **ACCESS-R-018:** Ambiguous refresh failures preserve local access state.
- **ACCESS-R-019:** Logout revokes only the relevant session/family.
- `POST /auth/refresh` exchanges and rotates the refresh credential.
- `POST /auth/logout` revokes the relevant session/family and clears its cookie.
- JWT claims are minimal and stable: `sub`, `typ`, `iat`, and `exp`, with a key
  identifier in the header.

The active cross-unit contract is recorded in [`AUTH-R-038`](../rules.md) and
[`AUTH-R-040`](../rules.md). Staging browser acceptance remains open before
the release is considered complete.

#### Acceptance criteria

- [ ] **ACCESS-AC-014** Expired access tokens refresh once and retry once.
- [ ] **ACCESS-AC-015** Recoverable refresh failures preserve the session.
- [ ] **ACCESS-AC-016** Confirmed terminal refresh failure clears local state.
- [ ] **ACCESS-AC-017** Rotation and reuse detection are transactional and tested.
- [ ] **ACCESS-AC-018** Logout does not expose or retain raw credentials.
- [ ] **ACCESS-AC-026** A terminal refresh failure tries remembered slots in
      most-recent order without storing or replaying passwords.
- [ ] **ACCESS-AC-027** Refresh coordination and cached session state cannot
      cross-contaminate remembered account slots or tabs.
- [ ] **ACCESS-AC-028** A successful fallback restores the selected account;
      when all slots fail, login preselects the most-recent account and still
      requires normal credentials and any required challenge.

#### Decision record

- **MIG-001 — Refresh-token lifetime:** The current implementation and archived
  session-progress evidence use a 30-day default. Active `docs/rules.md` has
  been aligned to 30 days; no code change was required.

### 4.5 Active-session management

#### UX and flows

Settings > Account lists active sessions with best-effort device, browser,
operating-system, logged-in, and last-active information. The server identifies
the current session from the presented refresh credential. Other sessions may
be revoked individually or through `Log out other sessions`.

#### Business rules and contract

- **ACCESS-R-020:** Users may inspect or revoke only their own sessions.
- **ACCESS-R-021:** The current session is protected and survives revoke-others.
- **ACCESS-R-022:** Missing device metadata renders an explicit fallback.
- **ACCESS-R-023:** Ordinary revocation does not promise retroactive invalidation
  of already-issued access JWTs.
- `GET /auth/sessions` lists sessions; the two revoke endpoints manage them.
- The client never supplies the identity of the current session.

### 4.6 Device-scoped account switching

#### UX and flows

`Add account` opens the existing login/signup modal. The current account remains
active until new authentication, session, and slot establishment succeed.

Selecting a remembered account shows a spinner, disables competing account
actions, validates the slot, and updates the shell in place. Removing or
logging out the active account selects the most-recent remaining valid account,
or returns to the public site when none remain.

The account switcher header includes an accessible `Beta` badge. This is a
disclosure that the account-switching experience is still being stabilized; it
does not change account limits, authorization, session behavior, or access.
The menu keeps a viewport-safe fixed width, truncates long account labels before
the trailing controls, and contains row hover surfaces within its padded bounds.
Its width is capped at `min(16rem, calc(100vw - 1rem))`; the header status
control remains visible when account labels are long.

#### Business rules and contract

- **ACCESS-R-024:** Remembered accounts are device-scoped slots, not account
  relationships.
- **ACCESS-R-025:** Switching validates opaque slot, device, session, and
  lifecycle state server-side.
- **ACCESS-R-026:** The default slot limit is four; the operational range is
  one through sixteen and limits slots, not account creation.
- **ACCESS-R-027:** Adding an already remembered account reuses its slot.
- **ACCESS-R-028:** Switching refreshes account-scoped shell, feed,
  notifications, drafts, and active-session state.
- **ACCESS-R-029:** Failed list, add, switch, logout, refresh, or slot operations
  preserve the active account and expose retryable feedback.
- **ACCESS-R-030:** Active logout selects the most-recent remaining valid slot
  or the public site.
- `GET /auth/accounts` returns safe device-scoped summaries.
- `GET /auth/accounts/add-availability` reports whether another account may be
  added.
- `POST /auth/accounts/switch` accepts an opaque slot.
- `DELETE /auth/accounts/{account_slot}` removes a remembered slot.

#### Acceptance criteria

- [ ] **ACCESS-AC-019** Account menus show safe server-provided summaries.
- [ ] **ACCESS-AC-020** Switching validates slot and device server-side.
- [ ] **ACCESS-AC-021** Failed switching preserves the current account.
- [ ] **ACCESS-AC-022** Add-account preserves the existing device identity.
- [ ] **ACCESS-AC-023** The slot limit blocks additions without breaking login.
- [ ] **ACCESS-AC-024** Active logout follows the correct fallback.
- [ ] **ACCESS-AC-025** Reload and cross-tab updates do not leak account state.

#### Test scenarios

- New signup, verification, existing-email privacy, password login, username
  login, lockout, password recovery, and challenge completion.
- Expired access, refresh rotation, reuse detection, ambiguous failure, logout,
  session listing, individual revocation, and revoke-others.
- Add, switch, remove, logout, fallback, account limit, reload, two-tab,
  delayed-response, duplicate-click, and wrong-device scenarios.
- Confirm no credential, token, UUID, IP, or device secret appears in UI,
  storage, responses, emails, or logs.
- Planned recovery coverage: terminal refresh failure with a valid second
  slot, all remembered slots invalid, concurrent tabs on different slots,
  delayed refresh responses, and required OTP/device challenge after fallback
  to login.

#### Implementation plan and rollout status

The remaining web/API work is organized into three dependent workstreams:

1. **Diagnose and fix the Add account limit mismatch.** Compare the same
   browser's `friink_device_id` context across `GET /auth/accounts`,
   `GET /auth/accounts/add-availability`, and the final Add account login
   request. Inspect the configured `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` value
   and redacted account-slot logs. Reproduce after repeated refreshes, normal
   login, switching, and logout. The fix must preserve the active account when
   an Add account attempt fails and must prove that refreshes do not create
   duplicate slots.
2. **Implement terminal-session recovery.** After a terminal refresh failure,
   try remembered slots in most-recent order through the existing slot-aware
   refresh contract. Restore the first valid account and its account-scoped
   shell. If all slots fail, show login with the most-recent account
   preselected while still requiring normal credentials and any required OTP or
   device challenge. Passwords must never be stored or replayed.
3. **Isolate multi-account client state.** Scope cached user metadata,
   active-account state, refresh coordination, refresh locks, and cross-tab
   notifications by account slot. Stale or delayed responses must not restore
   the wrong account, and explicit logout/removal fallback behavior must remain
   intact.

The implementation order was workstream 1, then workstream 3, then workstream
2. Workstream 1 now has a local API regression test; workstreams 2 and 3 have
local TypeScript/build verification. Each workstream still requires browser checks for
   clean and existing multi-account profiles, including concurrent tabs and
   delayed responses. The current API slot-aware refresh contract is expected
to be sufficient; no schema migration is planned unless implementation
evidence contradicts that assumption. Active rules now describe the local
implementation; staging acceptance remains a release gate.

## 5. Cross-subunit behavior

- Signup, login, Add-account, and switching eventually use the session and
  refresh contract in §4.4.
- Password reset and lifecycle actions may revoke sessions; their product
  meaning remains owned by [Account Lifecycle](./account-lifecycle.md).
- Switching changes active identity but never merges notifications, drafts,
  relationships, permissions, or other account data.
- Security-event and notification delivery failures never roll back committed
  authentication.

## 6. Technical architecture

### Components and ownership

- API boundary: `api/app/routers/auth.py`.
- Services: `auth.py`, `session_service.py`, `session_ops.py`,
  `account_slots.py`, `login_challenges.py`, and `password_reset.py`.
- Persistence: user, auth-session, refresh-token, account-slot,
  recognized-device, OTP, challenge, password-reset, and security-event models.
- Web access client: `web/lib/auth.ts`.
- Login UI: `web/components/login-screen.tsx`.
- Account menu and shell: `web/components/side-drawer.tsx`,
  `app-shell.tsx`, and `app-shell-route.tsx`.

### Storage and persistence

Protect passwords, refresh tokens, OTPs, and device identifiers as specified by
their contracts. Enforce identity uniqueness, token rotation, challenge
completion, and slot operations server-side and transactionally where required.

### Events and observability

Security events may cover fresh login, failed login, refresh, logout, challenges,
and refresh-token reuse. Event keys and notification creation are idempotent.
Log only redacted categories and stable event keys; never log secrets,
credentials, cookies, IPs, or internal identifiers.

## 7. Testing and verification

### Traceability matrix

| ID | Requirement | Verification | Status |
|---|---|---|---|
| ACCESS-R-017 | Reactive refresh after expiry | Web auth refresh tests | Implemented |
| ACCESS-R-018 | Recoverable refresh preserves access | Token resilience tests | Implemented |
| ACCESS-R-026 | Configurable slot limit | `api/tests/test_phase4_accounts.py` | Implemented |
| ACCESS-R-029 | Failed operations preserve active account | Account isolation tests | Implemented |
| ACCESS-R-030 | Logout fallback | Active-slot logout test | Implemented |
| ACCESS-R-014/015 | Token lifetime and refresh contract | Configuration/token tests | Documented — MIG-001 |
| ACCESS-AC-026 | Terminal-refresh recovery tries remembered slots | Planned slot-recovery test | Implemented locally — staging pending |
| ACCESS-AC-027 | Client session state is isolated per slot | Planned cross-tab isolation test | Implemented locally — staging pending |
| ACCESS-AC-028 | Fallback restores an account or returns to credentialed login | Planned recovery-flow test | Implemented locally — staging pending |

### Release gates

- Auth/session tests pass in the target environment.
- Deployed cookie, CORS, API-origin, and refresh behavior is verified.
- Multiple-account flows pass from a clean browser profile.
- Production-parity staging OTP and signing-key configuration are verified.
- The exact staging-verified artifact is promoted to production, followed by
  basic production smoke checks only.
- [x] `MIG-001` is resolved: the active rule and current 30-day implementation
      now agree.

### Manual verification

Verify login, reload, refresh, logout, recovery, new-device verification,
active-session controls, add/switch/remove/fallback, two-tab coordination, and
the absence of secrets or internal identifiers in UI, storage, responses, and
logs.

## 8. Current implementation status

- Signup, login, password recovery, access JWTs, refresh rotation, logout,
  session listing/revocation, device recognition, login approval, and web
  account switching exist in the current web/API implementation.
- Mobile authentication and secure-storage behavior are deferred.
- The default refresh-token lifetime is 30 days in the active rule and current
  implementation; `MIG-001` records the historical documentation mismatch.
- Email delivery and some deployment/release evidence remain environment-
  dependent verification gates.
- Implemented locally: multi-account recovery after terminal refresh failure,
  per-account-slot client coordination, and stale-slot capacity handling.
  Staging browser acceptance remains pending.
- Open staging verification: Add account previously reported a full
  remembered-account limit while the browser showed only one account; the
  local fix and regression test are recorded in [`docs/notes.md`](../notes.md).

## 9. Rebuild checklist

- [ ] Implement identity normalization, validation, uniqueness, and privacy.
- [ ] Implement signup, verification, login, risk challenges, and recovery.
- [ ] Implement access-token validation and refresh rotation.
- [ ] Implement terminal versus ambiguous failure handling.
- [ ] Implement active-session listing and revocation.
- [ ] Implement device recognition and account slots.
- [ ] Implement switching, isolation, fallback, and account limits.
- [x] Implement terminal-refresh recovery across remembered slots and isolate
      client coordination state per slot locally; staging acceptance pending.
- [ ] Implement durable security events and notification isolation.
- [ ] Implement permissions, privacy, and secret-redaction boundaries.
- [x] Apply and verify the documented 30-day refresh-token lifetime.
- [ ] Run automated and manual verification for all acceptance criteria.

## Changelog

The repository [`CHANGELOG.md`](../../CHANGELOG.md) is authoritative for
project-wide history. This section records changes specific to this unit.

- 2026-09-12 — Migrated account-access behavior from archived documents, active
  rules, and implementation evidence; resolved `MIG-001` by aligning the active
  rule to the existing 30-day implementation.
- 2026-09-21 — Documented the planned multi-account terminal-session recovery
  flow, its credential/challenge boundary, and the expected no-schema-change
  implementation path; active rules remain unchanged until implementation.
- 2026-09-21 — Added the three-workstream implementation plan for the
  add-account limit mismatch, terminal-session recovery, and per-slot client
  state isolation.
- 2026-09-21 — Implemented the stale-slot capacity fix, slot-scoped web
  session coordination, remembered-slot recovery, and recent-account login
  preselection; local tests/build pass and staging acceptance remains open.
