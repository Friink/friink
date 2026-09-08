# Friink Auth Incident Response

This runbook is for authorized operators handling authentication or session
incidents. It is an operational document, not a user-facing explanation.

## Non-negotiable boundaries

- Never place passwords, OTPs, raw refresh tokens, JWT secrets, raw reset
  tokens, or private IP data in tickets, logs, or chat.
- Use the protected auth-operations path with the dedicated
  `AUTH_OPERATIONS_INTERNAL_TOKEN`; do not edit authentication rows manually.
- Prefer the smallest safe scope. A user-level operation is safer than a
  platform-wide revocation.
- Send a unique `Idempotency-Key` with every operation and reuse that same key
  when retrying the request; a completed retry returns the original result.
- Record the reason, operator, scope, result counts, and verification evidence.

## Signing-key compromise

1. Declare the incident and preserve the current deployment and logs.
2. Generate a new signing secret outside the repository.
3. Deploy verification support with both the old and new `kid` keys configured.
4. Switch `JWT_ACTIVE_KID` to the new key and verify newly issued access tokens
   use it while old tokens remain valid only during the overlap window.
5. If compromise requires immediate containment, run the smallest applicable
   session-revocation operation.
6. Keep the old key through the maximum access-token lifetime plus clock-skew
   safety margin, then remove it in a separate deployment.
7. Verify new login, refresh, old-key overlap, old-key rejection after
   retirement, rollback behavior, and secret redaction.

## Refresh-token or account compromise

1. Confirm the target account or affected scope using internal identifiers.
2. Run the per-user revoke-all operation with an explicit reason and
   confirmation. This revokes refresh sessions and recognized devices and
   increments the user's security epoch, invalidating issued access tokens.
3. If the affected account is staff or an administrator, run the independent
   `contain-admin` operation. It disables staff access, locks the account,
   revokes privileged staff sessions, and performs the same session/device
   invalidation without relying on the compromised administrator's session.
4. For an ordinary account, apply the existing audited account-lock action if
   containment is required; do not confuse it with progressive login cooldown.
4. Confirm the next authenticated request receives the deliberate-revocation
   result and the user sees: `For your security, your session ended. Please
   sign in again.`

## Platform-wide containment

Use the all-account operation only for a confirmed platform-level incident.
Capture the pre-operation scope, confirmation, returned counts, and post-
operation verification. Expect all affected users to sign in again; do not
attempt to restore old sessions by copying or editing authentication rows.

## Recovery and rollback

If an operation partially fails, preserve the returned counts and failed
request evidence, retry the same idempotent scope after diagnosis, and verify
that already-revoked records remain revoked. A deployment rollback must keep
the old and new token-verification keys compatible until all tokens issued by
the newer deployment have passed their safety window.

## User communication

Users receive the normal login route after deliberate session invalidation. The
client-facing message is intentionally limited to the approved security
re-login copy; internal incident cause, scope, operator identity, and account
enumeration are never shown.
