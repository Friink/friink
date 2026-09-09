# Friink Account Switcher

Status: Open — local implementation and validation are complete; clean-profile
Chrome/Chromium staging acceptance passed, while deployment stability remains
under follow-up.

This document describes how multiple independent Friink accounts are added,
remembered, switched, and removed in one browser profile. It complements
`docs/auth-and-session.md`, which remains the authoritative document for the
shared authentication and session rules.

## Product behavior

- After a successful login, the side drawer shows `Add account`.
- `Add account` opens the existing design-system authentication modal.
- The modal supports both login and signup. Signup follows the approved
  email → OTP → password → profile sequence when OTP is enabled.
- A successful authentication registers that account on the current browser
  profile and immediately activates it.
- `Change account` is hidden until at least two accounts are authenticated.
- The account list contains only accounts remembered on the current device.
- Switching changes the active account context; it never merges accounts or
  links their identities.
- The switcher supports up to `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE` accounts.
  The default is four; valid configuration values are 1 through 16.
- When the limit is reached, adding another account is blocked until one is
  removed. Existing accounts are never silently replaced.
- On logout, the active account's device session is removed. If other
  accounts remain, the most recently used account becomes active; otherwise
  the user returns to the signed-out login screen.
- Removing an account requires confirmation and removes only that account
  from the current device. It is not account deletion.
- Deactivated or pending-deletion accounts show lifecycle messaging and are
  removed from the usable device list.

### Selector loading and actions

- The account selector opens immediately with the cached device account list;
  when no cache exists, it shows the current account as a safe fallback.
- While `GET /auth/accounts` refreshes the list, the selector shows the shared
  spinner treatment with `Updating accounts…`.
- Refresh requests are deduplicated. A completed response replaces the cached
  list, while a failed response preserves the cached/current account and shows
  a subtle `Retry` action.
- The list refreshes after account add, switch, and logout operations. Switching
  does not remove any remembered account; it only changes the active account.
- During an account switch, the selected row shows a spinner and all account
  rows, logout actions, and Add account are temporarily disabled. This prevents
  competing authentication requests. The selector stays open to make the
  progress and disabled state visible; actions become available again after
  the switch succeeds or fails.
- A successful switch updates the in-memory app shell and remounts it for the
  new user without a browser-level reload, so the existing page does not briefly
  disappear while the session is restored.
- Each non-current account has a right-side logout icon. The current account
  keeps its checkmark and cannot be logged out through that row. Logout opens a
  confirmation dialog showing the selected account's profile card.

## Switch latency and database connections

Local browser runs observed roughly 2–4 seconds for successful account-switch
requests, with no browser errors and a local API origin. The delay is therefore
more likely in API/database work than in browser network transport.

The approved architecture direction is deployment-neutral connection pooling:
Neon Free should use a small pool, while the future Ubuntu-hosted PostgreSQL
deployment may use a larger pool based on API worker count and PostgreSQL
`max_connections`. The current API still uses `NullPool`; changing it is a
separate measured rollout and must not be inferred from selector UX evidence.

## Account independence

Each remembered account is a fully independent Friink identity. There is no
shared profile, merged identity, account-to-account relationship, shared
security state, or cross-account data access.

The unique-email-per-account rule remains permanent: the same email address
cannot be associated with multiple Friink accounts.

Settings session management is account-scoped. While Account A is active, the
user can manage Account A's sessions; Account B's sessions must not appear as
if they belong to Account A.

## Server-side session slots

The server maintains a device-scoped account session slot for each remembered
account. A slot includes, directly or through protected references:

- The internal account UUID.
- A protected hash or equivalent of the device/installation identifier.
- A random opaque slot identifier.
- The account's `auth_session` and refresh-token family reference.
- Created, last-used, and revoked timestamps.
- Optional safe display metadata such as username and avatar.

The browser receives only the opaque slot reference and safe display data. The
slot is not an account ID, username, credential, or trusted client-only claim.
It becomes invalid after revocation or removal.

Existing `auth_sessions` and `refresh_tokens` remain authoritative for session
validity. Each account has an independent refresh-token family even when
several accounts are remembered on one device.

## Credential and cookie boundary

- Only the active account's short-lived access token is held in memory.
- Refresh tokens, token hashes, passwords, OTPs, internal UUIDs, and device
  secrets must never be stored in JavaScript-readable storage.
