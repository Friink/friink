# Friink Latency Investigation

Status: Evidence record for the 2026-09-10 authentication, account-switcher,
and staging startup tests. This records observations; it does not claim a
database or network root cause without server-side timing data.

## Scope

The investigation covered login, OTP completion, Add account, account-list
refresh, account switching, and initial authenticated page loading. Main was
not changed. No additional tests were run after the final staging
verification.

## Measurements and observations

### Local account switching after pooling

- Two post-pooling switch completions were observed at approximately 1.0 and
  1.7 seconds.
- The selector's full remembered-account refresh reached approximately
  12 seconds before all three remembered accounts appeared.
- This separates switch completion from account-list refresh: pooling improved
  the switch path, but did not make the list refresh consistently immediate.
- The local API was run with the staging variable profile for the test; account
  switch requests and list refresh returned HTTP 200.

### Local authenticated page behavior

- The local app showed the feed loading state for roughly 20 seconds in one
  observation and reached usable feed content at roughly 35 seconds.
- The user also reported cold-start behavior requiring two or three reloads
  before the domain/app became usable and an occasional first `/home` error
  that disappeared after refresh. These are reports, not isolated timings.

### Staging OTP/login observation

- Before the recovery patch, OTP completion could show a request-timeout
  message immediately before redirecting to `/home`. This was classified as
  an ambiguous commit/response race rather than proof of failed login.
- The recovery behavior was exercised in a Chrome incognito session. After
  the user supplied the OTP, the flow completed and redirected to
  `/home/explore` without displaying the timeout error.
- The same shared login component is used by standalone login and Add account;
  both are covered by the documented recovery behavior. The in-app Add account
  flow reached OTP successfully after credentials were entered manually.

### Staging selector observation after authentication

- Opening the selector showed `Updating accounts…` and a visible current
  account while the asynchronous list refresh ran.
- Account identity must be checked using the API-returned username/display
  summary. The authentication email is not evidence of the username.

## Findings

1. Pooling is a plausible contributor to connection setup/reuse latency and
   improved the measured local switch path, but it does not explain the full
   account-list refresh delay by itself.
2. The OTP timeout symptom was a correctness/UX race: the server could commit
   while the browser saw a client/network timeout. One bounded refresh-cookie
   recovery now handles that ambiguity without logging the user out.
3. Account-list refresh, account switching, and authenticated page bootstrap
   are separate timings. They must be instrumented separately before assigning
   delay to Neon, network transport, API work, or frontend rendering.
4. The tests did not provide server-side spans, database query timings, or
   browser network waterfalls. This record therefore does not attribute the
   remaining seconds specifically to Neon, the API, the database, or the
   browser.

## Follow-up boundary

Further optimization is not justified by these tests alone. If latency again
becomes release-blocking, collect request IDs and server timings for the
account-list, switch, OTP verification, refresh recovery, and initial feed
requests, then compare API, database, and browser timings.

## Login-request expiry race fix

The durable follow-up fix serializes OTP, approval, and denial transitions on
the API and exposes `otp_verified` for a challenge consumed by OTP. The web
client also stops approval polling once OTP entry or submission begins. This
change has passed local TypeScript and focused API assertions; a fresh staging
browser retest remains the deployment gate.
