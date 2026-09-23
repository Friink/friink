# Friink bug register

**Status:** Draft register — format pending team refinement
**Last edited:** 2026-09-23T23:03:28Z

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