- Each account slot uses a server-managed HttpOnly refresh cookie named in the
  form `friink_refresh_<opaque_slot>`.
- Slot cookies are host-only API cookies with `Path=/`; deployed HTTPS uses
  `Secure` and the documented cross-origin `SameSite` setting.
- Cookie deletion must target the exact slot cookie.
- The active slot is sent with switch and refresh requests and is validated by
  the server against the protected device record.
- The API must process only the validated active slot, even if the browser
  sends multiple refresh cookies.
- Refresh coordination keys and BroadcastChannel messages are slot-scoped so
  Account A cannot update Account B's token or state.

## API contract

Equivalent route names are acceptable, but the server must provide these
operations:

- `GET /auth/accounts` returns non-revoked slots for the current device,
  ordered by last use, with safe summaries only.
- Existing login and signup endpoints create or restore only the authenticated
  account's device slot.
- Slot-aware logout requires the active account's bearer access token to match
  the requested slot; a device cookie alone cannot revoke another account.
- `POST /auth/accounts/switch` validates the opaque slot, device, and slot
  state, then issues the selected account's normal access context.
- `DELETE /auth/accounts/{slot}` revokes and removes only that account's
  device slot.
- Existing logout and session controls remain account-specific. “Log out all
  other sessions” affects the active account only.

Adding an account that already has a valid slot should activate that slot
rather than create a duplicate. Revoked or expired slots must not affect
other accounts.

Network, CORS, timeout, and other ambiguous failures during add, switch, or
remove must preserve the previously active account. Only a confirmed terminal
session result may clear local account state.

## Client-state isolation

After switching, every request is authorized using the selected account's
access token and server-side session context. Account-specific caches, query
keys, optimistic state, uploads, notifications, drafts, and analytics must be
partitioned by account. The client must clear or replace account-scoped state
before rendering the newly active account.

Adding an account creates that account's normal login security event and
notification. Switching an already authenticated account does not create a
new-login event. Security, OTP, lockout, revocation, and device-enrollment
records remain attached to the correct account and session.

## UX decisions

- Login appears first in the Add-account modal, with Create account below it.
- Successful authentication immediately activates the new account.
- The drawer exposes switching, Add account, inline logout actions for
  non-current accounts, and active logout.
- The selector keeps the active account first with its checkmark; other rows
  include right-side logout icons.
- Removal requires confirmation.
- The dropdown closes after switching.
- Add-account failure, cancellation, or abandonment must not log out or
  replace the active account and must not create a partial account or slot.
- Recoverable failures preserve the active account.

## Rollout and compatibility

The rollout is additive and must preserve the legacy one-account path:

1. Add device-scoped account-session-slot storage without invalidating current
   refresh/session rows.
2. Deploy server support that continues accepting the existing single-account
   cookie/session path.
3. Create or associate a slot after the next successful login or explicit
   account addition.
4. Verify single-account login, refresh, logout, OTP, session management, and
   recovery before enabling multiple accounts broadly.
5. Enable gradually and monitor account-scoped session, switch, revocation,
   and isolation failures.

Existing users must not be forced to log in again solely because the new slot
tables or UI are deployed.

## Current implementation status

The web-focused Phase 4 implementation is present, and its Chromium release
gate is ready after deployment and clean-profile acceptance. The implementation includes
the slot migration, opaque slot references, safe summaries, protected device
binding, slot-named HttpOnly cookies, account listing, switching, removal,
Add-account modal reuse, cross-tab coordination, notifications, and lifecycle
fallbacks. The legacy single-account refresh path remains supported.

Focused staging evidence recorded two passing account-switcher tests covering
two accounts on one device, approval, notification creation, denied-OTP
invalidation, listing, switching, slot refresh, and removal. Web TypeScript
and production-build checks also passed.

The first live browser E2E run was completed against commit `56598a6` with
`SIGNUP_OTP_ENABLED=false` and `LOGIN_RISK_OTP_ENABLED=false`. Signup skipped
OTP as expected, and the login and account-switcher flows were reachable.

### Live staging E2E results — 2026-09-07

- Created Account 1 through standalone signup and entered the app.
- Added Account 2 through the in-app Add-account signup flow.
- Switched between Accounts 1 and 2 successfully.
- Logged out Accounts 1 and 2 with the expected fallback behavior.
- Created Account 3 through standalone signup and logged it out.
- Logged back into Account 1 successfully.
- Added existing Accounts 2 and 3 from inside the app.
- Verified the final switcher list contained all three accounts and switched
  back to Account 1 successfully.

