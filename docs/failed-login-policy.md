# Failed-login throttling policy

**Status:** Implemented locally; pending explicit deployment and release
verification. This document is the target contract for the replacement of the
former Phase 7 cooldown schedule.

## Goals

The policy should slow credential stuffing and password guessing without
turning ordinary user mistakes into a long account lockout. Progressive
cooldowns are temporary sign-in throttles, not full account locks.

## Account-based failure policy

Failed attempts are tracked per account and apply equally to email and username
login. The server is authoritative for the counter and cooldown expiry.

| Failed attempt | Result |
| --- | --- |
| 1–2 | Generic invalid-credentials response; no cooldown |
| 3 | Generic invalid-credentials response; create one security notification |
| 4–5 | One-minute cooldown |
| 6–8 | Five-minute cooldown |
| 9 and later | Fifteen-minute cooldown, capped at this tier |

Additional rules:

- A failed submission during a cooldown does not extend the cooldown or advance
  the tier; it returns the remaining server-provided time.
- A successful login clears the failure counter and cooldown.
- If no further failure occurs for 24 hours, the progressive failure state
  clears.
- A full account lock is a separate administrative or high-confidence
  security action. It is not created by this progressive policy.
- Existing short-lived access tokens are not invalidated by a progressive
  cooldown. Full account-lock behavior follows the ordinary account-lock
  contract.

## Layered abuse controls

The account counter is the primary control because attackers can rotate source
IP addresses. For this phase, the policy is intentionally limited to account
and IP controls:

- Apply a secondary per-IP limit across accounts.
- The initial local baseline is at most 100 protected authentication requests
  per IP in a 10-minute window, followed by a one-minute IP cooldown. This is
  an operational starting point, not a permanent ban or an account lock.
- Do not permanently ban shared networks or use an IP rule as the only control.
- Apply equivalent anti-automation protection to password reset requests, OTP
  verification, login approval, and Add-account login.
- Tune IP thresholds from production telemetry so shared networks do not create
  widespread false positives.

Device/session risk throttling is explicitly out of scope for this phase. The
existing device-recognition and risk-based OTP flows remain separate and must
not be silently reused as a failed-login throttle. A future phase may define
device/session signals, privacy boundaries, triggers, and test requirements as
its own security contract.

Unknown identifiers must not create an account-specific failure counter. They
remain subject to generic endpoint and IP protections.

## Recovery behavior

- Keep `Forgot password?` available while sign-in is temporarily paused.
- Password-reset requests remain email-only, generic for existing and
  non-existing addresses, and independently rate-limited.
- A successfully completed password reset clears the progressive login
  cooldown.
- A reset initiated from suspicious failed-login activity must require a new
  password that differs from the current password.
- Recovery must not reveal whether an account exists or expose reset tokens.

## Notifications

The third failed attempt creates at most one failed-login security notification
per account in a rolling 24-hour period. Notification delivery is a
non-blocking side effect and must not change the login result.

The notification should be calm and actionable, for example:

> We noticed several unsuccessful sign-in attempts. If this wasn’t you, reset
> your password.

Do not include IP addresses, device identifiers, internal IDs, or other
sensitive session metadata in user-facing security notifications.

## User experience

Normal failure copy:

> The email/username or password is incorrect.

One-minute cooldown copy:

> Too many sign-in attempts. Try again in about 1 minute.

Fifteen-minute cooldown copy:

> Sign-in is temporarily paused. Try again in about 15 minutes.

The web experience must:

- Show a server-backed countdown while a cooldown is active.
- Preserve the countdown across refreshes, tabs, and reopening the login view.
- Disable submission during cooldown without repeatedly sending requests.
- Preserve the identifier and clear the password after a failed attempt.
- Never show attempts remaining or internal tier names.
- Keep the cooldown distinct from `Your account is locked. Contact support.`
- Apply Add-account cooldowns only to the account being added; never disrupt
  the currently active account.
- Use accessible status messaging that does not depend on color alone.

Unknown identifiers and wrong passwords must remain indistinguishable in
user-facing copy and account-existence behavior. Cooldown responses must not
become an account-enumeration side channel.

## Verification requirements

Implementation must test:

- Every tier boundary and the cooldown cap.
- Attempts during cooldown do not extend or advance state.
- Successful login and successful password reset clear the state.
- Twenty-four-hour inactivity clears the state.
- Email and username identifiers use the same policy.
- Unknown identifiers do not create account state.
- Multiple tabs and page refreshes honor server time.
- Add-account throttling does not affect the active account.
- Notification deduplication and delivery failure isolation.
- Generic behavior for unknown identifiers and wrong passwords.
