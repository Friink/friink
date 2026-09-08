# Friink Password Recovery

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