The run found one retention issue: Account 2 disappeared from the remembered
account list during the first final re-add sequence and had to be added again.
The second add succeeded, leaving all three accounts visible. This remains an
open investigation before the account-switcher behavior can be considered
fully E2E-closed.

The run also observed intermittent home-feed load failures and slow API
responses. These did not prevent account creation or the final three-account
switch verification, but deployment stability should be checked separately.

### Test-pass results — 2026-09-07

- Focused account tests: `test_phase4_accounts.py` 9 passed; diagnostics
  tests 4 passed.
- Real API test suite with isolated test configuration: 107 passed, with
  existing Starlette/JWT warnings.
- The connection, blocking, device/origin, post serialization, and session
  fixture failures found during the earlier run have been corrected or
  isolated in the test harness.
- `api/pytest.ini` now restricts discovery to `api/tests`, excluding the
  ad-hoc external R2 script under `api/tmp`.
- Web production build passed.
- Web lint passed with warnings only after pinning ESLint 8 and
  `eslint-config-next` 14 for the Next 14.2.5 toolchain.

### Confirmed implementation gap and local resolution

The product contract says active logout revokes the active account's
device/session slot. The original web handler only cleared in-memory and
browser-local state; the API route existed but was not invoked. The local fix
now sends slot-aware `POST /auth/logout`, revokes the server-side slot, and
deletes the exact slot cookie. The missing-device-cookie guard prevents
Add-account from silently creating a separate device identity. The pushed
staging build and clean Chromium browser verification are recorded below;
latency/feed stability remains a separate deployment investigation.

### Deterministic reproduction reported by the owner

1. Log in to staging as `muflah@outlook.com`.
2. From inside the app, add `muf95@outlook.com`.
3. Open the account switcher.
4. The original `muflah@outlook.com` account is missing.

This symptom strongly indicates that the Add-account request is not carrying
the existing `friink_device_id` cookie. The server then creates the added
account under a new device hash. Since `GET /auth/accounts` lists slots by
device hash, it returns only the newly created account and makes the original
account appear to vanish. This must be confirmed from the browser network
request and server logs, but it is more specific than a generic UI refresh
failure.

Diagnostic checks for this reproduction:

- Confirm the initial login response sets `friink_device_id`.
- Confirm the Add-account login/signup request sends that cookie to the API.
- Confirm both requests use the same API origin and `credentials: include`.
- Confirm the API response does not overwrite the device cookie with a new
  value during Add-account.
- Compare the device hash/slot count in server logs without logging raw cookie
  values or tokens.
- Check CORS allows the exact staging web origin with credentials and that the
  deployed cookie has `Secure`, `SameSite=None`, `Path=/`, and the intended
  host/domain scope.

If the cookie is present, the next suspect is a server-side slot query or
transaction issue. If it is absent, fix the staging API origin/CORS/cookie
deployment configuration before changing switcher UI code.

## Remediation plan

1. Fix logout lifecycle first. Extend `POST /auth/logout` to accept the active
   account-slot header/cookie, revoke that slot's refresh family, and delete
   the exact slot cookie. Add a client `logout()` API function that calls it
   before clearing local state. Make cleanup idempotent so an ambiguous network
   failure does not replace a usable remaining account or create duplicate
   slots.
2. Make account-slot transitions transactional. On add-account, existing-slot
   lookup, slot creation/replacement, refresh-token issuance, and the response
   must complete as one server-side operation. The client must refresh the
   account list only after the new session is saved and must ignore stale list
   responses from earlier requests.
3. Add regression coverage for the exact failure sequence: three accounts,
   switch, active logout, fallback, logout another account, standalone login,
   re-add both existing accounts one by one, reload, and switch repeatedly.
   Include delayed, failed, and duplicated `/auth/accounts` responses.
4. Correct test configuration. Tests that expect direct signup must explicitly
   use `SIGNUP_OTP_ENABLED=false`; OTP-enabled tests must use the email
   verification endpoints. Do not load `.env.staging` as the default unit-test
   configuration.
