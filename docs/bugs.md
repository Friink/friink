# Friink bug register

**Status:** Draft register — format pending team refinement
**Last edited:** 2026-09-27T14:18:22Z

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
`Open`, `Diagnosed`, `In progress`, `Blocked`, `Resolved`, and `Closed`.
Keep proposed fixes here until implementation is actually made; then update the
entry with the shipped change and verification result.

## Entry template

Copy this template for a new defect and replace every placeholder:

```markdown
## BUG-[AREA]-[NUMBER] — [Short title]

- **Status:** Open | Diagnosed | In progress | Blocked | Resolved | Closed
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

- **Status:** Fix implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-27T23:00:46Z
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
changes. Before this fix, refreshes coordinated token rotation per account
slot, but account-switch requests had no shared lock. A tab could begin a
switch from stale in-memory state while another tab was also switching.

### Root cause
- **Confirmed:** `switchAccount()` did not coordinate simultaneous cross-tab
  switches. Successful `/auth/me` restoration also saved its captured slot
  without checking whether the browser-wide selected slot had changed during
  the request.
- **Open questions:** The exact request ordering in the staging reproduction
  was not captured. The reported `Could not load home feed` error with three or
  four tabs may be a separate transport or server-load issue and remains
  undiagnosed.

### Resolution in progress

Switches now use a browser-wide exclusive lock, read the source session after
the lock is acquired, and save the destination selection before releasing the
lock. Session restoration retries when its selected slot changes while
`/auth/me` is pending. The source code is updated locally; staging acceptance
has not been run.

### Tests and verification
- **Required:** Repeated and simultaneous switches in both directions with two
  or more staging tabs; confirm every tab converges and the switcher remains
  usable. Separately capture the HTTP status for feed failures with three or
  four tabs.
- **Completed:** Web TypeScript check passed. Multi-tab browser and staging
  verification remain pending.

### Noteworthy

This change does not alter JWT lifetime, refresh-token rotation, or server-side
authorization. The lock coordinates only browser tab operations. The feed
failure is tracked as an open diagnosis and is not claimed as fixed here.

### Related documentation and implementation
- [Account Access](units/account-access.md)
- [Account selection rule](rules.md#auth-r-041--account-switching-is-serialized-across-tabs)
- `web/lib/auth.ts`
- `web/components/side-drawer.tsx`

## BUG-AUTH-007 — Terminal session recovery can loop between public site and app

- **Status:** Fix implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-27T21:44:24Z
- **Affected area:** Public root routing, public route guard, terminal session recovery, remembered-account hint cookie
- **Environment:** User report; browser-specific cookie and API trace unavailable
- **Severity:** high

### Bug summary

After a terminal session failure, a visitor can be sent between the public site
and app recovery. The user cannot reliably reach the login form to sign in again.

### Reproduction
1. Open the public site with a stale positive `friink_session_hint`, or with a
   zero hint while `/auth/entry-status` indicates that restoration should be
   attempted.
2. Let session restoration fail terminally, producing the “This account
   session ended” notice, or acknowledge that notice after protected-app entry.
3. If no remembered slot validates, return to `/` and observe whether public
   entry immediately sends the browser back to `/home` and recovery.

### Expected behavior

Once no remembered session validates, the visitor can remain on the public
site and choose login. The redirect hint is only a routing optimization and
cannot force repeated entry into a known-failed recovery path.

### Actual behavior

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

### Resolution in progress

After the public guard receives a confirmed terminal restore failure, it now
clears the redirect-only `friink_session_hint` and stays on the public route.
When app recovery exhausts all remembered candidates, it also clears the hint
before returning to `/`. Neither path routes a known-unrestorable session
straight back into `/home`. Authentication, token validation, and fallback
authorization are unchanged.

### Tests and verification
- **Required:** Browser checks for positive, zero, missing, and malformed hint;
  entry-status positive/negative; terminal and ambiguous restore; stale and
  valid remembered slots; login reachable after all candidates fail.
- **Completed locally:** Targeted TypeScript check passed. Real staging browser
  acceptance remains pending.

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

- **Status:** Resolved
- **Reported/updated:** 2026-09-27T20:36:01Z
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
- **Local log availability:** `.codex-local-logs/api.log` was last written on
  2026-09-18 and contains standard Uvicorn request/status lines, not detailed
  auth lifecycle events. It includes overlapping successful `/auth/refresh`
  requests, but has no timestamps or operation IDs to correlate them with the
  staging revocations. No live local terminal output or staging HTTP log stream
  was available during this audit.
- **Confirmed in API behavior:** Re-presenting a rotated token after its
  single-use grace has been consumed revokes its token family and returns a
  terminal `401 REFRESH_TOKEN_INVALID`; this reuse protection remains enabled.
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

### Resolution

The session bootstrap now validates the slot-scoped HttpOnly access cookie
through `/auth/me` before refreshing. A valid access cookie avoids refresh-token
rotation on normal reloads. Refresh coordination captures one account slot,
validates the response against the active slot, and revalidates followers with
their own access cookie. The user confirmed the latest implementation is
deployed to staging. The historical trigger for repeated stale-token
presentations remains unknown; this resolution records the implementation
update and staging deployment, not a conclusive reconstruction of those past
requests.

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

## BUG-AUTH-006 — Refresh grace replay forks token family

- **Status:** In progress
- **Reported/updated:** 2026-09-26T10:39:52Z
- **Affected area:** API refresh-token rotation and retry-grace handling
- **Environment:** All environments running the current implementation
- **Severity:** High

### Bug summary

A concurrent or retried refresh request presenting a just-rotated token can
cause the API to issue a second active replacement in the same refresh-token
family. This makes one session family contain multiple usable refresh tokens.

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

Normal refresh now derives the successor deterministically with keyed HMAC
using the parent token, row/family IDs, and the configured signing-key ID. The
  child row stores its derivation-key ID alongside the SHA-256 token hash, and
  the parent stores the refresh operation ID supplied by the client. A grace retry with the same
operation ID can reconstruct and resend the same cookie without creating a
second row. Stale-token retries without a matching operation ID retain the
one-time legacy grace path; stale-token use after the window still revokes the
family. Existing pre-change rows retain that compatibility path. The refresh
audit event is now written after the rotation transaction commits, and the
legacy grace branch uses the correct revocation helper arguments. Migration
`20260925_0059` is applied to staging and Alembic reports no schema drift; the
API/web code remains local pending deployment and browser acceptance.

### Tests and verification

- **Required:** Cover concurrent presentations of one refresh token and a
  successful rotation whose response is lost. After grace recovery, verify
  repeated retries carrying the same operation ID return the same replacement
  and leave at most one usable refresh token in the family; verify stale-token
  use after grace still revokes the family. Verify key retention through the
  grace period and migration compatibility for pre-change rows.
- **Completed:** The focused refresh-token test module passes all three tests
  on disposable SQLite, including a real FastAPI request/response check and
  repeated same-operation retries returning the same refresh cookie with one
  active token in the family. Python compilation and `git diff --check` pass;
  web TypeScript and targeted lint checks pass. The staging schema is at the
  migration head with no Alembic drift; staging API/web acceptance remains
  pending.

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

- **Status:** In progress
- **Reported/updated:** 2026-09-26T11:14:22Z
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

## BUG-NAV-001 — Route changes remount the app shell and discard in-progress work

- **Status:** In progress
- **Reported/updated:** 2026-09-24T22:54:37Z
- **Affected area:** Authenticated App Router navigation, shared shell, and
  operations owned by screen components
- **Environment:** Production user report; code path exists in the current web
  implementation
- **Severity:** high

### Bug summary

Navigating between app pages flashes the session-restoration screen before the
new page appears. The old app shell and screen subtree unmount during the route
change, so local operation/form state can be discarded and an in-progress
operation may fail or become impossible to continue.

### Reproduction

1. Sign in and open an authenticated page.
2. Start an operation or enter work whose progress is held in the current
   screen/component state.
3. Navigate to another authenticated route using app navigation.
4. Observe a brief “Reconnecting…” screen, then the destination page; return to
   the original route and observe that local progress is gone. If the operation
   was tied to the unmounted component, verify whether it was canceled or left
   without visible completion state.

### Expected behavior

In-app navigation should preserve the authenticated shell and any operation
state that is meant to survive a screen change. The app should not show session
restoration when its in-memory session is already available.

### Actual behavior

Every route page still creates an `AppShellRoute`, but it now initializes from
the in-memory session synchronously, so the normal authenticated transition no
longer shows a restore screen. A root `AppShellStateProvider` preserves
account-scoped shell state across page-level remounts, and the chat client
preserves draft/pending-send state with API idempotency keyed by
`client_message_id`. The `AppShell` instance itself still remounts, some
route-owned forms and mutation feedback are not retained, and reloads still
discard provider memory.

### Root cause

- **Confirmed:** Authenticated pages render `AppShellRoute` from their page
  components instead of sharing an authenticated layout that remains mounted
  across sibling routes.
- **Fixed locally:** `AppShellRoute` initializes from the already available
  in-memory session, avoiding the loading screen on ordinary in-app navigation.
- **Confirmed:** `AppShell` owns route and screen state below that page-level
  boundary; replacing the page unmounts it. In-flight UI work scoped to those
  components may be canceled or lose its completion state.
- **Open questions:** Which user operations are canceled server-side, which
  continue but lose their UI state, and which should survive an intentional
  route change versus a full browser reload require operation-by-operation
  verification.

### Implemented local mitigation and remaining work

The local mitigation adds a root state provider and synchronous session
initialization, and makes chat retries idempotent. It does not keep a single
`AppShell` instance mounted or cover every route-owned mutation. Audit
remaining operation owners, move any navigation-surviving work above the page
boundary or make it resumable/idempotent, and define which draft state may
survive a full document reload. Verify all routes, browser back/forward,
mobile navigation, active operations, and account switching without changing
identity.

Non-goals: persist access or refresh credentials in JavaScript-readable
storage, or keep every route-specific screen mounted indefinitely.

### Tests and verification

- **Required:** Verify no restoration flash during client-side navigation with
  a valid in-memory session; verify shell state survives route changes; exercise
  representative pending and completed operations across route transitions;
  verify reload recovery separately; verify no duplicate mutation after retry.
- **Completed locally:** `npx tsc --noEmit` passes; root provider and synchronous
  session initialization were source-reviewed. Local browser navigation from
  Explore to Following retained the authenticated shell without a restore
  screen. Chat retry idempotency has a focused API test. A full App Router
  navigation/operation matrix has not been run, so this bug remains open for
  acceptance and remaining operation-specific fixes.

### Noteworthy

Persistent shell state alone cannot preserve a browser operation across a true
document reload. Each operation needs an explicit navigation/reload survival
contract. Authentication token stability is tracked separately in
BUG-AUTH-003.

### Related documentation and implementation

- [Navigation unit](units/navigation.md)
- [Account Access unit](units/account-access.md)
- [`AppShellRoute`](../web/components/app-shell-route.tsx)
- [`AppShell`](../web/components/app-shell.tsx)
- [Home route](../web/app/home/%5Btab%5D/page.tsx)

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

- **Status:** Open
- **Reported/updated:** 2026-09-23T23:03:28Z
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
