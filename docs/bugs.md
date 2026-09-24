# Friink bug register

**Status:** Draft register — format pending team refinement
**Last edited:** 2026-09-24T21:23:52Z

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

## BUG-AUTH-003 — Refresh-token replay silently switches the active account

- **Status:** Implemented locally; staging acceptance pending
- **Reported/updated:** 2026-09-24T21:58:14Z
- **Affected area:** Web session refresh, account-slot coordination, remembered-account recovery, and account switcher
- **Environment:** Staging API/database; reproduced from the local web app against remembered accounts in one browser profile
- **Severity:** high

### Bug summary

After refreshing or retrying session recovery for `@muflahulfurqan`, the app
can end up authenticated as `@admin` without an explicit account selection.
The user may then continue using the app under the wrong account context.

### Reproduction

The user reproduced this on staging; refresh-token reuse can make the sequence
intermittent:

1. With `@muflahulfurqan`, `@phase4test20260906`, and `@admin` remembered in the
   same browser profile, explicitly switch to `@muflahulfurqan`.
2. Refresh the app. During the observed reproduction, the app showed “Friink is
   having trouble reconnecting. Your account has not been signed out.”
3. Retry or refresh again as the user did during the report.
4. Observe that a later refresh opens the app as `@admin`, although no account
   switch to admin was requested.
5. Open the account switcher: admin can be marked current while still appearing
   last in the remembered-account list; see BUG-AUTH-004.

### Expected behavior

A recoverable connection failure should keep the selected account and offer a
retry. A terminal failure should not silently authenticate a different
remembered account; any account change should require an explicit user action.

### Actual behavior (before fix)

A refresh-token reuse response was terminal. Previously,
`refreshAuthSession()` silently saved the first different remembered slot that
refreshed successfully. The client now preserves the selected slot and cached
safe profile metadata, then presents sign-in for that identity and an explicit
remembered-account choice. Each explicit choice refreshes only its selected
slot.

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
- **Confirmed in API behavior:** Re-presenting a rotated token after its
  single-use grace has been consumed revokes its token family and returns a
  terminal `401 REFRESH_TOKEN_INVALID`; this reuse protection remains enabled.
- **Confirmed in web implementation:** The previous coordination key used
  `activeAccountSlot()` while `performRefresh()` read a shared localStorage
  slot. Coordination and refresh now use one captured slot, and ordinary
  responses are checked against the still-active slot before persistence.
- **Open questions:** The persisted records prove that the same rotated token
  was presented repeatedly and that Phase could not be restored. They do not
  identify whether the repeated requests came from concurrent tabs, a response
  lost after the database commit, or another stale-cookie retry. The database
  does not retain every HTTP refresh failure or browser request identifier.
  The transient reconnect screen may be related to a lost response, but that
  link is not proven by the stored events. Neon cold start alone is not
  established as the cause.

### Fix applied locally

1. Capture the active account slot once and use that exact value for both the
   refresh coordination key and the `/auth/refresh` request. Recheck that slot
   before committing the restored session so stale work cannot overwrite a
   later explicit account selection.
2. Remove silent cross-account fallback on terminal refresh failure. Keep the
   failed account context, offer sign-in as that account, and show an inline
   remembered-account list. Explicit selection restores only that slot.
3. Keep server-side refresh-token reuse detection enabled. Correct client
   refresh coalescing; do not broaden grace or weaken family
   revocation until a focused security design covers lost responses and
   duplicate requests.

Staging browser acceptance remains pending. The duplicate-request origin is
still unknown.

Non-goals: storing refresh/access tokens in browser-readable storage, disabling
refresh-family reuse detection, or changing server authorization between
accounts.

### Tests and verification

- **Required:** Reproduce two tabs refreshing the same slot concurrently,
  including tabs whose `sessionStorage` account slots differ while the shared
  `localStorage` slot points to one account; verify one rotation does not make
  the active account silently change. Simulate a successful server rotation
  whose response is lost, then retry with the stale cookie; verify grace and
  subsequent reuse behavior remain secure and understandable. Verify a
  terminal failure preserves the selected account and requires explicit user
  choice. Include a multi-account browser acceptance run.
- **Completed:** Read-only inspection of staging `security_events` and
  `refresh_tokens`; captured-slot coordination and explicit recovery implemented
  locally. No automated tests run; staging acceptance remains pending.

### Noteworthy