5. Repair the unrelated failing tests: update fake connection sessions to
   support `execute`, fix device/origin fixture isolation, and correct post
   serializer fixtures. Keep these failures separate from switcher acceptance.
6. Add deployment diagnostics without secrets: expose the effective OTP flag
   state only through protected server logs or an internal health check, and
   verify that `staging.friink.com` reaches the API deployment where both OTP
   variables were changed and redeployed.
7. Re-run the API suite, web build/lint, and clean Chromium staging E2E. Enable the
   switcher broadly only after logout/re-add passes repeatedly and the API
   returns stable account-list and switch responses.

## Resolution plan

This is the recommended order for resolving the staging failure and preparing
the feature for release. Do not treat the browser symptom as a UI-only issue;
the account list is derived from server-side device slots.

### Phase 0 — Freeze and capture evidence

- Keep the switcher disabled for broad users or behind a rollout flag while
  this plan is in progress.
- Hard rule: every phase from Phase 0 through Phase 6 must run acceptance
  testing on a clean browser profile with no prior cookies or local storage.
- Preserve one clean Chrome/Chromium profile for testing.
- Use synthetic test accounts only.
- Capture the following requests for the exact `muflah` → `muf95` reproduction:
  `POST /auth/login`, the Add-account authentication request, `GET
  /auth/accounts`, and `POST /auth/accounts/switch`.
- Record status codes, response bodies, cookie names, and timing. Never record
  cookie values, access tokens, refresh tokens, OTPs, or passwords.

### Phase 1 — Prove device-cookie continuity

Acceptance criteria:

- Initial login sets one `friink_device_id` cookie.
- Add-account sends the same device cookie to the API.
- Add-account does not replace it with a different device cookie.
- `GET /auth/accounts` returns both accounts after Add-account.
- Both accounts have slots with the same server-side device hash.

If the cookie is missing, correct the deployed API origin, CORS, credentials,
cookie attributes, and environment configuration. The web client already uses
`credentials: include`; verify the deployed build actually points to the
intended staging API. If the cookie is present, inspect slot creation and
transaction boundaries instead of changing browser code.

Before closing this phase, record evidence using the existing status-block
format: status, evidence, commit hash, and named tests.

### Related open issue — signup OTP redundancy

A redundant login-OTP prompt was observed after signup email verification
during the 2026-09-07 staging session. This is separate from the
account-switcher retention bug; a working-tree fix is pending deployment
confirmation. Track this issue to resolution in this document or a linked
document so it is not lost or silently reintroduced during switcher work.

### Phase 2 — Correct logout and slot lifecycle

- Extend `POST /auth/logout` to understand the active account slot. It must
  revoke the active slot's auth session/refresh family and delete the exact
  `friink_refresh_<slot>` cookie.
- Add the missing client logout call before clearing local state.
- Preserve the most-recent remaining active slot after logout; return to the
  signed-out screen only when no valid slots remain.
- Make repeated logout, failed logout, expired-slot removal, and already
  revoked-slot removal idempotent.
- Ensure adding an existing account reuses its valid slot and never creates a
  duplicate slot for the same user/device.
- Before closing this phase, record evidence using the existing status-block
  format: status, evidence, commit hash, and named tests.

### Phase 3 — Harden Add-account and switch transitions

- Keep the previously active account usable until Add-account authentication,
  slot creation, cookie issuance, and session persistence all succeed.
- Make the server-side slot update and refresh-token issuance transactional.
- In the client, save the new session before refreshing the account list, and
  discard stale or out-of-order account-list responses.
- On `/auth/accounts` or switch failure, show a retryable error while keeping
  the current account active.
- On reload, derive the active account from the validated session/slot rather
  than from stale local state.
- Test slow responses, duplicate clicks, refresh during Add-account, two tabs,
  expired access tokens, and a failed switch.
- Before closing this phase, record evidence using the existing status-block
  format: status, evidence, commit hash, and named tests.

### Phase 4 — Repair and isolate automated tests

- Create a test settings fixture that defaults to `SIGNUP_OTP_ENABLED=false`
  and `LOGIN_RISK_OTP_ENABLED=false` for direct-auth tests.
- Keep OTP-enabled tests explicit and use the email-verification endpoints.
- Prevent pytest from collecting `api/tmp/manual_r2_test.py` or other manual
  scripts.
- Update connection-test fake sessions to implement the current `execute`
  blocking query.
