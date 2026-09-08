# Friink Password Recovery

This document is the source of truth for ordinary password-recovery UX and
reset-link mechanics. `docs/auth-and-session.md` governs the surrounding
authentication/session boundaries, while `docs/account-lifecycle.md` governs
deactivation, deletion, and reactivation. Deletion-warning links are separate
from ordinary password-reset links and from the Phase 7 failed-login alert.

Password recovery is email-only. Users enter the email associated with their
account; usernames are not a proof of ownership. Existing and non-existing
addresses receive the same generic response.

For an existing non-deleted account, the API creates a random single-use token,
stores only its SHA-256 hash, and sends a reset link to the account email. The
token expires after 30 minutes. After a successful reset, refresh-token
families are revoked and the user must log in again.

`OTP_ENABLED` controls OTP challenges and does not disable this separate
email-token reset flow, so staging can use password recovery while OTP is off.

The initial `admin@friink.com` / `@admin` account is created by the controlled
bootstrap command in `api/scripts/bootstrap_admin.py`. Its password is entered
interactively and is never committed. After creation, it uses the same email
reset flow as other users. Losing access to the admin email remains a protected
deployment-level recovery procedure.

## API

- `POST /auth/password-reset/start` with an email. Returns `202` and a generic
  message; it never returns a token.
- `POST /auth/password-reset/confirm` with the token and a new password.

Reset tokens are not logged. Email delivery must be configured, and request
rate limiting remains required before broad production rollout.
Password recovery also revokes any active privileged Control Panel sessions
for the account. The ordinary Friink session boundary remains governed by the
existing refresh-family revocation contract.

## UX contract

The recovery form is email-only and uses neutral copy that does not reveal
whether an account exists:

> If an account exists for that email, password-reset instructions have been
> sent.

The form must not accept a username as proof of ownership, display an account
preview, or expose whether delivery succeeded. Delivery happens through the
durable outbox and never blocks or changes the response shown by the form.

The reset email is a mandatory security email, separate from marketing or
notification preferences. It should use the subject `Security alert for your
Friink account` when sent as part of a suspicious-login response, explain that
unsuccessful sign-in attempts were detected, and provide one primary `Reset
password` action. The preferred copy is: `We detected several unsuccessful
sign-in attempts to your Friink account. If you made these attempts, you can
ignore this message. If you don’t recognize them, reset your password now.`
It must not include the submitted identifier, password, raw
IP address, precise location, internal IDs, or raw token. Provider failure is
an internal redacted delivery outcome and must not create an account-existence
signal.

The reset page has explicit, calm states:

- **Valid:** `Create a new password` with the standard 8–16 character policy.
- **Expired:** `This link has expired. Request a new one.`
- **Already used:** `This link has already been used. Request a new one.`
- **Invalid:** `This link is no longer valid.`
- **Success:** `Your password was changed. For your security, you’ll need to
  sign in again.`

The page must never render a token or account-sensitive details. All states
need keyboard/focus support, responsive spacing, visible loading/error/retry
feedback, and the shared Friink theme. A successful reset requires fresh
login; it must not silently restore remembered accounts or privileged staff
access.

## Recovery and suspicious-login boundary

Phase 7 may send a reset link after the third consecutive failed login for a
normal active account, but the login page must continue showing only the
generic failure or cooldown message. It must not say that an email was sent.
Unknown identifiers, malformed identifiers, deactivated accounts, and
pending-deletion accounts do not enter this active-account notification path.

The Phase 7 notification is a separate event from a user-requested password
reset. Both may use the same reset-token service, but each request must retain
its own purpose, expiry, single-use behavior, deduplication, and audit/outbox
record. A newer reset request invalidates older reset links.

## Open implementation gates

Before broad production rollout, the implementation must finalize and test
reset-request rate limits by email, IP, and device; address-change races;
single-use invalidation; provider bounce/retry behavior; and the reset-specific
security event. Staging must verify the visible valid/expired/used/invalid
states and confirm that successful reset revokes refresh families and active
privileged staff sessions.