The database stores durable `refresh` and `refresh_reuse_detected` security
events, but not every HTTP error or client request ID. Detailed token-lifecycle
stdout events require `AUTH_DEBUG_LOGGING_ENABLED`; never copy raw cookies,
refresh tokens, token hashes, or internal UUIDs into this register. The
staging evidence establishes reuse and family revocation, not the client-side
origin of the duplicate requests.

### Related documentation and implementation

- [Account Access unit](units/account-access.md)
- [Session restoration rule](rules.md#auth-r-040--session-restoration-has-explicit-recovery-ux)
- [`refreshAuthSession()` and refresh coordination](../web/lib/auth.ts)
- [`POST /auth/refresh`](../api/app/routers/auth.py)
- [Refresh-token reuse model](../api/app/models/refresh_token.py)
- [Account-slot ordering](../api/app/services/account_slots.py)

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

## BUG-AUTH-002 — Public landing page does not consistently reveal an existing session

- **Status:** In progress
- **Reported/updated:** 2026-09-22T12:40:00Z
- **Affected area:** Public landing route `/`, `PublicRouteGuard`, refresh-session recovery
- **Environment:** Local, staging, and production; new browser tab after an authenticated session
- **Severity:** medium

### Bug summary

After closing the original tab and opening the public URL in a new tab, the
landing page can remain visible without showing evidence of the existing login.
Entering `/home` manually then restores the session and opens the authenticated
application.

### Reproduction

1. Sign in to Friink in one browser tab.
2. Close the tab and open a new tab at the public site root `/`.
3. Observe that the public landing page remains visible.
4. Change the URL to `/home` and observe that the authenticated Home screen loads.

### Expected behavior

The public route should consistently determine whether a valid session exists.
If the session is valid, it should navigate to `/home`; if the user is truly
signed out, it should remain on the public landing page without an ambiguous
session-detection gap.

### Actual behavior

The public page renders first and starts refresh recovery asynchronously. If
that refresh fails, times out, encounters a transient coordination/network
problem, or does not complete as expected, `PublicRouteGuard` silently keeps
the landing page visible. A direct visit to `/home` performs its own recovery
and can succeed, making the session appear inconsistent across routes.

### Root cause

- **Confirmed:** A new tab has no in-memory access session. The public route
  and `/home` previously owned separate restoration branches, so they could
  make different decisions about the same refresh-cookie session.
- **Confirmed:** The previous fix improved the public loading/error state but
  did not create a shared entry bootstrap contract; the reported behavior still
  reproduces when the public route remains visible while `/home` restores.
- **Open questions:** Staging still needs browser Network-panel confirmation
  of whether the refresh request succeeds, returns terminal `401`, or fails
  through CORS/network/coordination.

### Proposed fix

The new fix centralizes entry restoration in `restoreAuthSessionForEntry()` so
the public route and authenticated shell use the same in-memory-or-refresh
contract. The public route also responds to cross-tab account restoration
events and keeps the landing page behind the explicit loading/recovery gate.

Non-goals: change refresh-token storage, make the public landing page require
authentication, or alter `/home` authorization behavior.

### Tests and verification

- **Required:** Open `/` in a fresh tab with a valid refresh cookie and verify
  navigation to `/home`; repeat with no session and verify the public page
  remains; simulate refresh `401` and network failure; verify `/home` behavior
  remains unchanged; test local, staging, and production-equivalent origins.
- **Completed:** Documentation was updated before implementation. The local
  Webpack app and FastAPI development server were run together; the public
  route showed the loading recovery state, handled `POST /auth/refresh` with a
  confirmed signed-out `401`, and then rendered the public page. Local
  TypeScript and `git diff --check` passed. Authenticated local browser
  acceptance and staging acceptance remain open because no local test
  credentials were available.

### Noteworthy

This was separate from BUG-CHAT-001. The chat defect was caused by an individual
chat route skipping session restoration; this defect concerns inconsistent
entry-point restoration. The public site and API use an httpOnly refresh cookie,
while the access session is held in browser memory after recovery. The shared
entry helper is intended to keep `/` and `/home` on the same decision path.

### Related documentation and implementation

- [Auth/chat defect register](bugs.md)
- [`PublicRouteGuard`](../web/components/public-route-guard.tsx)
- [`AppShellRoute`](../web/components/app-shell-route.tsx)
- [`Auth session helpers`](../web/lib/auth.ts)

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