- Fix independent device/origin, post-serialization, reactions, and session
  fixtures until the real `api/tests` suite is green.
- Add backend regression tests for: same-device Add-account, active logout,
  fallback, re-add after logout, slot reuse, slot revocation, account limit,
  and concurrent list/switch requests.
- Before closing this phase, record evidence using the existing status-block
  format: status, evidence, commit hash, and named tests.

### Phase 5 — Add safe observability

- Log structured events for device-cookie presence, slot creation/reuse,
  slot revocation, account-list count, and switch failure reason.
- Redact all raw cookie values, tokens, passwords, OTPs, hashes, and internal
  account identifiers.
- Add a protected diagnostic endpoint or deployment check that reports the
  effective OTP flag values and API build identifier, without exposing secrets.
- Configure `AUTH_DIAGNOSTICS_INTERNAL_TOKEN` in the staging API environment;
  the endpoint returns 404 unless the matching header is supplied.
- Verify the staging web alias, API alias, and Vercel environment scope after
  every configuration change and redeploy.
- Intermittent home-feed load failures and slow API responses observed during
  the 2026-09-07 staging E2E run must be logged in `AGENTLOG.md` as a separate
  deployment-stability investigation, distinct from switcher acceptance.
- Before closing this phase, record evidence using the existing status-block
  format: status, evidence, commit hash, and named tests.

### Phase 6 — Release gate

The switcher is ready only when all of the following are true:

- The `muflah` → `muf95` reproduction passes repeatedly in a clean
  Chromium-based browser profile.
- Three-account add, switch, logout, fallback, re-add, reload, and switch
  cycles pass without a missing account.
- OTP flags produce the intended signup and normal-login behavior.
- The real API test suite is green, excluding only explicitly quarantined
  external/manual scripts.
- Web build and lint pass non-interactively.
- No account, token, cookie, or state isolation failure appears in logs.
- Slow or failed requests preserve the active account and provide recovery.
- Before closing this phase, record evidence using the existing status-block
  format: status, evidence, commit hash, and named tests.

### Phase rollback rule

If any phase's fix attempt fails that phase's own acceptance criteria on
retest, revert the specific change from that attempt before proceeding. Do not
carry a failed fix forward into the next phase.

If any release-gate item fails, keep the feature behind the rollout flag and
continue from the failing phase; do not mark the feature closed based only on
the happy path.

### Current execution status — 2026-09-07

- Status: Open pending deployment-stability follow-up.
- Evidence: slot-aware logout, ambiguous-failure preservation with retryable
  feedback, Add-account account-state reset, deactivation fallback to the
  most-recent remaining account, missing-device-cookie protection, safe slot
  diagnostics, and logout/re-add regression coverage are implemented locally.
- Commit hash: `6358b0d` pushed to `origin/staging`; the API health endpoint
  returned `{"database":true}` after the push.
- Named tests: full API suite (107 passed), `test_phase4_accounts.py` (9
  passed), diagnostics/account/refresh focused suite (15 passed),
  `test_connections.py` (20 passed), web TypeScript (passed), web lint
  (passed with warnings), web production build (passed), Python compilation
  (passed), and `git diff --check` (passed).
- Outstanding gate: investigate the observed slow/intermittent staging
  responses as a separate deployment-stability investigation. The earlier
  connected-profile Chrome active-source test failed, but the fresh clean
  Chrome run recorded below passed the in-scope switcher paths.

### Latest staging account-limit run — 2026-09-07

- Limit clarification: the repository and staging-file default is **4**
  remembered accounts, configured by `MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`.
  The validated range is 1–16. A deployed API override must be verified from
  the deployed configuration before interpreting a max+1 result.
- Latest deployed build: three-account switching passed across Accounts 1–3.
- Added Accounts 4 and 5 through the in-app signup flow; the switcher retained
  all five accounts. Signup requests timed out in the UI, but both accounts
  were created and activated successfully.
- Historical max+1 attempt: with five remembered accounts under the prior
  staging value, `Add account` closed without opening signup; no sixth account
  was created. The limit is enforced before signup. Recheck in that staging
  session showed the Manage accounts dialog with the explicit message:
  `Remove an account before adding another.`
- Browser scope: historical run was Codex in-app browser only; the separate
  clean-profile Chrome/Chromium run is recorded below.

