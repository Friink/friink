# Login behavior and staging timeout

## Observed behavior

On staging, a valid login can display `The request timed out.` after the
frontend request timeout expires. The user may still be authenticated afterward
because the API can complete the login work even though the browser did not
receive the response and cookies in time.

This is a staging response-time problem in the successful-login path. It is not
caused by the Control Panel UI, a database health failure, or CORS:

- `GET https://staging-api.friink.com/health/db` returned HTTP 200 with
  `{"database":true}`.
- The staging CORS preflight for `POST /auth/login` returned HTTP 200 and
  allowed `https://staging.friink.com` with credentials.
- A harmless invalid-credentials request returned HTTP 401 in approximately
  2.7 seconds.
- The frontend turns an aborted request into `The request timed out.` after
  `API_REQUEST_TIMEOUT_MS = 30000` in `web/lib/api-origin.ts:5,37-50`.
- The same staging timeout/response race was previously observed for signup and
  OTP flows in `docs/account-switcher.md:506-517`.

## Current cause

The successful login path authenticates the user and then performs session,
security-event, account-slot, and notification work before returning. In
`api/app/routers/auth.py:297-351`, `_issue_login_session` creates and commits
the authentication state, then calls `process_notification_outbox(session)` at
lines 329-337 before the response is returned and the refresh/device cookies
are attached at lines 346-350.

Therefore the login response is coupled to synchronous notification-outbox
processing. A slow database operation, lock, cold start, or outbox workload can
make the browser's 30-second request deadline expire even when authentication
has already succeeded.

## Deferred fix

When this issue is reopened, shorten the login critical path:

1. Authenticate the user, create the session/security records, commit them, and
   return the token and cookies without draining the notification outbox.
2. Keep the security event and outbox record durable in the existing tables.
3. Process the outbox asynchronously through a separate worker or scheduled
   job. The current Vercel deployment does not provide a durable background
   worker, so this needs an explicit deployment decision before implementation.
4. Add timing instrumentation around authentication, database commit, session
   creation, and outbox processing to identify slow operations in staging.
5. Add client-side recovery for a lost login response, using the existing
   refresh-session mechanism only after confirming that cookie issuance and
   replay behavior are safe.

Do not solve this by merely increasing the frontend timeout. That would hide the
response-path defect and leave login dependent on notification delivery.

## Scope note

This document records the behavior and proposed fix only. No runtime code,
database schema, deployment configuration, or notification worker was changed
for this investigation.
Control Panel access is a separate staff step-up after ordinary login. The
ordinary login session remains active when privileged staff access expires or
is explicitly logged out.
