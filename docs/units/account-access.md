# Account Access

Account Access establishes, maintains, and ends a person's authenticated
access to Friink. It covers signup, login, verification, password recovery,
sessions, refresh, logout, device recognition, and switching between
independent accounts remembered on one web device.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-29T12:09:15Z
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

- [Account Lifecycle](./account-lifecycle.md) — owns deactivation, deletion,
  pending deletion, and reactivation; this unit records their effects on
  authentication and session restoration.
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
- [Error Handling](./error-handling.md) — planned cross-product error
  presentation requirements; this unit remains authoritative for session
  validity and recovery semantics.
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
Contact support.` Network-level request failures use the friendly copy,
“We couldn’t reach Friink just now. Please try again.” The form does not show
raw browser fetch errors or present a network failure as a password rejection.

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
- [ ] **ACCESS-AC-046** Network-level auth failures use friendly retry copy and
      do not expose raw browser fetch errors.

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

The web client keeps its access JWT in memory and the API also sets a
short-lived HttpOnly access cookie for the selected account slot. The JWT is
bound to its server-side session with `sid`. On full document entry, the app
validates `/auth/me` with the slot cookie first; a valid access cookie restores
the user without rotating the refresh cookie. Only an expired or absent access
cookie causes one slot-captured refresh exchange and a single retried request.
Network, timeout, CORS, 403, 5xx, malformed-response, and other ambiguous
failures preserve the remembered identity and show retryable in-app recovery.
Cookie-authenticated unsafe API requests enforce allowed-Origin checks.
Access and refresh credentials are HttpOnly; browser-readable storage and
cross-tab messages contain no bearer tokens.

The active account selection is client-wide, not tab-local. Adding an account
or switching accounts updates the shared selected-slot key. Other open tabs
reload when that key changes, then restore and render only the selected slot.
Legacy tab-local slot values do not override the shared selection.

The web app uses the nonnegative integer `friink_session_hint` cookie only to
choose public-site routing. Saving a session, including after an access-token
refresh, writes `1` and renews its 30-day expiry. Clearing a session keeps it at
`1` when another remembered account slot remains, and writes `0` when none
remain. The `/` server page redirects to `/home` only for a valid positive
integer; zero, missing, or invalid values render the public route. The legacy
`/subscriptions` URL permanently redirects to `/settings/subscription`. The
cookie contains no credential or account identifier and never grants access.

When the hint is absent, public content renders immediately and the existing
non-blocking `/auth/entry-status` request remains as a compatibility path for
sessions created before this hint was introduced. That API response treats any
access or refresh cookie, including cookies scoped to other account slots,
only as a reason to try restoration; it does not establish that a session is
valid or call refresh merely to decide whether public content can render. If no
valid remembered session exists, the visitor remains on the public site. When
one or more sessions validate, the client restores its most recently used
account. Protected app routes remain authoritative before exposing private
data or actions.

**Implementation update (staging verification pending):** the authenticated API sometimes indicates that
session restoration may be attempted from `/auth/entry-status`; a positive
`friink_session_hint` also routes `/` to `/home` before session validation.
The hint and entry-status response are not proof that a session is valid. A
confirmed terminal failure from `PublicRouteGuard` now clears the hint and
leaves the visitor on the public route, avoiding an immediate return to
`/home`. App recovery also clears the hint after every remembered candidate
has failed before returning to `/`. Staging acceptance is pending. The history
of this loop is tracked in
[BUG-AUTH-007](../bugs.md#bug-auth-007--terminal-session-recovery-can-loop-between-public-site-and-app).
The exact state of the browser involved in the reported incident remains
unverified.

#### Session recovery surfaces and route behavior

This section owns the client experience when session restoration fails; the
server's session and lifecycle decisions remain authoritative. A technically
ambiguous error does not mean the session ended. A confirmed terminal result
shows a blocking `Session ended` modal with neutral copy, available remembered
accounts, and Add account. Selecting a remembered account validates that slot
before continuing. Cancel and close restore the most recently used valid
remembered account, or clear the redirect hint and return to the public site
when none remains. Lifecycle state and the associated reactivation or
deletion-cancellation rules belong to
[Account Lifecycle](./account-lifecycle.md).

Current web entry points do not all present the same recovery surface:

- **Protected app-shell routes** (including Home, Settings, Saved, Directory,
  Notifications, and app-level Chat) replace the app shell with the full-screen
  `SessionRecoveryScreen` while restoration is pending or unavailable. An
  ambiguous failure offers retry and recovery actions. A terminal failure
  opens a `Session ended` modal with the neutral copy “Your session has ended.
  Choose how you’d like to continue.” Available remembered accounts appear
  below the copy. Selecting one validates and restores it; Add account opens
  the existing login/signup modal. Cancel and close restore the most recently
  used valid remembered account, or clear the session hint and return to the
  public site when none remains.
- **Public root (`/`)** redirects server-side to `/home` when the hint is a
  positive integer. With zero, missing, or malformed hint it renders the
  public site, where `PublicRouteGuard` can still call `/auth/entry-status` and
  attempt restoration. On terminal failure the guard clears the redirect hint
  and remains on the public route; network and other ambiguous failures retain
  retryable recovery behavior.
- **Profile routes (`/{username}`)** use the standalone recovery screen while
  loading or on ambiguous failure; confirmed terminal session failure routes
  to `/login` with a recovery reason.
- **Post detail routes (`/posts/{postId}` and `/{username}/{postId}`)** route
  to `/login` on terminal session failure. A post lookup that cannot resolve
  its target can instead return to `/`.
- **Username-specific chat (`/{username}/chat`)** routes to `/login` only if
  restoration for that route fails terminally. This is not the behavior for an
  ordinary chat API error. A missing or invalid chat context can return to `/`.
- **Login (`/login`)** attempts restoration on entry. A valid session sends
  the user to `/home`; a failed attempt leaves the login form and an explanatory
  message available for signing in again.

These are current implementation facts, not a shared UX contract. In
particular, several route-specific paths replace the app with a full-screen
recovery surface or navigate to login/public pages instead of keeping recovery
on the originating app route. `friink_session_hint` cannot prevent those client
paths: it is only a routing hint. The confirmed public-entry loop risk—zero
hint followed by the client guard, or a stale positive hint after fallback—is
tracked in [BUG-AUTH-007](../bugs.md#bug-auth-007--terminal-session-recovery-can-loop-between-public-site-and-app).
The exact cookie, remembered-slot, and API state for the reported browser loop
is unknown.

Failure cases are distinct:

1. **Technical/ambiguous failure:** timeout, network or CORS failure, `403`,
   `5xx`, or malformed response does not prove session termination. Entry
   recovery makes four total attempts, ten seconds apart for non-network
   ambiguity, without changing identity. A detected network failure immediately
   shows a full-page in-app network error with **Refresh**; background restore attempts continue every 30 seconds,
   and **Refresh** starts an immediate attempt without reloading the page.
   Neither path may overlap another restore request. Do not show account choice
   or assert session termination until the server responds. Other ambiguous
   failures retain the in-app **Take me back** recovery page. Public visitors
   without cached account context remain on the public site.
2. **Confirmed terminal session:** show the shared neutral `Session ended`
   modal with available remembered-account choices and Add account. Selecting
   an account validates it before switching. Cancel/close tries the
   most-recent valid fallback and returns to the public site with redirect
   hint zero if none restores. Never silently switch identity.
3. **Remote logout or security revocation:** use the same session-ended modal
   and recovery actions as other confirmed terminal results.
4. **Deactivation or pending deletion:** the initiating client logs out
   immediately after the lifecycle operation succeeds, then restores another
   valid remembered session or returns to `/`. Other clients show the lifecycle
   neutral session-ended modal first, then use the same account choices,
   Add account, or Cancel/close fallback.
   Lifecycle reactivation or deletion cancellation remains a separate flow.

The session-ended modal is coordinated across the browser client. Other tabs
wait while the notice-owning tab acts, then converge on the same restored
account or public-site outcome; if the owner closes before acting, another tab
may take over. Multi-tab browser and staging acceptance remain pending.

#### Multi-account terminal-session recovery

When a current session is confirmed ended, Friink shows the neutral copy
“Your session has ended. Choose how you’d like to continue.” Available
remembered accounts appear as choices, and Add account opens the existing
login/signup modal. Cancel and close try remembered accounts in most-recent-use
order, then return to `/` with the redirect hint set to zero if none can be
restored. For deactivation/pending deletion, the initiating client immediately
logs out after the successful lifecycle operation; another client uses these
same recovery choices. Friink never renders a candidate's data before that
slot has validated. The recovery flow is:

1. Preserve the device-scoped remembered-account summaries locally, without
   storing or replaying passwords.
2. Coordination keys, state reads/writes, and refresh requests use one captured
   account slot. Ordinary refresh results are checked against the still-active
   slot before persistence.
3. On confirmed terminal failure, clear the in-memory credential for that
   account and keep only safe recovery context. Show neutral session-ended
   copy and available account choices. Add account reuses login/signup; Cancel
   and close validate fallback sessions by recency before returning public.
4. A timeout, network/CORS failure, `403`, `5xx`, malformed response, or other
   ambiguous failure does not prove that the session ended. Keep the user in
   retryable recovery without changing identity. During detected network
   failure, show the full-page network error and allow a manual **Refresh**
   while background restore continues without overlapping requests.
5. Ambiguous entry recovery retries four times at ten-second intervals. After
   exhaustion, **Take me back** opens the remembered-account choice when one is
   available, with Login as the alternative. A user-selected account is
   validated before activation.
6. Show one terminal modal for the browser client. Other open tabs wait while
   the owner acts, then converge on the same restored account or public site.
   If the tab showing the modal closes before acting, another tab can take
   ownership and show it.

This flow applies when a session ends remotely, an account is deactivated or
scheduled for deletion, or another terminal session failure is confirmed.
Explicit logout is user-initiated and proceeds directly to the newest valid
remaining slot or public site; removing a slot ends that remembered session.
The slot-aware API validates fallback candidates without a schema change.
Prior staging testing confirmed refresh-token reuse and observed the earlier
silent-fallback behavior. Its duplicate-request origin remains unknown. Both
defects and local fixes are tracked in
[BUG-AUTH-003](../bugs.md#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session)
and [BUG-AUTH-004](../bugs.md#bug-auth-004--successfully-restored-account-remains-last-in-the-switcher).

#### Refresh coordination and recovery contract

- Use one captured active-slot value for both refresh coordination and the
  refresh request, and verify it is still active before saving the response.
- A confirmed terminal failure presents the neutral `Session ended` modal.
  Selecting a listed remembered account validates that slot before switching;
  Add account reuses the existing login/signup flow. Cancel and close attempt
  valid remembered accounts in most-recent-use order, then return to the public
  site with the redirect hint set to zero when none can be restored. Ambiguous
  failures keep the active identity in retryable recovery; they never cause a
  silent switch.
- A single tab owns the browser-client termination notice. Other tabs wait for
  acknowledgment and converge after the owner switches to a valid account or
  clears the active selection; if the owner tab closes, another tab can take
  over.
- Keep refresh retries idempotent without weakening stale-token detection:
  while its deterministic successor remains active, the original recorded
  operation ID can recover that same child after grace; any operation ID can
  recover that same child within the configured grace window; a different
  operation ID after grace still revokes the family. Legacy rows without a
  deterministic successor retain one-time grace recovery.
- Persist a successful restore's `last_used_at` update in the same transaction
  as the refresh rotation, so the server's account-list order reflects recency.

These decisions are tracked by [BUG-AUTH-003](../bugs.md#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session)
and [BUG-AUTH-004](../bugs.md#bug-auth-004--successfully-restored-account-remains-last-in-the-switcher).

#### Refresh stability and failure handling

[BUG-AUTH-003](../bugs.md#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session)
records the previously reported reload-time refresh rotation and session loss;
the fix is implemented and deployed to staging. A short-lived HTTP-only access
cookie per slot lets a normal reload reuse a valid access credential without
rotating the refresh cookie. Refresh rotation is reactive to access expiry and retains the API's
bounded retry grace and family-reuse detection. Cookie-authenticated unsafe
requests enforce allowed-Origin checks. A tab that observes another tab's
refresh revalidates with its own slot access cookie instead of rotating again.
The historical cause of the stale-token replays remains unknown; see the bug
record for details.

#### Multi-account session continuity policy

On public entry, when one or more remembered sessions are valid, restore the
most recently used one. During terminal recovery, users can select an available
remembered account or Add account. Cancel and close try the most recently used
remaining session before returning to the public site.
A remembered-account row alone is not proof that its session is valid;
validate each candidate's own slot-scoped session before exposing that
account's app state. A session is restorable while its refresh token remains
valid and neither the session nor account has ended. A temporary connection
problem does not invalidate it and must leave retry available.

- Treat the account currently in use as most recent. If accounts were last
  used in the order one, two, three, then three is active and two is next in
  recency order.
- A user-initiated logout proceeds directly to the next most recently used
  valid remembered account. Terminal recovery shows the neutral session-ended
  modal with available remembered accounts and Add account. Cancel and close
  validate remaining slots by recency; the
  initiating client logs out immediately after the lifecycle operation
  succeeds. Never switch identity on timeout, network failure, or another
  ambiguous/recoverable result.
- Show the terminal modal once across the browser client. Other tabs wait while
  the owner acts, then follow the same restored account or public-site result.
  If the owner tab closes, another tab may take over and present it.
- Non-network ambiguous entry recovery makes four total attempts at 10-second intervals.
  Network failure immediately uses a full-page network error, background restore every 30
  seconds, and a manual **Refresh** action; other unresolved ambiguous failures show
  **Take me back**. Do not treat a transient failure as proof that the session
  ended or silently change identity.
- If no remembered session validates after confirmed termination or explicit
  logout, clear the selected account and go to the public site. Preserve each
  account's identity boundary and never show one account's state while another
  account is still being validated.

This continuity policy is implemented and deployed to staging. The resolved
reload-stability change is tracked by
[BUG-AUTH-003](../bugs.md#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session).
The broader multi-account continuity matrix remains a release verification
item.

#### Business rules and contract

- **ACCESS-R-014:** Access tokens use the current 30-minute implementation
  default.
- **ACCESS-R-015:** Refresh tokens are opaque, HttpOnly on web, stored by hash,
  and rotated within a token family.
- **ACCESS-R-016:** Presenting a rotated/revoked token revokes its family and
  records a durable security event, subject to bounded retry grace.
- **ACCESS-R-031:** A confirmed terminal failure presents the neutral
  `Session ended` modal with available remembered accounts and Add account.
  Selecting an account validates it before switching. Cancel and close restore
  the most recently used valid account or return to the public site with the
  redirect hint set to zero. Ambiguous failures never silently switch identity;
  non-network entry recovery retries four times at 10-second intervals.
  Network failure immediately shows a full-page error with manual **Refresh**
  and background retry every 30 seconds; other unresolved ambiguity offers
  **Take me back**.
- **ACCESS-R-032:** Refresh coordination, request headers, and result state use
  one slot captured at operation start.
- **ACCESS-R-033:** Successful refresh persists slot recency in the same
  transaction as token rotation.
- **ACCESS-R-034:** Adding or switching accounts updates one client-wide
  selected slot; every other open tab reloads and restores that selection.
- **ACCESS-R-043:** Account-switch requests identify the authenticated source
  slot in `X-Friink-Account-Slot` and the destination slot in the request body.
  An unavailable destination must not be reported as termination of the valid
  source session or clear it in the client.
- **ACCESS-R-044:** Account switches are serialized across tabs. A switch reads
  its source session after acquiring the shared lock, commits the selected slot
  before releasing it, and restores retry when the selected slot changes during
  `/auth/me` validation so a stale response cannot reclaim the prior account.
- **ACCESS-R-035:** A confirmed terminated session shows one neutral
  session-ended modal across the browser client. Users can restore a listed
  remembered account or Add account; Cancel and close validate remaining
  sessions by recency and return to public if none validates. If the owner tab
  closes, another tab can take ownership. Ambiguous failures remain retryable
  and do not switch.
- **ACCESS-R-017:** Refresh is reactive and occurs only after `TOKEN_EXPIRED`
  or a missing/expired access cookie during session restoration.
- **ACCESS-R-018:** Ambiguous refresh failures preserve local access state.
- **ACCESS-R-019:** Logout revokes only the relevant session/family.
- `POST /auth/refresh` exchanges and rotates the refresh credential.
- `POST /auth/logout` revokes the relevant session/family and clears its cookie.
- JWT claims include `sub`, `typ`, `iat`, `exp`, and the active session `sid`,
  with a key identifier in the header. `sid` lets the API reject access after
  server-side session revocation.

The active cross-unit contract is recorded in [`AUTH-R-038`](../rules.md) and
[`AUTH-R-040`](../rules.md). Staging browser acceptance remains open before
the release is considered complete.

#### Acceptance criteria

- [ ] **ACCESS-AC-014** Expired access tokens refresh once and retry once.
- [ ] **ACCESS-AC-015** Recoverable refresh failures preserve the session.
- [x] **ACCESS-AC-016** Confirmed terminal refresh failure clears in-memory
      credentials while retaining only safe recovery context.
- [ ] **ACCESS-AC-017** Rotation and reuse detection are transactional and tested.
- [ ] **ACCESS-AC-018** Logout does not expose or retain raw credentials.
- [ ] **ACCESS-AC-026** Confirmed terminal failures show neutral recovery copy,
      available remembered accounts, and Add account. Selecting an account
      validates it; Cancel/close restore the most recently used valid account
      or return to the public site with the redirect hint set to zero.
- [x] **ACCESS-AC-027** Refresh coordination and requests use the same captured
      slot and isolate state across remembered slots.
- [x] **ACCESS-AC-028** Explicit slot recovery changes the app only after that
      slot validates successfully.
- [ ] **ACCESS-AC-042** After all remembered slots fail validation, public
      entry remains public and does not route back into terminal recovery;
      zero hint and stale cached summaries are covered.
- [ ] **ACCESS-AC-043** Session restore failures across protected app, public,
      profile, post, username-chat, and login entry points provide a coherent
      recovery path, including the full-page network state, without confusing
      chat/content failures with session loss.
- [ ] **ACCESS-AC-044** A failed switch to another account keeps the valid
      source account active and reports the destination failure without opening
      terminal session recovery.
- [ ] **ACCESS-AC-047** The session-ended modal uses the same neutral copy with
      zero or more available account rows, reuses the login/signup Add account
      flow, and routes Cancel/close to the most recent valid account or the
      public site with a zero redirect hint.
- [x] **ACCESS-AC-029** A valid access cookie survives a full reload without
      refresh-cookie rotation; expired access performs one coordinated,
      slot-correct refresh while replay detection remains active.
- [ ] **ACCESS-AC-030** An interrupted or repeated expiry-time refresh recovers
      idempotently within the reviewed retry condition, without silently
      switching accounts or disabling family-reuse detection.
- [x] **ACCESS-AC-031** A public landing visit with no session renders without
      a blocking restore screen or refresh exchange; protected routes still
      reject unauthenticated requests.
- [x] **ACCESS-AC-041** A nonnegative integer web-origin redirect hint sends
      `/` to `/home` only when its value is greater than zero; zero or invalid
      values leave the public content rendered. `/subscriptions` redirects to
      the in-app Subscription settings route.
- [ ] **ACCESS-AC-032** Ordinary expiry, remote termination, and security
      revocation require explicit restore-or-login choice. Lifecycle recovery
      validates remaining accounts in most-recent-use order after the cause is
      acknowledged; invalid candidates are skipped without crossing account
      data boundaries.
- [ ] **ACCESS-AC-033** An ambiguous entry failure never changes identity,
      retries four times at 10-second intervals, then offers **Take me back**.
      Public visitors without remembered auth context remain on the public
      site.
- [ ] **ACCESS-AC-034** If no remembered account is available after ordinary
      expiry, go to Login. If lifecycle fallback has no valid account, return
      to the public site. Explicit logout may proceed directly to its existing
      fallback.
- [ ] **ACCESS-AC-038** A terminal cause is explained to the user, including
      remote termination, deactivation, pending deletion, expiry, or a security
      action; no terminal failure silently changes accounts.

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

When `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE=1`, the web app hides the account
switcher only when one account is available on the device. If multiple accounts
were already remembered before the limit was lowered, the switcher remains
available so the user can move between them; `Add account` is hidden because
the API reports that no additional account can be added. Existing remembered
slots are not silently revoked. Ordinary sign-in and logout remain available.
If the device is at capacity, a normal login may create an un-slotted session
that is not remembered by the account switcher.

Selecting a remembered account sends a switch request, validates the slot, and
updates the shell in place. If switching fails, the current account remains
active and a toast says, “Couldn’t switch accounts. Please try again.” Removing or
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
  one through sixteen and limits remembered slots, not account creation. When
  the limit is one, the API disables account addition. The web app hides the
  Add account action when capacity is reached and hides the switcher only when
  there is at most one available account. Existing multiple slots remain
  switchable if the limit is lowered; ordinary sign-in remains available.
- **ACCESS-R-027:** Adding an already remembered account reuses its slot.
- **ACCESS-R-028:** Switching refreshes account-scoped shell, feed,
  notifications, drafts, and active-session state.
- **ACCESS-R-029:** Failed list, add, switch, logout, refresh, or slot operations
  preserve the active account and expose retryable feedback.
- **ACCESS-R-030:** Active logout selects the most-recent remaining valid slot
  or the public site.
- `GET /auth/accounts` returns safe device-scoped summaries.
- `GET /auth/accounts/add-availability` reports whether another account may be
  added and whether the switcher should be shown, based on the configured limit
  and the number of accounts already available on the device.
- `POST /auth/accounts/switch` accepts an opaque slot.
- `DELETE /auth/accounts/{account_slot}` removes a remembered slot.

#### Acceptance criteria

- [ ] **ACCESS-AC-019** Account menus show safe server-provided summaries.
- [ ] **ACCESS-AC-020** Switching validates slot and device server-side.
- [ ] **ACCESS-AC-021** Failed switching preserves the current account.
- [ ] **ACCESS-AC-022** Add-account preserves the existing device identity.
- [ ] **ACCESS-AC-023** The slot limit blocks additions without breaking login.
- [ ] **ACCESS-AC-039** With the configured slot limit set to one and one
      available account, the API reports switching disabled and the web app
      hides the switcher; ordinary sign-in and logout remain available.
- [ ] **ACCESS-AC-040** If the limit is lowered to one while multiple accounts
      are already remembered, switching remains available and Add account is
      hidden; the server continues enforcing the one-account addition limit.
- [ ] **ACCESS-AC-024** Active logout follows the correct fallback.
- [ ] **ACCESS-AC-025** Reload and cross-tab updates do not leak account state.
- [ ] **ACCESS-AC-035** Adding an account makes it the selected account in all
      tabs after the add succeeds.
- [ ] **ACCESS-AC-036** Switching accounts in one tab updates every open tab;
      tabs reload and no stale tab-local value can select a different account.
- [ ] **ACCESS-AC-045** Simultaneous account switches across tabs serialize;
      after selection changes, tabs converge on the selected account and a
      restore response for the previous slot cannot overwrite it.
- [ ] **ACCESS-AC-037** Across open tabs, only one tab presents the termination
      modal; other tabs wait while the owner acts, then converge on the same
      restored account or public site. If the notice tab closes, another tab can
      take over. Transient failures preserve recovery.

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
  slot and direct selection, no alternate slot, all remembered slots invalid,
  Add account from the terminal modal, cancel/close fallback, concurrent tabs
  on different slots, delayed refresh responses, and required OTP/device
  challenge after sign-in.

#### Implementation plan and rollout status

The priority reliability proposal and deferred workstreams are:

1. **Make refresh retries recoverable (implemented locally; staging pending;
   BUG-AUTH-003 and BUG-AUTH-006).** A refresh request that has committed its
   rotation must be safely retryable if the browser reload interrupts delivery
   of the response cookie. A retry must recover the same committed result and
   must not create another independently usable token in the family. The API
   derives each rotated successor with
   a keyed HMAC from its parent token and records the derivation key ID on the
   successor row. The API accepts a refresh operation ID and records it on the
   rotated parent. A retry with that same ID can reproduce and resend the same
   active successor after grace; any retry during grace receives that same
   deterministic child even if its operation ID differs. Only the SHA-256 hash
   is stored. Keep the referenced JWT key ID configured while the successor
   remains active. Legacy rows without a derivation key retain the one-time
   grace behavior. The web app now
   persists the operation ID per account slot before sending the request,
   reuses it after an interrupted or ambiguous refresh, and sends it in
   `X-Friink-Refresh-Operation-Id`, while retaining one captured account slot
   and cross-tab coordination.
   HttpOnly cookie names, scope, and browser-readable storage are unchanged.
   Verify reload interruption before and after the API commit, response loss,
   concurrent same-slot tabs, and repeated stale-token presentation; each case
   must leave at most one usable refresh token per family and preserve the
   selected account. Staging acceptance is still required.
2. **Defer the Add account limit mismatch investigation.** Compare the same
   browser's `friink_device_id` context across `GET /auth/accounts`,
   `GET /auth/accounts/add-availability`, and the final Add account login
   request. Inspect the configured `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` value
   and redacted account-slot logs. Reproduce after repeated refreshes, normal
   login, switching, and logout. The fix must preserve the active account when
   an Add account attempt fails and must prove that refreshes do not create
   duplicate slots. Resume after refresh stability is verified.
3. **Synchronize active account selection across tabs (implemented locally;
   staging pending).** The shared active-slot key is authoritative. Adding or
   switching accounts updates it, and other tabs reload to restore that slot.
   Broader isolation of unrelated page-owned state remains a separate follow-up;
   captured-slot refresh coordination and explicit logout/removal fallback
   remain required.
4. **Terminal-session recovery (implemented locally; browser/staging
   acceptance pending).** A terminal failure displays its cause and waits for
   acknowledgment before fallback by last use. Other tabs wait for the same
   acknowledgment, and a waiting tab can take over if the notice tab closes.
   Ambiguous failures remain retryable, and explicit account choice remains
   available for that recovery state.
5. **Reload-time token stability and public entry.** The access-cookie and
   cookie-first restoration changes are deployed to staging and BUG-AUTH-003
   is resolved. The historical trigger for interrupted refresh remains
   unknown; the retry proposal above is tracked separately under BUG-AUTH-006.
   Public-entry acceptance remains tracked under BUG-AUTH-002.
6. **Defer client-bound session validation.** The proposed security change was
   for every authenticated client context (for example, a browser profile or
   mobile app installation) to have a reusable opaque client identifier, with
   every auth session associated with that client. The conceptual per-user
   “userspace” is only a collection of that user's sessions; it does not need
   its own database entity. Each login creates a disposable session UUID, while
   logging out and back in from the same client may reuse its client identifier
   and create a new session UUID. Session validation would confirm both the
   active session ID and proof of its associated client credential; a public
   client identifier alone would not authorize requests. The contract would be
   client-type-neutral and would not rely on a hardware fingerprint. Define
   issuance, rotation/recovery, multi-tab behavior, and mobile secure storage
   before implementation. Add migration and replay-from-another-client
   verification requirements. Defer this until the refresh flow is stable; it
   is not part of the current session repair. Current ordinary access-token
   validation checks the JWT and active `sid` without requiring the
   recognized-device cookie.

The deferred Add-account and broader account-state workstreams remain recorded
for later resumption. The focused refresh-token test module, web type-check,
targeted lint, and whitespace check pass locally. The staging migration is
applied and Alembic reports no schema drift. API/web deployment and browser
acceptance remain required before release.

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

**Staging smoke check — 2026-09-27 (user-reported):** Login and ordinary
account switching passed. The cross-tab account-switch fix is committed on the
staging branch, but its multi-tab regression has not been tested on staging;
multi-tab acceptance remains pending.

| ID | Requirement | Verification | Status |
|---|---|---|---|
| ACCESS-R-017 | Reactive refresh after expiry | Web auth refresh tests | Implemented |
| ACCESS-R-018 | Recoverable refresh preserves access | Token resilience tests | Implemented |
| ACCESS-AC-046 | Auth network errors use friendly copy | Simulated fetch rejection in auth form | Implemented locally |
| ACCESS-R-031 | Cause-specific notice waits for acknowledgment before terminal fallback; ambiguity remains retryable | Account recovery and browser matrix | Implemented locally — staging pending |
| ACCESS-R-032 | Refresh keys and requests use one captured slot | Planned cross-tab isolation verification | Implemented locally — staging pending |
| ACCESS-R-033 | Refresh recency commits with token rotation | Planned account-list ordering verification | Implemented locally — staging pending |
| ACCESS-R-034/035 | Add/switch and acknowledged termination converge client-wide; notice owner can be replaced | Multi-tab browser matrix | Ordinary account switching passed (user-reported); multi-tab staging pending |
| ACCESS-R-026/AC-039/AC-040 | Single-slot limit blocks additions but preserves switching across existing accounts | Single-slot and lowered-limit API tests; browser check | Implemented locally — browser/staging pending |
| ACCESS-R-029 | Failed operations preserve active account | Account isolation tests | Implemented |
| ACCESS-R-030 | Logout fallback | Active-slot logout test | Implemented |
| ACCESS-R-014/015 | Token lifetime and refresh contract | Configuration/token tests | Documented — MIG-001 |
| ACCESS-AC-026/032/034 | Acknowledged terminal failure falls back by recency or returns to public site | Account recovery browser matrix | Implemented locally — staging pending |
| ACCESS-AC-027 | Requests and refresh coordination use the selected slot | Planned cross-tab isolation verification | Implemented locally — staging pending |
| ACCESS-AC-028 | Explicit recovery changes account only after selected-slot success | Planned recovery-flow verification | Implemented locally — staging pending |
| ACCESS-AC-035/036 | Add and switch update the client-wide selected account | Multi-tab browser matrix | Ordinary account switching passed (user-reported); multi-tab staging pending |
| ACCESS-R-044/AC-045 | Concurrent switches serialize and stale restore responses cannot replace the selected slot | Two-tab simultaneous switch and reload matrix | Patch committed; multi-tab staging test pending |
| ACCESS-AC-037/038 | Cause notice, acknowledgment, single-tab presentation, and takeover | Multi-tab terminal-session browser matrix | Implemented locally — staging pending |
| ACCESS-AC-041 | Session hint skips the public entry-status round trip for recognized clients | Hint/no-hint public-route HTTP check | Local HTTP checks pass; staging acceptance pending |
| ACCESS-AC-042 | Exhausted terminal recovery reaches public site without re-entry loop | Browser matrix: zero hint, stale positive hint, entry-status true/false, terminal restore | Implemented locally — staging browser pending |
| ACCESS-AC-043 | Recovery behavior is coherent across route entry points | Browser matrix for app shell, public root, profile, post, username-chat, login | Open — current route differences documented |
| ACCESS-AC-044 | A failed target switch preserves the valid source | Two-account staging browser switch in both directions; dead-target failure preserves source | Implemented locally — staging authenticated switch pending |
| ACCESS-AC-047 | Terminal recovery modal offers remembered-account restore and Add account; cancel/close restore fallback or return public with hint zero | Single/multiple-account browser matrix; add-account and multi-tab recovery | Implemented locally — staging pending |

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
- Implemented locally: a neutral terminal recovery modal with account restore
  and Add account, one notice owner across tabs with takeover, captured per-slot
  client coordination, and persisted refresh recency. Multi-tab
  browser verification and staging acceptance remain pending.
- The refresh-retry change has local API regression coverage for recovery
  after grace, multiple operation IDs receiving the same child within grace,
  and different-operation replay revocation after grace. API deployment and
  browser verification remain required; no schema change is part of this fix.
- A local API integration check used a test-only one-second access-token
  lifetime and completed three sequential expiry/refresh rotations. This did
  not reproduce refresh reuse; concurrent tabs, interrupted responses, and
  real-browser cookie persistence remain outside that check.
- API code review and isolated SQLite reproductions confirmed two retry defects:
  same-operation recovery after grace revoked the family, while a different
  operation ID inside grace replaced the deterministic child. Both paths are
  fixed locally and regression-tested: the original operation recovers the
  active child after grace, and all retries during grace receive that same
  child. Different operation IDs after grace still trigger reuse revocation.
  Incident records do not include operation IDs, so they cannot prove the exact
  sequence for each historical session loss. The non-atomic localStorage lock
  fallback remains a possible source of competing IDs in browsers without Web
  Locks, but it was not reproduced in a browser.
- Staging session reliability is not accepted: interrupting page reload during
  session restoration can end the session, and the 2026-09-27 run lost
  `@muflah` in Chrome and Firefox after the API detected stale refresh-token
  reuse in both browsers. Production also has repeated refresh-reuse events
  for this account, including an Android session. Normal web restoration sends
  the account-slot header, so the generic-cookie path is not established as the
  cause. The exact source of the stale presentations remains unknown. The
  local retry implementation and its verification gate are tracked in
  BUG-AUTH-003 and BUG-AUTH-006.
- Open staging verification: Add account previously reported a full
  remembered-account limit while the browser showed only one account; the
  local fix and regression test are recorded in [`docs/notes.md`](../notes.md).

## 9. Rebuild checklist

- [ ] Implement identity normalization, validation, uniqueness, and privacy.
- [ ] Implement signup, verification, login, risk challenges, and recovery.
- [ ] Implement access-token validation and refresh rotation.
- [ ] Verify the local refresh-retry recovery without token-family forks under
      reload interruption and concurrent-tab behavior on staging.
- [x] Implement terminal versus ambiguous failure handling locally, including
      neutral recovery choices, fallback/public routing, and cross-tab
      waiting/takeover; staging and browser acceptance remain pending.
- [ ] Implement active-session listing and revocation.
- [ ] Implement device recognition and account slots.
- [ ] Implement switching, isolation, fallback, and account limits.
- [ ] Implement durable security events and notification isolation.
- [ ] Implement permissions, privacy, and secret-redaction boundaries.
- [x] Apply and verify the documented 30-day refresh-token lifetime.
- [ ] Run automated and manual verification for all acceptance criteria.

## Changelog

- 2026-09-26T13:07:02Z — The account limit now controls additions independently
  from switching: when lowered to one, existing multiple remembered accounts
  remain switchable while Add account is hidden; the switcher is hidden only
  when one account is available.
- 2026-09-27T13:07:53Z — Kept the redirect cookie at `1` while another remembered
  slot remains, refreshed its 30-day expiry on session saves (including token
  refresh), and wrote `0` when clearing the last remembered slot.
- 2026-09-27T14:18:22Z — Consolidated cross-route session recovery behavior,
  public-entry hint semantics, and multi-tab notice handling into this unit;
  recorded route-specific differences and the BUG-AUTH-007 loop risk.
- 2026-09-26T13:44:23Z — Verified both public entry routes return `200` without
  the hint and redirect to `/home` with it; TypeScript check passes.
- 2026-09-26T13:10:43Z — Clarified that switcher availability is based on both
  the configured limit and the number of accounts available on the device.

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
- 2026-09-24T21:58:14Z — Replaced automatic terminal-refresh fallback with explicit
  account recovery, scoped refresh coordination to one captured slot, and
  persisted refresh recency in the API transaction; verification pending.
- 2026-09-24T22:14:02Z — Matched recovery action widths into one centered group
  with equal columns and a full-width account-choice action.
- 2026-09-24T22:19:59Z — Moved the remembered-account list into the shared
  modal, ordered the current account first, and kept list scrolling inside the
  dialog.
- 2026-09-24T22:54:37Z — Recorded open reload-time refresh instability and the
  public-route restore gate, with an HTTP-only access-cookie and non-blocking
  public-render plan. No behavior changed.
- 2026-09-24T23:13:58Z — Added the planned multi-account continuity policy:
  retain app access while a valid remembered session exists, fall back by
  most-recent use after confirmed session end, and keep recoverable failures
  inside recovery. No behavior changed.
- 2026-09-25T22:02:29Z — Deferred the add-account mismatch follow-up, broader
  account-state isolation, and client-bound session project while documenting
  the proposed API/web refresh-retry redesign.
- 2026-09-25T22:18:00Z — Added deterministic refresh successors and API support
  for retry operation IDs, retaining only the successor hash plus derivation
  key ID and operation ID in the database. Cookie names and storage contracts
  are unchanged.
- 2026-09-25T22:27:54Z — Persisted per-slot web refresh operation IDs before
  requests, reused them after interrupted or ambiguous attempts, and sent them
  to the API. The focused refresh-token tests, web type-check, and targeted
  lint have since passed locally; staging acceptance remains pending.
- 2026-09-26T11:45:38Z — Made account selection client-wide so add/switch
  reloads other tabs into the selected account. Confirmed termination now
  falls back to the most-recent valid slot or returns to public when none
  validate; transient failures remain in recovery. Staging acceptance pending.
- 2026-09-26T12:44:44Z — Matched terminal session UX to the cross-tab contract:
  terminal causes are explained, fallback waits for acknowledgment, one tab
  owns the notice, and another tab can take over if it closes. Browser and
  staging acceptance remain pending.