The over-limit behavior is therefore not the cause of the owner's login
failure: the limit is enforced before signup starts, and lowering the limit
does not silently remove existing slots. The
remaining owner-reported failures are OTP flag/deployment drift, the OTP
timeout-with-success race, and loss of the previously remembered account
after login.

### Fresh clean-profile Chrome E2E — 2026-09-07

- Status: Ready for release; deployment-stability follow-up is separate.
- Evidence: Created five isolated accounts using standalone signup, in-app
  signup, and in-app login/re-add. Logout fallback passed from Account 3 to 2,
  then 1, then the public site. With four retained slots, Add account refused
  the fifth and opened Manage accounts with `Remove an account before adding
  another.` After logging out Account 5, Account 3 was re-added successfully.
- Evidence: Reload preserved Account 5 and the remembered list; no account
  disappeared during this clean-profile run. No OTP prompt appeared with both
  OTP flags disabled. Account operations commonly took 15–30 seconds.
- Commit hash: `6358b0d` (the pushed staging commit used for the follow-up
  deployment check).
- Named tests: clean Chrome signup/add/switch/reload/logout/fallback/re-add;
  configured limit-plus-one.
- Follow-up: investigate the observed latency in the separate deployment-
  stability track; it did not invalidate the exercised switcher acceptance.

### Chrome staging switch verification — 2026-09-07

- Connected Chrome profile: `Muflah`; staging page loaded with three visible
  remembered accounts: `@muflahulfurqan`, `@muflah`, and `@muf95`.
- Retest began from a confirmed active `@muflahulfurqan` session; the account
  manager showed all three slots, so the source account was not a deactivated
  or logged-out slot.
- Selecting `@muflah` closed the switcher, but the active account remained
  `@muflahulfurqan`. Reloading the page preserved the original account.
- Result: the live Chrome switch failure reproduced from a valid active source;
  the Phase 6 browser gate remains open. No account or credential data was
  added to the evidence.
- Code audit also found a multi-tab race: an older refresh could overwrite a
  newer switch in shared localStorage/BroadcastChannel state. Refresh now
  aborts when the active slot changes in flight and requires a slot-aware API
  response to return the same slot.

### Owner-reported staging mismatch — 2026-09-07

- `staging.friink.com` appears to serve behavior from an older build despite
  the latest deployment being selected; verify the web alias, deployment SHA,
  API alias, cache, and environment scope from the deployed runtime.
- Owner confirms `LOGIN_RISK_OTP_ENABLED=false` in Vercel. This does not yet
  prove the same value is present in the separate FastAPI/API deployment that
  serves `/auth/login`; environment changes require an API redeploy.
- With both OTP flags expected to be `false`, normal login still requests OTP.
- OTP submission reports a timeout but still completes login. Treat this as a
  request/response or client timeout race until the final response and session
  state are correlated server-side.
- After login, the previously remembered account disappears. This remains an
  open retention/session-slot failure and is not explained by the account-limit
  result above.
- Firefox was installed for cross-browser testing, but was not available to
  the current browser-control session; Firefox acceptance remains unverified.

Broader browser acceptance remains required after the retention issue is
resolved and deployment stability is confirmed. It should cover the scenarios
below.

## Acceptance checklist

- Add account through login and signup.
- Verify the signup flow with and without OTP enabled in the test environment.
- Show `Change account` only at zero/one versus two accounts.
- List only accounts remembered on the current device.
- Switch successfully and verify account-specific content, cache, drafts,
  notifications, and active-session state.
- Reload after switching and confirm the selected account remains correct.
- Refresh concurrently from multiple tabs and verify slot isolation.
- Confirm Account A cookies, tokens, and state never select Account B.
- Remove an inactive account and confirm the active account is unaffected.
- Log out the active account and confirm correct fallback selection.
- Reach the account limit and confirm additions are blocked without silent
  replacement.
- Exercise revoked, expired, deactivated, and pending-deletion slots.
- Confirm recoverable add/switch/remove failures preserve the active account.
- Confirm no response, browser storage, log, or account summary exposes raw
  refresh tokens, token hashes, internal UUIDs, passwords, OTPs, or device
  secrets.
- Verify exact cookie, CORS, and `SameSite` behavior in the deployed staging
  web/API environment.

Mobile account switching is outside this document and is owned by
`docs/auth-and-session-mobile.md` when a mobile client is implemented.
