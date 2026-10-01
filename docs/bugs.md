# Friink bug register

**Status:** Active triage plan
**Last edited:** 2026-09-29T22:41:14Z

## Instructions for agents

Use this file for diagnosed product defects and keep one stable entry per bug.
Do not delete resolved entries; update their status and resolution fields so the
register preserves history. Diagnose before proposing a fix, and do not mark a
bug resolved until the listed verification is complete.

Every entry must include:

- A stable identifier, title, affected area, and current status.
- Environment and reproduction steps.
- Expected and actual behavior.
- Bug summary and evidence.
- Root cause, including confirmed facts versus open hypotheses.
- Proposed fix and explicit non-goals.
- Tests or verification required, plus completed results.
- Anything noteworthy, related documentation, and linked implementation work.

Use UTC timestamps with seconds and a `Z` suffix. Prefer these statuses:
`Open`, `Needs reproduction`, `Diagnosed`, `In progress`, `Blocked`,
`Resolved`, and `Closed`.
Keep proposed fixes here until implementation is actually made; then update the
entry with the shipped change and verification result.

## Current validity and closure plan

A report is not automatically a patch request. Before implementing an open
item, check whether its symptom still exists on the current staging web/API
build. Record the deployed SHAs, reproduction steps, outcome, and relevant
request/response evidence. If it no longer reproduces, close it as
**Not reproduced on [build]** or **Superseded by [change]**, and record what
was checked. Do not leave a stale bug open just because its original report
exists, and do not infer a fix from one successful happy-path test.

For a partial reproduction, split out any distinct remaining symptom rather
than silently broadening the old issue. For an inconclusive run, keep the bug
open as **Needs reproduction** and state the missing evidence. An item is
closed only when its individual closure evidence below is recorded; staging
acceptance is separate from a local implementation or code review.

### Open and awaiting-acceptance items

| ID | Current validity assessment | Next work | Closure evidence |
|---|---|---|---|
| [BUG-AUTH-003](#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session) | Still actionable: historical reuse revocations are confirmed; the exact browser trigger is unknown. User reports short-term stability at a 5-minute access lifetime, but the 1-day refresh lifetime and full multi-tab/reload case are not validated. | Confirm deployed API/web SHAs and the 1-day refresh setting; run the reload, concurrent-tab, interrupted-response, and account-fallback matrix. Use BUG-AUTH-011 diagnostics if the failure recurs. | All matrix cases pass on the recorded staging build and the user-reported 1-day check is recorded. If the original symptom does not reproduce across that matrix, close as not reproduced on that build while retaining the historical reuse evidence and unknown trigger. |
| [BUG-AUTH-006](#bug-auth-006--refresh-grace-replay-forks-token-family) | Confirmed API defect; deterministic retry fix exists locally, but staging deployment/acceptance is pending. | Deploy the fix with the API build recorded; test concurrent, same-operation, different-operation, lost-response, and stale-after-grace paths. | Staging proves one active child per family for retries, while unrelated stale reuse still revokes the family; record build and row/event evidence. |
| [BUG-AUTH-008](#bug-auth-008--account-switching-can-race-across-open-tabs) | Still actionable by report: the switcher became disabled after switching with several tabs. Cross-tab lock patch exists, but the failure state and current-build reproduction are not captured. | Reproduce on the identified staging build; capture each tab's selected slot/busy state and switch request status/duration. Distinguish a pending request from stale UI or recovery overlay before patching. | Repeat switches succeed and controls recover after success, failure, and timeout in multiple tabs; capture the feed-load HTTP status separately or split that symptom into its own bug. If absent on current build, record the same scenario and close as not reproduced. |
| [BUG-AUTH-009](#bug-auth-009--session-ended-recovery-ownership-can-leave-close-inoperative) | The code-level failure and user-reported Close issue are addressed locally; staging ownership behavior still needs acceptance. | Verify notice synchronization, takeover from the waiting screen, serialized recovery against account switching/logout, and the modal close busy state in multiple tabs. | Owner and waiter states, Close/X, account selection, and Add account each complete once and converge across tabs; no enabled action is inert. |
| [BUG-AUTH-010](#bug-auth-010--account-switches-accumulate-active-refresh-token-families) | Fix implemented locally: switches reuse the validated destination refresh cookie; absent or unusable cookies use a locked, session-validated repair path. Existing families are not bulk-revoked. | Deploy/identify the API build; verify repeated switches, missing/stale cookies, concurrent refresh, slot isolation, and revocation. | Repeated switches do not add families; repair remains recoverable and slot-isolated; record staging build and database evidence. |
| [BUG-AUTH-011](#bug-auth-011--refresh-failures-lack-enough-correlated-diagnostics) | Correlated, redacted runtime and durable refresh-attempt diagnostics are implemented locally. | Apply migration, deploy/identify the API build, and verify durable rows plus runtime log access. | Representative success and failure requests correlate by request/operation ID, route, deployment, slot/cookie-presence, and safe failure class, with no secrets logged. |
| [BUG-AUTH-007](#bug-auth-007--terminal-session-recovery-can-loop-between-public-site-and-app) | Fix implemented locally; current staging acceptance pending. | Deploy/identify the changed web build and exercise stale positive, zero, absent, and malformed hints with valid/invalid alternate accounts and terminal/transient failures. | Each case follows the documented in-app/public fallback with no loop; record build and observed route. |
| [BUG-AUTH-005](#bug-auth-005--failed-account-switch-shows-sign-in-for-the-previous-account) | Fix implemented locally; staging acceptance pending. | Fail a target-account switch while the source remains valid; also test terminal target failure and transient failure. | Source stays active for a non-terminal target failure; any recovery action names the target, never the unrelated source. |
| [BUG-AUTH-004](#bug-auth-004--successfully-restored-account-remains-last-in-the-switcher) | Fix implemented locally; staging acceptance pending. | Restore a non-first remembered slot through normal and grace refresh branches, then inspect account-list order. | Restored account becomes first/current; failed refresh does not change recency; explicit switching still updates order. |
| [BUG-AUTH-002](#bug-auth-002--public-landing-blocks-while-checking-for-a-session) | Current code appears to render public content immediately and probe in the background; report may already be fixed. Staging/production-equivalent acceptance is pending. | Verify no-session public entry and valid/invalid remembered-session behavior on current staging build, including network failure. | Public page is never blocked by session probing; protected routes still restore/reject correctly. If already true, close as superseded by the recorded guard change. |
| [BUG-NAV-001](#bug-nav-001--route-changes-remount-the-app-shell-and-may-discard-in-progress-work) | Historical report; provider mitigates many route-state losses and restoration flash. No specific remaining lost operation has been confirmed. | Later, reproduce a specific in-app route transition and named user operation; inspect state and completion feedback. Keep tab closure separate. | If no user-visible loss or flash reproduces, close as superseded with tested build/routes. Otherwise narrow to the operation that fails. |
| [BUG-OPS-001](#bug-ops-001--closing-a-tab-can-leave-an-in-flight-operations-outcome-unknown) | Newly recorded from user clarification: closing the initiating tab may end the request or leave its server outcome unknown to the user; no cross-tab result recovery has been verified. | Later, reproduce a mutation with tab closure before send, during processing, and after server commit but before response. Identify operation-specific idempotency and result-recovery behavior. | On reopening another tab, the user can determine whether the operation committed and retry safely without duplicating it; document which operation classes are covered. |
| [BUG-LOAD-001](#bug-load-001--multiple-tabs-can-intermittently-fail-home-and-profile-loads) | Newly reported; code confirms overlapping reads and missing general retries, but no request evidence ties them to the multi-tab failure. | Reproduce with several tabs; capture failed Home/profile request URLs, statuses, response bodies, timings, and deployed SHAs. | Reproduction identifies affected endpoints and failure response; transient failures have a clear recovery path and multi-tab load succeeds on current staging build. |
| [BUG-CHAT-002](#bug-chat-002--new-chat-people-search-reports-unavailable-on-staging) | Stale report: screenshot confirms the error at report time, but current endpoint/build has not been rechecked. | Reproduce `/chats/new` on current staging and capture the people-search status/body and API runtime error for both a match and no-match query. | Search returns eligible matches, empty results, and retryable errors as specified without loosening privacy/eligibility. If no longer reproducible, close with build/query/result evidence. |

### Execution order

1. Record the current staging web and API deployment SHAs and confirm the
   configured token lifetimes. Do not compare an incident to an unidentified
   build.
2. Deploy BUG-AUTH-011 and confirm staging runtime log access/retention before
   relying on future auth failures for root-cause evidence. Existing bugs can
   still be checked using currently available browser and runtime data.
3. Run the session stability group (BUG-AUTH-003 and BUG-AUTH-006), then the
   multi-tab switch/recovery group (BUG-AUTH-008 and BUG-AUTH-009). BUG-AUTH-009
   now has a local implementation awaiting the ownership acceptance matrix. Keep
   BUG-AUTH-010's family-count check separate from causal claims about session
   loss.
4. Complete staging acceptance for the already implemented route/switch fixes
   (BUG-AUTH-002, 004, 005, and 007). Close each independently with its own
   result; a pass for one does not close the others.
5. Reproduce or close BUG-NAV-001, then investigate BUG-OPS-001's tab-close
   outcome and recovery behavior separately from in-app navigation. Reproduce
   BUG-LOAD-001 with request evidence, then reproduce or close BUG-CHAT-002
   against the current build. Patch only verified gaps.

### Closure record

For each closure, add a dated result under that bug's **Tests and
verification**: disposition (`fixed`, `not reproduced`, or `superseded`), exact
build/environment, steps, observed result, and any linked request or test
evidence. Preserve the original report and diagnosis for history. An item that
still needs a missing log, build identity, or user reproduction stays open;
do not label it resolved based only on an inferred cause or a local patch.

## Entry template

Copy this template for a new defect and replace every placeholder:

```markdown
## BUG-[AREA]-[NUMBER] — [Short title]

- **Status:** Open | Needs reproduction | Diagnosed | In progress | Blocked | Resolved | Closed
- **Reported/updated:** YYYY-MM-DDTHH:mm:ssZ
- **Affected area:** [Product area and routes/components]
- **Environment:** [development | staging | production | all; browser/device if relevant]
- **Severity:** [low | medium | high | critical]

### Bug summary
[One concise statement of the defect and user impact.]

### Reproduction
1. [Step]
2. [Step]
3. [Step]

### Expected behavior
[What should happen.]

### Actual behavior
[What happens instead.]

### Root cause
- **Confirmed:** [Evidence-backed cause.]
- **Open questions:** [Unverified hypotheses, or `None`.]

### Proposed fix
[Smallest shared/component-level fix and required release work.]

### Tests and verification
- **Required:** [Regression and acceptance checks.]
- **Completed:** [Checks already run, or `None — diagnosis only`.]

### Noteworthy
[Risks, related bugs, non-goals, rollout notes, and other context.]

### Related documentation and implementation
- [Relevant documentation](relative/path)
- [Relevant source](relative/path)
```

## Defect entries

## BUG-AUTH-008 — Account switching can race across open tabs

- **Status:** Reopened — the multi-tab failure was reported again after the cross-tab lock patch; exact cause pending
- **Reported/updated:** 2026-09-29T14:22:19Z
- **Affected area:** Account switching and session restoration across browser tabs
- **Environment:** Staging; multiple tabs in one browser profile
- **Severity:** medium

### Bug summary

With multiple Friink tabs open, account switching can fail or leave the
switcher unavailable until the extra tabs are closed and the page is reloaded.

### Reproduction
1. Sign in to two remembered accounts in one browser profile.
2. Open the app in several tabs.
3. Switch accounts repeatedly from one or more tabs, or refresh the tabs while
   the selected account is changing.
4. Observe the switcher become disabled or a tab fail to restore the selected
   account. Closing the extra tabs and reloading restores normal behavior.

### Expected behavior

Switches serialize across tabs, and every tab converges on the selected
account. A restore response for an earlier selection cannot replace a newer
selection.

### Actual behavior

The selected account is shared across the browser and other tabs reload when it
changes. The earlier implementation had no cross-tab switch lock; the current
code serializes switches and reloads/restores tabs when selection changes. In
the latest staging report, after switching once among multiple open tabs, the
switcher became disabled. The currently observed busy flag is local to each
SideDrawer instance, while the operation lock is browser-wide. The logs and
request timing needed to identify why the control remained unavailable were
not captured.

### Root cause
- **Confirmed:** The earlier cross-tab race was present and has a lock/recheck
  implementation in the current branch. The new report confirms the user-visible
  disabled-switcher symptom still occurs with multiple tabs. Busy state is
  currently local to a mounted drawer; `switchAccount()` serializes the request
  across tabs.
- **Open questions:** The latest switch request, its duration/result, active
  selection, and per-tab busy state were not captured. It is not yet known
  whether the disabled control represents a still-running request, stale local
  state, a session-recovery overlay, or another failure. The earlier feed-load
  failure with three or four tabs remains separately undiagnosed.

### Resolution in progress

Switches now use a browser-wide exclusive lock, read the source session after
the lock is acquired, and save the destination selection before releasing the
lock. Session restoration retries when its selected slot changes while
`/auth/me` is pending. The patch is committed as `854860c` on the staging
branch. The user reports that login and ordinary account switching passed on
staging; the multi-tab regression itself has not been tested there.

### Tests and verification
- **Required:** Repeated and simultaneous switches in both directions with two
  or more staging tabs; record request start/end, selected slot, response status,
  and each tab’s busy state. Confirm controls recover after success, failure,
  and timeout. Separately capture the HTTP status for feed failures with three
  or four tabs.
- **Completed:** Web TypeScript check passed. An earlier user-reported staging
  smoke check passed for login and ordinary switching; the latest user report
  reproduces the multi-tab disabled-switcher symptom.
- **Pending:** Diagnose the latest multi-tab failure and complete staging
  verification. Feed failure status remains uncaptured.

### Noteworthy

This change does not alter JWT lifetime, refresh-token rotation, or server-side
authorization. The lock coordinates only browser tab operations. The feed
failure is tracked as an open diagnosis and is not claimed as fixed here.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Account selection rule](rules.md#auth-r-041--account-switching-is-serialized-across-tabs)
- `web/lib/auth.ts`
- `web/components/side-drawer.tsx`

## BUG-AUTH-009 — Session-ended recovery ownership can leave Close inoperative

- **Status:** Fix implemented locally; multi-tab acceptance pending
- **Reported/updated:** 2026-09-29T21:33:43Z
- **Affected area:** Web session recovery notice, acknowledgement, and fallback across tabs
- **Environment:** Staging; multiple tabs in one browser profile
- **Severity:** high

### Bug summary

When recovery ownership changes between tabs, a tab can continue showing an
owner modal while its Close and X handlers silently do nothing. Other tabs can
remain on a waiting screen with no action to acknowledge the notice.

### Reproduction
1. Sign in to two remembered accounts and open the app in several tabs.
2. Cause a terminal session result in one tab, then let another tab take over
   after the owner is backgrounded or delayed.
3. Observe a waiting screen in some tabs and a Session ended modal in others.
4. Try Close in the modal after ownership has moved; Add account may still open
   the login flow.

### Expected behavior

A user can acknowledge recovery from the visible recovery UI, or the UI clearly
identifies the tab that can do so. Ownership changes are reflected promptly and
cannot leave an enabled but ineffective action.

### Actual behavior

The waiting screen says another tab will continue after acknowledgment but has
no button. The modal's Close and X both use the same handler. That handler
returns silently if the tab's stored owner state is false or its tab ID no
longer matches the shared notice.

### Root cause
- **Confirmed in current web code:** The termination notice uses an 8-second
  localStorage lease. Claiming is a read followed by a write, and the component
  only sets its local `owner` state to true after a claim; it does not track a
  later ownership loss. `cancelSessionRecovery()` silently returns when the
  current tab is no longer the owner. The waiting screen has no acknowledge
  action.
- **Open questions:** The staging browser did not capture notice contents,
  ownership transitions, or which tab handled the first terminal response.
  This code path explains how Close can no-op, but the exact incident ordering
  and whether all tabs truly held the same notice ID are unverified.

### Proposed fix

Use a cross-tab recovery operation with a reliable ownership/acknowledgment
hand-off. Synchronize notice ownership changes into each tab, make Close either
acquire recovery safely or route to the active recovery operation, and avoid a
silent no-op. Keep fallback idempotent so duplicate user actions cannot change
the selected account twice. Preserve API session validation and token rules.

### Resolution implemented locally

Recovery notice writes now notify the current tab and synchronize owner state
through same-tab events and cross-tab storage events. Claims and user recovery
actions share the account-selection lock with switch/logout operations. A user
can continue from a waiting tab, and either Close control enters the serialized
recovery action instead of returning early because that tab lost ownership.
The modal close control is disabled while a restore/fallback is already
running. Token issuance, expiry, API session validation, and fallback ordering
are unchanged.

### Tests and verification
- **Required:** With several staging tabs, trigger terminal recovery; test owner
  foreground/background, owner close, simultaneous takeover, Close/X from each
  visible state, account selection, Add account, and fallback completion. Confirm
  exactly one effective recovery operation and convergence in all tabs. Confirm
  the close control is visibly disabled while an operation cannot be cancelled.
- **Completed locally:** Implemented owner synchronization, serialized claims
  and recovery actions, waiting-tab continuation, and close busy state.
  `npx tsc --noEmit --incremental false` passed. No automated tests or
  browser/staging acceptance run for this change.

### Noteworthy

The waiting screen now offers **Continue here**, which safely claims the
recovery action under the shared account-operation lock. Staging acceptance is
still needed, especially for backgrounded owners and browsers without Web
Locks. This defect is separate from whether a remembered account's refresh
token remains valid.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Error Handling](units/error-handling.md)
- `web/components/session-recovery-screen.tsx`
- `web/components/app-shell-route.tsx`
- `web/lib/auth.ts`

## BUG-AUTH-010 — Account switches accumulate active refresh-token families

- **Status:** Implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-29T21:50:21Z
- **Affected area:** Account-switch API and slot-scoped refresh cookies
- **Environment:** Staging; remembered accounts switched repeatedly
- **Severity:** medium

### Bug summary

Each successful account switch created a new refresh-token family for the
destination session, while earlier families for that session remained active.

### Reproduction
1. Sign in to two remembered accounts on one device.
2. Switch between them repeatedly.
3. Inspect refresh-token families attached to the destination account session.

### Expected behavior

Switching an account should not create unbounded, independently usable refresh
credentials for the same remembered session. The destination slot's existing
valid refresh cookie should remain usable; a missing/invalid cookie should be
repaired only after the device slot and session are validated.

### Actual behavior

Before the local fix, `POST /auth/accounts/switch` issued a new refresh token
and overwrote the destination slot cookie on each switch. The previous family
was not revoked by the switch route. The staging database audit found 13
unrevoked, unexpired refresh-token families attached to
`@muflahulfurqan`'s active slot session at the time of the audit.

### Root cause
- **Confirmed:** The former switch endpoint created a fresh family on each
  successful switch and did not revoke earlier families for that auth session.
  The staging rows confirm multiple active families on one session.
- **Open questions:** The rows do not prove that this accumulation caused the
  reported recovery screen. `@muflahulfurqan` remained active and was switched
  to successfully after the incident. Staging must still verify the repair
  path when a destination cookie is stale and refresh is concurrent.

### Proposed fix

The switch endpoint now locks and validates the destination auth session, then
checks that the destination slot's HttpOnly refresh cookie belongs to the same
user and session and is active and unexpired. It reuses that credential without
issuing a refresh token. If the cookie is missing or unusable, it creates a
replacement only after destination validation. Existing families are not
bulk-revoked because other tabs may still be using them.

### Tests and verification
- **Required:** On staging, repeat switches in both directions and verify the
  active family count does not grow per switch. Cover an absent cookie, stale
  cookie, concurrent refresh, multiple tabs, and revocation of the account
  session. Confirm cookies remain slot-scoped and a switch cannot authorize
  another account.
- **Completed locally:** The API now reuses a validated destination refresh
  cookie and only repairs it after locking and validating the destination
  session. The focused account-switch API test passes, including repeated
  switches, unchanged destination cookie, stable active-token count, and a
  successful refresh response. The pytest process then reported its existing
  Windows SQLite cleanup `PermissionError`; test cleanup did not complete
  cleanly. Staging acceptance remains pending.

### Noteworthy

This is confirmed token-family accumulation, not proof that the refresh token
expired or that the session was revoked during the reported incident. Existing
families may remain until expiration or session revocation; cleanup requires a
separate safe rollout decision.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Refresh-family replay bug](#bug-auth-006--refresh-grace-replay-forks-token-family)
- `api/app/routers/auth.py`
- `api/app/services/session_service.py`
- `api/app/models/refresh_token.py`

## BUG-AUTH-011 — Refresh failures lack enough correlated diagnostics

- **Status:** Migration applied in production; application deployment and staging verification pending
- **Reported/updated:** 2026-09-29T22:03:18Z
- **Affected area:** API auth-failure logging and session incident diagnosis
- **Environment:** Staging and any environment where request-level auth traces are needed
- **Severity:** medium

### Bug summary

The durable database audit does not record every failed refresh response or
correlate it with the selected account slot and browser request, preventing an
exact diagnosis from database records alone.

### Reproduction
1. Cause an auth or refresh request to fail terminally.
2. Inspect `security_events` and refresh-token rows.
3. Observe that successful refreshes and reuse detections are durable, while
   missing-cookie, invalid-cookie, and session-state failures are not represented
   there as a complete request trace.

### Expected behavior

A staging incident can be traced to a request, deployment, selected slot, and
safe failure classification without exposing credentials.

### Actual behavior

At report time, the database query for the 2026-09-29 incident showed no
refresh-reuse event for either account. It could not reveal the failed HTTP
status/code or which slot-scoped cookie was present. Before the durable
diagnostic migration, the API emitted `auth_failure_classified` warnings, but
the incident's Vercel runtime logs were not available to this audit. Those
prior failure logs lacked a request correlation ID and slot/cookie-presence
context.

### Root cause
- **Confirmed:** Database security events do not persist every HTTP refresh
  failure or client request ID. Before this fix, API failure logs omitted a
  request ID, account-slot context, and whether the expected slot cookie was
  present. Raw credential values must not be logged.
- **Open questions:** The failure code and response from the reported request
  remain unknown until staging API runtime logs for the incident are retrieved.
  It is not yet established whether logging configuration or retention also
  contributed to their unavailability.

### Proposed fix

The API now generates an opaque request ID for each request, returns it in
`X-Friink-Request-Id`, and exposes that response header through CORS. Every
`POST /auth/refresh` request emits a structured runtime event and persists one
redacted `auth_refresh_attempts` row with request/operation correlation,
hashed tab/slot identifiers, known session context, deployment, outcome,
status, failure class, and duration. No token, cookie, token hash, raw slot,
raw tab identifier, or credential is stored. Durable persistence is
best-effort, so diagnostic failure cannot change an authentication result.
Migration execution, runtime access, and retention still need verification.

### Tests and verification
- **Required:** Apply the migration and verify representative missing,
  invalid, expired, rotated, revoked-session, and successful refresh requests
  in staging. Confirm the response request ID matches both the runtime event
  and durable row, operation/tab correlation is present when supplied, and no
  secret values appear. Verify runtime log access and retention; retrieve the
  exact 2026-09-29 time window if platform retention allows.
- **Completed locally:** Endpoint verification captured both a successful
  refresh (`200`) and an invalid-token failure (`401`, `REFRESH_TOKEN_INVALID`).
  Both response IDs matched their structured runtime events, including route,
  deployment SHA, slot-header/cookie presence, and safe failure class. Tests
  confirmed the slot value and invalid token were absent from the events.
  Staging log access/retention remains unverified.

### Noteworthy

`AUTH_DEBUG_LOGGING_ENABLED` controls supplementary token-lifecycle stdout
messages. The standard `auth_failure_classified` warning and the durable
refresh-attempt row are emitted independently of that flag. This bug tracks
observability; it does not change how the API accepts or rejects a session.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Refresh stability bug](#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session)
- `api/app/services/auth_debug.py`
- `api/app/routers/auth.py`

## BUG-AUTH-007 — Terminal session recovery can loop between public site and app

- **Status:** Fix implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-27T21:44:24Z
- **Affected area:** Public root routing, public route guard, terminal session recovery, remembered-account hint cookie
- **Environment:** User report; browser-specific cookie and API trace unavailable
- **Severity:** high

### Bug summary

After a terminal session failure from public entry, a visitor could be sent
between the public site and app recovery even if another remembered account
could still be restored.

### Reproduction
1. Open the public site with a stale positive `friink_session_hint`, or with a
   zero hint while `/auth/entry-status` indicates that restoration should be
   attempted.
2. Let session restoration fail terminally, producing the “This account
   session ended” notice, or acknowledge that notice after protected-app entry.
3. If no remembered slot validates, return to `/` and observe whether public
   entry immediately sends the browser back to `/home` and recovery.

### Expected behavior

If another remembered session validates, recovery keeps the user in Friink.
Once no remembered session validates, the visitor remains on the public site
and can choose login. The redirect hint is only a routing optimization and
cannot force repeated entry into a known-failed recovery path.

### Actual behavior before the fix

Two code paths can re-enter app recovery. A positive hint makes server-rendered
`/` redirect to `/home` before session validation. With a zero hint, the public
page's `PublicRouteGuard` can still request `/auth/entry-status`, attempt
restoration, and route to `/home` on terminal failure. In app recovery, the
acknowledgment fallback can find no valid slot, clear the current auth state,
and return to `/`; `clearAuthSession()` can nevertheless retain a positive
hint when another cached slot summary exists.

### Root cause
- **Confirmed:** The hint reflects saved-session/cache state, not validated
  session state. `/auth/entry-status` also prompts a restore attempt rather
  than validating a session. The public guard's terminal restore path routes
  to `/home`; app recovery's hint calculation can remain positive based on a
  remembered summary that no longer restores. These independent paths can
  sustain the redirect loop.
- **Open questions:** The reported browser's exact hint value, remembered-slot
  summaries, `/auth/entry-status` response, and restore API responses were not
  captured. Therefore this is a confirmed implementation-level loop risk, not
  proof of which path triggered the specific incident.

### Resolution implemented locally

The app-shell route treats an unacknowledged cross-tab termination notice as
recovery context rather than proof that the current slot is unavailable. On
route entry it validates the current slot first; only a fresh terminal response
may show the session-ended modal and trigger remembered-account fallback.

After the public guard receives a confirmed terminal restore failure, it now
clears the redirect-only `friink_session_hint` and hands off to shared app
recovery. That flow tries remembered accounts and keeps the user in Friink
when one validates. When app recovery exhausts all remembered candidates, it
clears the hint before returning to `/`. Authentication, token validation,
and fallback authorization are unchanged.

### Tests and verification
- **Required:** Browser checks for positive, zero, missing, and malformed hint;
  entry-status positive/negative; terminal and ambiguous restore; stale and
  valid remembered slots; login reachable after all candidates fail.
- **Completed locally:** Targeted TypeScript check passed after the route
  changes. Real browser/staging acceptance remains pending; local Next dev
  server startup was blocked by `spawn EPERM`, so no browser acceptance was
  performed in this turn.

### Noteworthy

This finding does not establish that the hint cookie itself ended or invalidated
a session. The hint does not grant access. The subscription route migration is
unrelated. Auth/session behavior remains outside the scope of this diagnosis.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Active session and recovery rule](rules.md#auth-r-040--session-restoration-has-explicit-recovery-ux)
- `web/lib/public-session-entry.ts`
- `web/components/public-route-guard.tsx`
- `web/components/app-shell-route.tsx`
- `web/lib/auth.ts`

## BUG-AUTH-003 — Reload refreshes can destabilize or change the active session

- **Status:** In progress — user reports stability with a five-minute access
  token lifetime; one-day refresh-token validation is pending
- **Reported/updated:** 2026-09-29T13:03:33Z
- **Affected area:** Web session bootstrap, refresh-token rotation, account-slot coordination, and remembered-account recovery
- **Environment:** Production and staging user reports; prior staging API/database evidence; remembered accounts in one browser profile
- **Severity:** high

### Bug summary

After several browser reloads, an otherwise active account can appear expired,
fail restoration, or lead to recovery showing a different cached account. A
later direct visit to `/home` has sometimes opened the feed again. This makes
session continuity unreliable and risks users acting under a different account
than the one they selected.

### Reproduction

The user reproduced the account-switch sequence on staging and reports random
session failures on production as well:

1. With `@muflahulfurqan`, `@phase4test20260906`, and `@admin` remembered in the
   same browser profile, explicitly switch to `@muflahulfurqan`.
2. Refresh the app. During the observed reproduction, the app showed “Friink is
   having trouble reconnecting. Your account has not been signed out.”
3. Retry or refresh again as the user did during the report.
4. Repeat browser reloads. Observe a reconnect/recovery screen, a failed restore,
   a return to the public site or login, or a later direct `/home` visit that
   opens the feed again.
5. In the reported recovery screenshot, the failed restore named
   `@muflahulfurqan` while the primary sign-in action named `@admin`. The
   selected identity after the later `/home` success was not conclusively
   captured.
6. Earlier staging reproduction showed an unrequested switch to `@admin`; see
   BUG-AUTH-004 for the independent account-ordering defect.
7. The user reports that repeatedly refreshing the page and interrupting the
   reload while the session is restoring eventually kills the session.
8. The user then reproduced cross-tab divergence on staging: Admin was open in
   one tab, the user switched to Muflah in another tab, and both tabs could
   still post as their previous accounts. A third tab opened the site as Admin.

### Expected behavior

A normal reload should keep the selected account usable without rotating its
refresh token merely because the document reloaded. Adding or switching
accounts changes the selected account across all open tabs; other tabs reload
and restore that account. After confirmed termination, restore the most-recently
used other valid account, or return to the public site when none remain. A
transient failure must remain retryable and must not change accounts.

### Actual behavior

The app issues a short-lived, HttpOnly access cookie scoped to each remembered
account slot. A reload validates it through `/auth/me`; a still-valid cookie
restores the session without rotating the refresh cookie. Refresh runs only
when access is expired or absent. In-app route transitions can remount
page-level shell components, but do not inherently rotate the token when the
in-memory session survives. The updated implementation is deployed to staging
as of 2026-09-27, confirmed by the user.

**Latest user report (2026-09-29):** Session behavior is currently stable with
a five-minute access-token lifetime. Validation with a one-day refresh-token
lifetime is planned for 2026-09-30; that result is pending. This is an interim
stability report, not confirmation that the historical refresh-reuse trigger
is identified or that the full reload/multi-tab/lost-response matrix passes.

### Root cause

- **Confirmed from staging database:** The `security_events` and
  `refresh_tokens` rows contain this sequence on 2026-09-24 (UTC):
  - `@muflahulfurqan`'s token rotated at `20:56:35.915`; its one-time grace
    replay was consumed at `20:56:41.261`; another presentation of that stale
    token revoked the family at `20:56:47.164`. The durable
    `refresh_reuse_detected` event was recorded at `20:56:47.656`.
  - `@phase4test20260906`'s family had already been revoked for reuse at
    `20:51:22.962`; its durable `refresh_reuse_detected` event was recorded at
    `20:51:26.200`, leaving that remembered slot unable to refresh.
  - `@admin` then received a new refresh token at `20:57:11.404`; the refresh
    event was recorded at `20:57:12.226`, consistent with fallback reaching
    admin after the other accounts could not be restored.
- **Additional staging database audit (2026-09-26 UTC):** Read-only aggregate
  queries found 37 refresh-token families marked `reuse_detected` since
  September 1, spanning 32 linked sessions and 6 accounts. Four affected
  families still link to session rows marked active; 31 families link to 28
  revoked sessions, and two have no session row. The newest reuse revocation
  occurred at `13:34:45.652`; the linked session was marked
  `replaced_device_slot` at `13:35:14.276`. Of 24 session rows then marked
  active, 8 had no current unrevoked, unrotated, unexpired refresh-token row.
  This confirms persisted refresh-family revocations and session/token-state
  mismatches, but it does not explain which browser action presented the stale
  token or caused slot replacement.
- **Additional failed staging session-stability check (2026-09-27 UTC):** The
  user reported that `@muflah` could not be restored in both Chrome and Firefox
  and received “Could not restore @muflah. Choose another account or sign in.”
  The staging database contains matching `refresh_reuse_detected` events at
  `23:52:23.068Z` for Chrome and `23:57:07.859Z` for Firefox. In Chrome, the
  presented token had been rotated at `21:49:07.490Z`; in Firefox, it had been
  rotated at `23:23:34.401Z`. Those presentations were roughly 2 hours and 34
  minutes after rotation, respectively, far beyond staging's 60-second grace.
  The API revoked each refresh-token family for `reuse_detected`. Both linked
  auth-session rows still had `revoked_at = NULL`, so the durable evidence is
  refresh-family invalidation rather than explicit session revocation. GitHub's
  successful Vercel staging checks identify the tested build as `199fe90`
  (completed around `23:17Z`); the later `3f0514c` checks completed around
  `00:20Z`, after the incidents. That later commit changes terminal recovery
  UI/docs, not `web/lib/auth.ts` or API auth code. The database proves that
  stale rotated refresh tokens reached the API and triggered reuse protection,
  but it does not identify which tab/request held or resent them, or whether a
  cookie update was lost or overwritten.
- **Possible stale-cookie path, not established as the cause:** A standard
  login writes the same raw refresh token to both the generic
  `friink_refresh_token` cookie and the account-slot cookie. Slot-scoped
  refresh reads and updates the slot cookie, not the generic cookie. A refresh
  request without `X-Friink-Account-Slot` could therefore send the old generic
  value. However, the normal web restore and refresh path passes the account
  slot, and `requestApi` fills it from the active slot when absent. The stale
  generic-cookie explanation is therefore a lower-confidence edge case, not
  the leading explanation for ordinary app requests. The database proves
  previously rotated refresh-token values reached the API, but neither its
  events nor current auth logging records the selected cookie name,
  slot-header presence, tab/request ordering, or whether the browser received
  and retained the preceding `Set-Cookie`. A failed or overwritten cookie
  update, an overlapping request using an older cookie snapshot, and other
  stale-cookie paths remain unresolved.
- **Current mitigation:** Browser authentication now uses only the selected
  account-slot refresh and access cookies. The generic cookies are no longer
  read or issued; login and logout responses expire them for migration. This
  removes the generic-versus-slot cookie ambiguity from new sessions without
  changing the account-slot database model. Staging must still verify clean
  browser login, refresh, logout, and multi-tab behavior after deployment.
- **Production and Android scope:** A read-only production database check
  found ten `refresh_reuse_detected` events for `@muflah` in the prior 90 days.
  This includes an Android session event on 2026-09-16 (stored browser
  metadata: Samsung Internet / Android); the latest production event, on
  2026-09-27, is associated with Chrome / Windows. This confirms the same
  refresh-reuse failure class in production and on an Android session, but it
  does not identify the exact device for the user's reported Chrome-on-Android
  incident or prove malicious access. Staging's two 2026-09-27 events remain
  associated with Chrome and Firefox. The event records do not capture the
  request's cookie/header source, so they cannot distinguish a browser storage
  failure from concurrent legitimate refresh requests or token theft.
- **Local log availability:** `.codex-local-logs/api.log` was last written on
  2026-09-18 and contains standard Uvicorn request/status lines, not detailed
  auth lifecycle events. It includes overlapping successful `/auth/refresh`
  requests, but has no timestamps or operation IDs to correlate them with the
  staging revocations. No live local terminal output or staging HTTP log stream
  was available during this audit.
- **Confirmed in API behavior:** Re-presenting a rotated token after its
  single-use grace has been consumed revokes its token family and returns a
  terminal `401 REFRESH_TOKEN_INVALID`; this reuse protection remains enabled.
- **Confirmed API defects, fixed locally:** A local isolated SQLite API
  reproduction showed that retrying a committed refresh with the same
  operation ID after the one-second test grace returned
  `401 REFRESH_TOKEN_INVALID` and revoked the family. Another reproduction
  showed that a different operation ID inside grace revoked the existing
  deterministic child and issued a competing child. The API now recovers the
  same active deterministic child for the recorded operation ID after grace,
  returns that same child for any operation ID during grace, and continues to
  revoke the family for a different operation ID after grace. Regression
  coverage exercises all three outcomes. Staging and production records do not
  contain operation IDs, so we cannot prove which exact path occurred in each
  historical incident.
- **Additional client coordination concern (browser-dependent):** When the
  browser lacks the Web Locks API, the web client falls back to a
  `localStorage` read/publish/read lease. Those operations are not atomic, so
  simultaneous tabs could both believe they own refresh and send different
  operation IDs. This is a code-level race hypothesis; the reported Chrome and
  Firefox clients normally use Web Locks, and no browser reproduction has
  established this fallback as the cause.
- **Local short-expiry check (2026-09-29):** An isolated SQLite API integration
  test issued one-second access JWTs, let each expire, and completed three
  sequential refresh rotations successfully. This confirms that frequent
  sequential access-token expiry alone does not reproduce the refresh-reuse
  failure. It does not exercise concurrent tabs, interrupted/lost responses,
  or a real browser's cookie persistence.
- **Confirmed from user reproduction:** Repeatedly reloading and interrupting
  session restoration can end the session. This is consistent with interrupting
  a refresh exchange after its database commit but before the browser receives
  the replacement cookie: the browser can retain the old cookie and retry it.
  The exact request and response timing still needs capture in the browser
  network trace.
- **Historical implementation (superseded):** Full document entry previously
  called the refresh endpoint without first validating the slot access cookie.
  The current cookie-first behavior is documented in AUTH-R-008.
- **Confirmed from user reports:** Repeated browser reloads can lead to a
  recovery screen, public/login screen, or a later successful `/home` visit.
  Production and staging have both been reported affected.
- **Confirmed in web implementation:** The previous coordination key used
  `activeAccountSlot()` while `performRefresh()` read a shared localStorage
  slot. Coordination and refresh now use one captured slot, and ordinary
  responses are checked against the still-active slot before persistence.
- **Confirmed in web implementation:** Account selection was read from a
  per-tab `sessionStorage` value before the shared `localStorage` value. Each
  tab could therefore retain a different account after switching elsewhere;
  a new tab could inherit a stale tab value or fall back to whichever tab last
  wrote the shared key. The browser sent that selected slot header and the API
  correctly used the corresponding slot cookie. The fix makes the shared
  selected slot authoritative and reloads other tabs when it changes.
- **Open questions:** The persisted records prove that the same rotated token
  was presented repeatedly and that Phase could not be restored. They do not
  identify whether the repeated requests came from concurrent tabs, an
  interrupted refresh response, or another stale-cookie retry. The database
  does not retain every HTTP refresh failure or browser request identifier.
  The transient reconnect screen may be related to a lost response, but that
  link is not proven by the stored events. Neon cold start alone is not
  established as the cause. The new aggregate counts confirm this is not an
  isolated refresh family, but still do not distinguish concurrent tabs,
  interrupted responses, or another stale-cookie retry as the trigger.

### Staging audit — 2026-09-29 multi-tab recovery incident

The screenshot time (18:31 Pakistan time) corresponds to approximately
13:31 UTC. A read-only staging database query at 14:05 UTC found:

- `@muflah`'s older Chrome/Windows auth session was last active at 12:40:29 UTC.
  It was revoked at 13:37:00 UTC with `replaced_device_slot`, immediately after
  a fresh login session was created at 13:36:58 UTC. The new login was recorded
  at 13:37:02 UTC. This shows the old session was replaced by the subsequent
  login; it does not show a refresh-token expiry or reuse revocation at 13:31.
- `@muflahulfurqan`'s remembered session remained active, had a successful
  refresh recorded at 13:22:58 UTC, and received another refresh-token row at
  13:38:36 UTC. Its slot was used again at 13:38:38 UTC, consistent with the
  user's later successful switch.
- No `refresh_reuse_detected` event was found for either account during the
  incident window. The database does not retain every failed HTTP response or
  the cookie/header sent by each browser request, so it cannot identify the
  terminal response that first opened recovery.

This evidence does not support the hypothesis that both accounts' server
sessions died. It supports an active alternate session and a new `@muflah`
login after the reported screen. See BUG-AUTH-009 for the recovery ownership
failure, BUG-AUTH-010 for refresh-family accumulation, and BUG-AUTH-011 for the
request-level diagnostics needed to identify the original API failure. The
exact API response remains unconfirmed until staging runtime logs are reviewed.

### Resolution

The session bootstrap validates the slot-scoped HttpOnly access cookie through
`/auth/me` before refreshing. A valid access cookie avoids refresh-token
rotation on normal reloads. Refresh coordination captures one account slot,
validates the response against the active slot, and revalidates followers with
their own access cookie. GitHub Vercel checks show the failed staging run used
`199fe90`; the later `3f0514c` build completed after the reported incidents and
changes recovery UI, not refresh-cookie coordination. Since the failure
occurred on the build that already included the cookie-first and refresh
coordination changes, those changes had not passed the session-stability gate.
The API retry correction is implemented locally: identical committed
operations now recover the same still-active child beyond grace; competing
operation IDs in grace return the same child; unrelated stale retries after
grace still revoke the family. The user's five-minute stability report does
not establish whether that local API retry correction is deployed or prove the
historical stale-token trigger. Validation with a one-day refresh-token
lifetime is planned for 2026-09-30. Keep this bug open until deployment/build
state is confirmed and the one-day and broader multi-tab/reload/lost-response
checks pass. The exact trigger for the historical stale-token presentations
remains unknown.

### Earlier partial mitigations

1. Capture the active account slot once and use that exact value for both the
   refresh coordination key and the `/auth/refresh` request. Recheck that slot
   before committing the restored session so stale work cannot overwrite a
   later explicit account selection.
2. The earlier mitigation removed silent cross-account fallback and required
   explicit choice. The current continuity policy supersedes that interim
   behavior: confirmed terminal failures now validate other accounts in use
   order, while ambiguous failures still require explicit recovery.
3. Persist restored-slot recency during refresh transactions.

Those earlier changes improved account selection and stale-response isolation.
The resolved implementation adds access cookies to stop normal reload rotation.
The historical stale-token replay origin remains unknown.

### Implemented changes

Slot-scoped access cookies, session-bound JWT `sid` validation, cookie-first
entry restoration, captured-slot refresh coordination, cross-tab revalidation,
Origin checks for cookie-authenticated writes, and confirmed-terminal
most-recent-account fallback are implemented. Account addition and
switching now propagate one client-wide selected account to other tabs; when
no remembered session validates after confirmed termination, the app returns
to the public site. Refresh family-reuse detection remains enabled. Focused API
and frontend checks pass as recorded in the handoff. Full concurrent/lost-response
browser coverage remains useful follow-up verification. The evidence above
does not determine the origin of the historical repeated refresh requests, so
the refresh-replay origin remains unknown; the cross-tab account-selection
failure is separately confirmed in the web implementation.

### Follow-up verification

The original staging acceptance matrix, retained for future regression checks,
was: verify with production-parity cookie/security settings: repeated reloads do
not rotate a valid session's refresh credential; expired access refreshes once;
multi-tab, reload-during-refresh, and lost-response cases preserve family
reuse detection; account fallback uses last-use order; unsafe cookie-auth
requests reject disallowed origins. Do not promote until staging acceptance
passes. Add redacted request correlation as a follow-up if the historical
refresh-request origin needs to be distinguished conclusively.

Non-goals: storing refresh/access tokens in browser-readable storage, disabling
refresh-family reuse detection, or changing server authorization between
accounts.

### Tests and verification

- **Required:** Reproduce two tabs refreshing the same slot concurrently,
  then add an account or switch slots in one tab and verify every other tab
  reloads into that selected account. Terminate that session and verify all
  tabs use the same most-recent valid fallback, or the public site if none
  remains. Also verify that one rotation does not make the active account
  silently change. Simulate a successful server rotation
  whose response is lost, then retry with the stale cookie; verify grace and
  subsequent reuse behavior remain secure and understandable. Verify a
  terminal failure restores the next valid account by recency, while ambiguous
  failures preserve identity and require user choice. Include a multi-account
  staging browser acceptance run.
- **Completed locally:** Account access-cookie/revocation test, refresh-family
  reuse test, and account-slot suite pass with isolated SQLite. Browser reload
  in the local staging-connected app recovered the current account; the first
  reload refreshed once after access validation failed, and a subsequent reload
  validated successfully without another refresh exchange. The API access log
  confirmed `/auth/me` 200 responses. The duplicate-request origin and full
  concurrent/lost-response matrix remain unverified.

### Noteworthy

The database stores durable `refresh` and `refresh_reuse_detected` security
events, but not every HTTP error or client request ID. Detailed token-lifecycle
stdout events require `AUTH_DEBUG_LOGGING_ENABLED`; the local request log
available during the 2026-09-26 audit was stale and did not contain these
events. Never copy raw cookies, refresh tokens, token hashes, or internal UUIDs
into this register. The staging evidence establishes reuse and family
revocation, not the client-side origin of the duplicate requests.

### Related documentation and implementation

- [Account Access unit](units/account-access.md)
- [Session restoration rule](rules.md#auth-r-040--session-restoration-has-explicit-recovery-ux)
- [`refreshAuthSession()` and refresh coordination](../web/lib/auth.ts)
- [`POST /auth/refresh`](../api/app/routers/auth.py)
- [Refresh-token reuse model](../api/app/models/refresh_token.py)
- [Account-slot ordering](../api/app/services/account_slots.py)

Account-slot ordering is now derived from active `auth_sessions` joined to
`recognized_devices`; the former dedicated `account_session_slots` table is
retired by migration `20261002_0062` and is not replaced with slot-specific
database fields.

## BUG-AUTH-006 — Refresh grace replay forks token family

- **Status:** In progress — fixed locally; staging acceptance pending
- **Reported/updated:** 2026-09-29T12:09:15Z
- **Affected area:** API refresh-token rotation and retry-grace handling
- **Environment:** All environments running the current implementation
- **Severity:** High

### Bug summary

A concurrent or retried refresh request presenting a just-rotated token could
cause the API to issue a second active replacement in the same refresh-token
family. The local fix returns the existing deterministic child instead.

### Reproduction

1. Present an active refresh token to `POST /auth/refresh` and allow the API to
   commit its rotation, creating replacement A.
2. Within the configured grace period, present the original token again.
3. Inspect the rows for that family. The grace branch creates replacement B
   while replacement A remains unrevoked and unrotated.

### Expected behavior

A retry of a refresh operation should recover its committed result without
creating a second independently usable refresh token in the family.

### Actual behavior before the local fix

The API creates another refresh-token row in the same family during grace
handling. Both the original replacement and the grace replacement can remain
usable until one is rotated or the family is revoked.

### Root cause

- **Confirmed:** `POST /auth/refresh` locks the presented row. After one request
  rotates it and commits, another presentation may enter the grace branch.
  That branch sets `reuse_grace_used_at` and calls `issue_refresh_token()` with
  the same `family_id`, but does not revoke the first replacement or link the
  newly issued row as the replacement. `refresh_tokens` has a non-unique family
  index and no constraint limiting a family to one active token.
- **Open questions:** Whether this exact branch caused the staging incident in
  BUG-AUTH-003 is not established. The recorded reuse events prove stale-token
  replay and family revocation, but do not identify the originating browser
  requests.

### Proposed fix

Make grace retries idempotent so they recover the already-committed refresh
result instead of forking the family. Preserve refresh-token hashing at rest
and bounded family-reuse detection.

### Local implementation and remaining acceptance

Normal refresh derives the successor deterministically with keyed HMAC using
the parent token, row/family IDs, and configured signing-key ID. The child row
stores its derivation-key ID alongside the SHA-256 token hash, and the parent
stores the refresh operation ID supplied by the client. The fix returns this
same active child for matching operation retries even after grace, and for any
operation ID during grace; a different operation ID after grace still revokes
the family. This prevents competing children without disabling replay
detection. Existing rows without a deterministic successor retain their
one-time legacy grace behavior. The refresh audit event is written after the
rotation transaction commits. Regression coverage passes locally; API
deployment and browser acceptance remain pending.

### Tests and verification

- **Required:** On staging, verify concurrent same-slot refreshes, response
  loss/reload recovery after the normal grace period, different-operation
  retries within grace, and unrelated stale-token reuse after grace. Confirm
  one usable refresh token per family and that session switching remains
  stable. Verify migration compatibility for rows without deterministic
  successors.
- **Completed locally:** The focused refresh-token test module passes on
  disposable SQLite, including a real FastAPI request/response check for
  matching-operation recovery after grace, multiple different operation IDs
  receiving the same child within grace, and reuse revocation after grace.
  Staging schema remains at its migration head; API deployment and browser
  acceptance are pending.

### Noteworthy

This is an API rotation-logic defect with a related database constraint gap.
It is tracked separately from BUG-AUTH-003 because the client-side trigger for
the staging replay sequence remains unknown.

### Related documentation and implementation

- [Reload/session continuity bug](#bug-auth-003--reload-refreshes-can-destabilize-or-change-the-active-session)
- [Account Access unit](units/account-access.md)
- [`POST /auth/refresh`](../api/app/routers/auth.py)
- [Refresh-token model](../api/app/models/refresh_token.py)

## BUG-AUTH-005 — Failed account switch shows sign-in for the previous account

- **Status:** Fix implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-27T21:44:24Z
- **Affected area:** Remembered-account switching and session-recovery identity
- **Environment:** Staging; browser with `@admin` active while switching to
  `@muflah`
- **Severity:** high

### Bug summary

After switching from active `@admin` to `@muflah` fails, the session-recovery
screen offers “Sign in as @admin.” The recovery action names the previous
account instead of the account whose switch failed, confusing which session
needs attention.

### Reproduction

1. On staging, keep `@admin` active and ensure `@muflah` is a remembered
   account.
2. Use the account switcher to select `@muflah` and let that switch fail.
3. On the resulting recovery screen, observe the primary action reads “Sign in
   as @admin.”

### Expected behavior

The failed switch must not present sign-in for an unrelated account. If
`@admin` remains valid, keep it active and show a failure tied to the attempted
`@muflah` switch. If recovery is required for `@muflah`, identify that target
account explicitly. Never imply that `@admin` expired because another
account's switch failed.

### Actual behavior

The recovery screen reports an expired/unavailable session and offers “Sign in
as @admin,” alongside Log out and Choose another remembered account.

### Root cause

- **Confirmed in code:** `switchAccount()` sent the destination slot in
  `X-Friink-Account-Slot`, but the API dependency validates that header against
  the source bearer JWT's user and auth session. A cross-account switch
  therefore failed before the switch handler ran. The resulting
  `SESSION_NOT_FOUND` was classified as terminal by the generic authenticated
  request handler, which cleared the source session and opened recovery.
- **Confirmed in code:** If the switch handler did run and found an unavailable
  destination, it also returned `401 SESSION_NOT_FOUND`, which incorrectly
  described destination failure as source-session termination.
- **Open questions:** Staging browser acceptance must still confirm the exact
  request/response sequence and visible behavior after deployment.

### Resolution in progress

The web client now identifies the source slot in the header and sends the
destination only in the request body. An unavailable destination returns a
non-terminal `404`, preserving a valid source session. The switcher can show a
target-specific retryable failure without invoking session recovery.

Non-goals: silently retrying with credentials for either account or changing
the remembered-account list order.

### Tests and verification

- **Required:** On staging-equivalent data, fail a target switch while the
  source account remains valid and verify the source stays active with a
  target-specific error. Also test a confirmed terminal target session and
  verify any sign-in action names the target account. Cover transient errors
  and ensure they do not clear or mislabel the source session.
- **Completed locally:** Targeted API tests cover the source/destination slot
  contract, ensure a mismatched source header does not invalidate the valid
  source, and ensure an unavailable destination leaves the source usable.
  Staging browser acceptance remains pending.

### Noteworthy

This is distinct from reload fallback/order defects in BUG-AUTH-003 and
BUG-AUTH-004. The recovery screen controls visible in the screenshot are
evidence of the behavior, not evidence that those controls are the requested
solution.

### Related documentation and implementation

- [Account Access unit](units/account-access.md)
- [Session restoration rule](rules.md#auth-r-040--session-restoration-has-explicit-recovery-ux)
- [`switchAccount()` and restoration context](../web/lib/auth.ts)
- [`AppShellRoute` recovery identity](../web/components/app-shell-route.tsx)

## BUG-AUTH-004 — Successfully restored account remains last in the switcher

- **Status:** Implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-24T21:58:14Z
- **Affected area:** Account-slot recency persistence and switcher ordering
- **Environment:** Staging; observed during BUG-AUTH-003 reproduction
- **Severity:** medium

### Bug summary

After session recovery selects a remembered account, the account is shown as
current but can remain at the bottom of the switcher instead of moving to the
top as the most recently used account.

### Reproduction

1. Ensure multiple remembered accounts exist and the account to be restored is
   not currently first in the switcher.
2. Trigger a successful slot-aware session restore (the staging incident
   restored `@admin` after other slots failed).
3. Open the account switcher and compare its current checkmark with row order.
4. Observe that the restored account can remain last.

### Expected behavior

A successful restore updates that slot's `last_used_at`, and the account list
then places it first while marking it current.

### Actual behavior (before fix)

The restored account can be marked current without its server-side recency
being updated, so `GET /auth/accounts` continues returning the old ordering.

### Root cause

- **Confirmed:** The normal refresh-token rotation branch previously committed
  before setting `slot.last_used_at`, so the request-scoped session discarded
  the timestamp. `list_slots()` orders by persisted recency. The normal and
  grace refresh branches now set recency before their transaction commit.
- **Confirmed from staging:** Admin's successful refresh event at
  `20:57:12.226 UTC` follows the account fallback sequence documented in
  BUG-AUTH-003, while the reported switcher screenshot shows admin current at
  the bottom.
- **Open questions:** None for the identified missing commit. Staging should
  verify the returned account list after ordinary, grace, and cookie-missing
  refresh paths.

### Fix applied locally

The normal and grace refresh branches now set the restored slot's
`last_used_at` before the token rotation transaction commits. The existing
refresh-cookie-missing path already updated it before committing. Server
ordering remains based on persisted descending recency.

Non-goals: changing the account list's descending recency sort or reordering
accounts only in the client without persisting the server's authoritative
recency.

### Tests and verification

- **Required:** Exercise both refresh branches with a remembered slot, then
  request `GET /auth/accounts` and verify the restored slot is first and
  current. Verify a failed refresh does not change recency, and verify ordinary
  explicit account switching continues to update and persist order.
- **Completed:** Read-only staging event/token-record inspection and source
  trace; recency now persists in normal and grace refresh transactions. No
  automated tests run; staging acceptance remains pending.

### Noteworthy

This ordering defect is separate from the silent account switch and has its
own backend fix. Both changes are implemented locally; staging acceptance will
verify each behavior.

### Related documentation and implementation

- [Account Access unit](units/account-access.md)
- [Session restoration rule](rules.md#auth-r-040--session-restoration-has-explicit-recovery-ux)
- [`POST /auth/refresh`](../api/app/routers/auth.py)
- [`list_slots()` ordering](../api/app/services/account_slots.py)

## BUG-AUTH-002 — Public landing blocks while checking for a session

- **Status:** Likely fixed in current code; staging acceptance pending
- **Reported/updated:** 2026-09-29T14:40:13Z
- **Affected area:** Public landing route `/`, `PublicRouteGuard`, refresh-session recovery
- **Environment:** Production, staging, and local; reproduced in an incognito/private window with no account session
- **Severity:** medium

### Bug summary

Visiting the public landing page shows the full-screen “Restoring…” state even
when the browser has no active Friink session. In a private window, the public
site appears only after the unnecessary session check fails.

### Reproduction

1. Open a new incognito/private window with no Friink session cookies.
2. Visit the public site root `/`.
3. Observe “Restoring…” before the landing page appears.

### Expected behavior

The public landing page should render immediately without requiring or probing
an authenticated session. Protected routes should own session restoration.

### Actual behavior

`PublicRouteGuard` now renders its children immediately. It checks the
lightweight `/auth/entry-status` endpoint in the background and only attempts
cookie-first validation/redirect when the server reports a session hint.
Signed-out visits do not make a refresh exchange.

### Root cause

- **Fixed locally:** The guard no longer initializes in a blocking loading
  state and does not gate public children on auth status.
- **Fixed locally:** Signed-out visits use the non-mutating entry-status hint;
  they do not call refresh.
- **Fixed locally:** The hint recognizes any non-empty access or refresh
  cookie, including per-account cookies when the selected-slot value is absent
  or stale. A positive hint enters normal server validation and remembered
  session fallback instead of leaving a valid other slot undiscovered.
- **Confirmed:** Centralizing route restoration made `/` and `/home` share a
  helper, but incorrectly applied authenticated bootstrap as a prerequisite to
  public content.
- **Open questions:** Whether active visitors should still be silently
  redirected from `/` to `/home` is a product choice; it is not needed to make
  public content available.

### Implemented local fix

Render public content immediately and run a non-blocking cookie-presence check.
If any access or refresh cookie exists, validate the selected slot and use the
normal remembered-session fallback as needed, then redirect only after
successful validation. Token stability is covered by BUG-AUTH-003.

Non-goals: require authentication to view public content or weaken `/home`
authorization. Session repair and refresh-token safety remain owned by
BUG-AUTH-003.

### Tests and verification

- **Required:** Verify `/` renders immediately with no session and makes no
  refresh exchange; with a valid session, verify the public page is never
  blocked and apply the chosen non-blocking redirect policy; verify protected
  `/home` still restores or rejects access correctly on terminal and transient
  failures in local, staging, and production-equivalent origins.
- **Completed locally:** The guard renders public children immediately and
  checks `/auth/entry-status` in the background. A signed-out entry-status
  result does not call refresh; a detected session is validated and redirected
  without replacing public content with a restore screen. A focused API test
  confirms slot-scoped cookies are detected when there is no selected slot or
  the selected slot lacks matching cookies. Browser acceptance remains open.

### Noteworthy

This is separate from BUG-CHAT-001. The public site is intentionally viewable
without a session; using a refresh exchange to decide whether to show it is an
unnecessary blocking dependency. The currently shared entry helper does not
make the public and protected routes equivalent: their rendering requirements
are different.

### Related documentation and implementation

- [Auth/chat defect register](bugs.md)
- [`PublicRouteGuard`](../web/components/public-route-guard.tsx)
- [`AppShellRoute`](../web/components/app-shell-route.tsx)
- [`Auth session helpers`](../web/lib/auth.ts)

## BUG-NAV-001 — Route changes remount the app shell and may discard in-progress work

- **Status:** Needs reproduction — no specific remaining lost operation has been confirmed
- **Reported/updated:** 2026-09-29T22:29:32Z
- **Affected area:** Authenticated App Router navigation, shared shell, and
  operations owned by screen components
- **Environment:** Historical production report; originating user/session and
  a concrete route/action reproduction are not identified in the repository
- **Severity:** high

### Bug summary

The original report described a session-restoration flash and possible loss of
screen-local work while navigating between app pages. The restoration flash is
mitigated locally. No particular remaining form, post, settings action, or
other operation has been identified as losing work; this record tracks only
possible loss during in-app route changes. Tab closure is tracked separately in
[BUG-OPS-001](#bug-ops-001--closing-a-tab-can-leave-an-in-flight-operations-outcome-unknown).

### Reproduction

1. Sign in and open an authenticated page.
2. Start an operation or enter work whose progress is held in the current
   screen/component state.
3. Navigate to another authenticated route using app navigation.
4. Check for a restore-screen flash, lost form/draft state, missing completion
   feedback, or a duplicate/canceled mutation when returning. Record the exact
   route and action; a generic shell remount alone is not proof of user impact.

### Expected behavior

In-app navigation should preserve the authenticated shell and any operation
state that is meant to survive a screen change. The app should not show session
restoration when its in-memory session is already available.

### Actual behavior

Every route page still creates an `AppShellRoute`, but it initializes from the
in-memory session synchronously, so ordinary authenticated route transitions
do not show a restore screen. A root `AppShellStateProvider` preserves many
account-scoped values across page-level remounts, and chat retries use
`client_message_id` idempotency. The `AppShell` instance itself still remounts.
The register has not established whether any remaining route-owned form or
mutation feedback is actually lost in current use.

### Root cause

- **Confirmed:** Authenticated pages render `AppShellRoute` from their page
  components instead of sharing an authenticated layout that remains mounted
  across sibling routes.
- **Fixed locally:** `AppShellRoute` initializes from the already available
  in-memory session, avoiding the loading screen on ordinary in-app navigation.
- **Confirmed:** `AppShell` owns route and screen state below that page-level
  boundary; replacing the page unmounts it. Some route-owned component state is
  therefore reset on navigation.
- **Open questions:** No concrete user action with lost state or feedback has
  been reproduced. Determine whether any such loss matters during ordinary
  in-app navigation; full tab closure and reload behavior belong to separate
  issue records.

### Implemented local mitigation and remaining work

The local mitigation adds a root state provider and synchronous session
initialization, and makes chat retries idempotent. It does not keep a single
`AppShell` instance mounted. Later work should first reproduce a user-visible
loss during client-side route changes, then patch that operation's state
contract if needed. Do not conflate this with full tab closure, which is tracked
in BUG-OPS-001.

Non-goals: persist access or refresh credentials in JavaScript-readable
storage, or keep every route-specific screen mounted indefinitely.

### Tests and verification

- **Required:** Verify no restoration flash during client-side navigation with
  a valid in-memory session and confirm whether any named user operation loses
  state or completion feedback during route transitions. Keep full tab closure
  and reload cases separate.
- **Completed locally:** `npx tsc --noEmit` passes; root provider and synchronous
  session initialization were source-reviewed. Local browser navigation from
  Explore to Following retained the authenticated shell without a restore
  screen. Chat retry idempotency has a focused API test. A full App Router
  navigation/operation matrix has not been run, and no concrete remaining
  loss has been identified. Reproduce a named symptom or close as superseded.

### Noteworthy

Persistent shell state alone cannot preserve a browser operation across a true
document reload or closed tab. Cross-tab outcome recovery is tracked separately
in BUG-OPS-001. Authentication token stability is tracked separately in
BUG-AUTH-003.

### Related documentation and implementation

- [Navigation unit](units/navigation.md)
- [Account Access unit](units/account-access.md)
- [`AppShellRoute`](../web/components/app-shell-route.tsx)
- [`AppShell`](../web/components/app-shell.tsx)
- [Home route](../web/app/home/%5Btab%5D/page.tsx)

## BUG-OPS-001 — Closing a tab can leave an in-flight operation's outcome unknown

- **Status:** Needs reproduction — recorded for later investigation
- **Reported/updated:** 2026-09-29T22:27:28Z
- **Affected area:** Web API mutations and recovery of their outcomes across tabs
- **Environment:** Web browsers; operation and close timing not yet recorded
- **Severity:** medium

### Bug summary

When a user closes the tab that submitted an API mutation before its response
is shown, the request may stop before reaching the API or the API may finish
after the tab is gone. A new tab does not automatically know which result
occurred, leaving the user unsure whether retrying is safe.

### Reproduction

1. In one tab, start a mutation that shows a loading state.
2. Close that tab before the response arrives, testing closure before send,
   while the server is processing, and after the server commits but before the
   browser receives the response.
3. Open Friink in another tab and inspect whether the action's result is
   available and whether a retry would duplicate the mutation.

### Expected behavior

After reopening Friink, the user can determine whether the operation completed
and can safely retry when it did not. The product may use operation-specific
idempotency and a durable result/status lookup; the mechanism remains undecided.

### Actual behavior

The browser may terminate a request when its tab closes, or the API may process
and commit a request whose response the browser can no longer display. Friink's
in-memory shell state is scoped to the open tab and disappears when that tab
closes. Chat sends have a stable client message ID for retry deduplication, but
there is no general operation receipt/status recovery contract documented for
other mutations. Exact behavior depends on request timing and endpoint.

### Root cause

- **Confirmed:** Closing a tab removes its in-memory UI state and response
  handler; a separate tab does not share the root React state provider.
- **Open questions:** Which endpoints finish after tab closure, which transports
  the browser cancels, and which operations already have endpoint-specific
  idempotency or a way to query the result have not been audited.

### Proposed fix

First audit representative mutations and reproduce the timing cases. Define
which actions need durable operation IDs, safe retries, and result/status lookup
after reopening. Implement only the operation-specific contract needed to let
users resolve an ambiguous outcome. Do not assume every request should run as a
background job after its tab closes.

Non-goals: guarantee delivery of a request that never reached the API, or add a
single generic job system before the operation requirements are known.

### Tests and verification

- **Required:** For representative supported mutations, verify tab close before
  dispatch, during server processing, and after commit but before response.
  Reopen a second tab and verify success/failure recovery and duplicate-safe
  retry. Record endpoint, browser, request/response status, and persistence or
  idempotency evidence without logging credentials.
- **Completed:** None — recorded for later reproduction and design.

### Noteworthy

This is separate from BUG-NAV-001, which covers client-side route transitions
while the original tab remains open. The browser/API may have an ambiguous
outcome even when the server-side operation itself is correct.

### Related documentation and implementation
- [Navigation unit](units/navigation.md)
- [`AppShellStateProvider`](../web/components/app-shell-state-provider.tsx)
- [`createPost()`](../web/lib/auth.ts)
- [`ChatClient`](../web/app/%5Busername%5D/chat/chat-client.tsx)

## BUG-CHAT-001 — Individual chat refresh redirects to login

- **Status:** Resolved
- **Reported/updated:** 2026-09-22T11:19:27Z
- **Affected area:** Individual direct chat route `/{username}/chat`, session bootstrap, login recovery
- **Environment:** Staging; browser refresh on an authenticated individual chat
- **Severity:** high

### Bug summary

Refreshing an individual chat loses the active chat session, sends the user to
`/login`, and can eventually land them on `/home` instead of returning to the
chat they were viewing.

### Reproduction

1. Sign in and open an individual chat at `/{username}/chat`.
2. Refresh the browser page.
3. Observe the redirect to `/login`, followed by `/home` when session recovery succeeds.

### Expected behavior

The route should restore the authenticated session and remain on the same
individual chat URL after refresh.

### Actual behavior

The individual chat client checks the in-memory session immediately. After a
full refresh that module state is empty, so it redirects to `/login` without
trying `refreshAuthSession()`. The login page's recovery path redirects to
`/home` after a successful refresh.

### Root cause

- **Confirmed:** `ChatClient` calls `loadAuthSession()` and immediately routes
  to `/login` when it returns `null`; unlike `AppShellRoute`, it has no session
  restoration branch. `loadAuthSession()` reads module memory only, which is
  reset by a full browser refresh.
- **Confirmed:** `LoginClient` redirects successful refresh recovery to
  `/home`, and the login recovery URL does not preserve the original chat URL.
- **Open questions:** If the list route also fails to restore, separately verify
  staging refresh-cookie delivery; that is not required to reproduce this
  individual-chat defect.

### Proposed fix

Implemented the shared authenticated-session bootstrap flow for `ChatClient`:
when no in-memory session exists, it calls `refreshAuthSession()`, saves the
restored session, and continues loading the conversation. It redirects to login
only after a terminal refresh failure.

Non-goals: change token storage policy, alter chat permissions, or change the
chat list route unless separate evidence shows the same defect there.

### Tests and verification

- **Required:** Refresh an individual chat with a valid session and verify the
  same chat remains open; verify expired/invalid refresh state still reaches
  login; verify chat list navigation and polling are unchanged; run targeted web
  lint/type checks and staging browser acceptance.
- **Completed:** `npm --prefix web run lint`, `npx tsc --noEmit --incremental false`
  from `web/`, and `git diff --check` passed. Staging browser refresh acceptance
  remains pending.

### Noteworthy

This was a client-side route-bootstrap defect, not a chat API routing defect.
The direct chat page is rendered by `web/app/[username]/chat/chat-client.tsx`,
while the chat list uses the more complete `AppShellRoute` recovery path.

### Related documentation and implementation

- [Chat unit](units/chat.md)
- [Active chat rules](rules.md#client-r-014b--direct-chat-uses-document-scrolling)
- [`ChatClient`](../web/app/[username]/chat/chat-client.tsx)
- [`AppShellRoute`](../web/components/app-shell-route.tsx)
- [`LoginClient`](../web/app/login/login-client.tsx)

## BUG-CHAT-002 — New-chat people search reports unavailable on staging

- **Status:** Needs reproduction — the report predates the current staging build
- **Reported/updated:** 2026-09-29T14:40:13Z
- **Affected area:** New-chat discovery at `/chats/new`, people-search API
- **Environment:** Staging; user-reported during staging acceptance testing
- **Severity:** medium

### Bug summary

The `/chats/new` flow fails to show people-search results and instead reports
that search is unavailable, preventing the user from continuing to start a
chat.

### Reproduction

1. Open `/chats/new` on staging.
2. Enter at least two characters in the people-search field; the screenshot
   shows the query `admin`.
3. Observe the results panel.

### Expected behavior

The flow should show eligible matching people, or the normal empty state when
there are no matches. A transient failure should allow retry and recover when
the search request succeeds.

### Actual behavior

The panel shows `Search is unavailable. Try again` after entering `admin`.
The user reports that the new-chat flow is not working.

### Root cause

- **Confirmed:** The screenshot shows the search-unavailable state. The client
  calls `GET /chat/people?query=...` and maps any rejected request to that
  state.
- **Open questions:** The staging request status, response body, and matching
  API log were not captured. The underlying failure could not be identified
  from the screenshot alone.

### Proposed fix

Diagnose the staging `GET /chat/people?query=admin` request and its API log,
then fix the confirmed failing layer. Preserve server-side people visibility
and chat-eligibility policies; do not loosen those rules to work around a
transport or configuration error.

Non-goals: changing who is eligible or visible in chat search without evidence
that the policy itself is incorrect.

### Tests and verification

- **Required:** Verify a successful staging search with matching people, a
  successful no-results response, recoverable network/API failures and Retry,
  and the existing visibility/eligibility filters.
- **Completed:** Screenshot review only. Staging endpoint status and response
  shape are unknown; diagnosis and regression verification remain open.

### Noteworthy

The user separately reported that sending a message on staging succeeded.
That confirms one send path only and does not verify new-chat discovery. The
user is currently exercising the `/chats/new` flow; no subsequent result has
been recorded.

### Related documentation and implementation

- [Chat unit](units/chat.md)
- [`NewChatScreen`](../web/components/new-chat-screen.tsx)
- [`GET /chat/people`](../api/app/routers/chat.py)
- [`searchChatPeople`](../web/lib/auth.ts)

## BUG-LOAD-001 — Multiple tabs can intermittently fail Home and profile loads

- **Status:** Needs reproduction — multi-tab symptom reported; failing request and cause are unknown
- **Reported/updated:** 2026-09-29T22:41:14Z
- **Affected area:** Home feed and profile bootstrap/content requests
- **Environment:** Web; browser, deployment, and number of tabs not yet recorded
- **Severity:** medium

### Bug summary

With Friink open in multiple tabs, some tabs intermittently show “Could not
load the Home feed.” The user reports similar failures on profiles, so the
issue may affect shared or concurrent data-loading paths.

### Reproduction

1. Open the app in multiple tabs in the same browser profile.
2. Load Home in some tabs and profile pages in others.
3. Record which pages fail and capture each failed request's URL, status,
   response body, and timing from the browser Network panel.

### Expected behavior

Home and profile data should load across open tabs. If a request fails
transiently, the page should expose a recovery action and retry successfully.

### Actual behavior

Some Home tabs display “Could not load the Home feed.” Similar failures are
reported for profile pages. No exact failed request, response, browser, or
deployed build has been captured.

### Root cause

- **Confirmed in current web code:** Each AppShell mount starts a global posts
  prefetch on non-Home surfaces. Before the loading optimization, HomeScreen
  also started its own initial feed request, so Home could issue overlapping
  reads. Home now skips the shell prefetch and keeps one Home-owned initial
  request; profile identity, tab content, and follower/following statistics
  requests are still launched independently after authentication. The API
  client automatically retries only once after a `401 TOKEN_EXPIRED`; it does
  not generally retry network, timeout, or server failures. A Home
  initial-load failure shows text without a retry control, and its polling path
  does not retry while the feed is empty.
- **Open questions:** The failing endpoint and status, whether concurrent tabs
  trigger rate limiting or another server-side condition, and whether failures
  correlate with request volume are unknown. The confirmed request fanout is
  not evidence that it caused this report.

### Proposed fix

Use captured request evidence to identify the failing layer. The confirmed
Home duplicate-read path is now removed; next address endpoint capacity or
retry behavior only if staging evidence shows the remaining multi-tab failure
continues. Preserve authentication and authorization behavior.

### Tests and verification

- **Required:** Reproduce on a build with recorded web/API SHAs; capture the
  failed request and response; repeat single-tab and multi-tab Home/profile
  loads; verify recoverable failures can be retried and successful loads render
  correctly.
- **Completed:** Code-path review only. No staging reproduction or request
  status/body evidence yet; no tests run.

### Noteworthy

The frontend still launches several reads independently; there is no
guaranteed serial order among profile data requests after authentication. Home
now has one initial feed read owned by `HomeScreen`, while
authentication/session restoration may precede private data loading when no
in-memory session is available. The exact multi-tab failure cause remains
unconfirmed.

### Related documentation and implementation

- [Feed unit](units/feed.md)
- [Profiles unit](units/profiles.md)
- [`AppShell`](../web/components/app-shell.tsx)
- [`HomeScreen`](../web/components/home-screen.tsx)
- [`ProfileClient`](../web/app/[username]/profile-client.tsx)
- [`requestApi`](../web/lib/auth.ts)
