# Account Lifecycle — Business Rules

Status: Approved business contract; the initial runtime slice is implemented
and verified in staging, but the implementation gates in section 7 remain the
source of truth for the full lifecycle green flag.

Last updated: 2026-09-06

The product decisions below were confirmed during the lifecycle review on
2026-09-05. This document is the source of truth for lifecycle UX and state
transitions; `docs/auth-and-session.md` remains authoritative for ordinary auth,
refresh, lockout, and session mechanics.

## 1. Account states

The lifecycle uses these states:

- `active`: normal visibility, notifications, login, and account use.
- `deactivated`: the owner has temporarily hidden the account; it can be
  restored by a successful reactivation flow.
- `pending_deletion`: the account is deactivated and has entered the configured
  grace period (32 days by default) before permanent deletion; reactivation
  cancels deletion.
- `deleted`: permanent deletion has completed; the account cannot be restored.

The account's email and username remain reserved while it is `deactivated` or
`pending_deletion`. They are released only after the account reaches `deleted`.

The immutable internal user UUID is never reused or deleted. After permanent
deletion it is retained as a private tombstone and remains linked to historical
email and username values. Those values are never used to resolve a released
username or email to a new owner and are never exposed to ordinary users.

## 2. Deactivation

Deactivation is triggered by the account owner from Settings → Account while
logged in. The product UI has no staff deactivation/reactivation control;
authorized Friink staff retain a separate audited backend override for support,
abuse, legal, and recovery cases.

Before confirmation, the user sees a calm modal stating that:

- deactivation is not deletion and the account can be restored at any time;
- the profile and public content become unavailable to others;
- chats remain readable, but become read-only and the composer is disabled for
  both parties;
- wherever identity must remain visible, the display name becomes `Friink User`,
  the real username remains visible, and the default avatar is used;
- subscription billing continues during deactivation unless the user cancels
  separately; deactivation does not pause or cancel a subscription;
- a `Manage subscription` link is available before confirmation, but billing
  cancellation is not performed by the deactivation action.

Deactivation requires fresh current-password confirmation, including on a
recognized device. OTP is not required for deactivation. A failed password
confirmation does not change lifecycle state.

The API-owned `OTP_ENABLED` setting defaults to `true`. In local, test, or
staging environments where it is explicitly set to `false`, lifecycle OTP
checks are bypassed to support testing; production startup rejects that value.

On confirmation:

- all active sessions and refresh-token families are revoked immediately;
- the session performing deactivation is ended after the confirmation response;
- the server immediately rejects authenticated requests for the deactivated
  account, including requests made with already-issued access tokens;
- the account is removed from professional directories and search results;
- standard notifications are suppressed while deactivated;
- existing likes and notifications retain their relationship row but render the
  placeholder identity described above;
- the account cannot send messages, and other users cannot initiate new messages
  to it;
- a calm logged-out confirmation screen explains that all sessions ended, that
  uncancelled subscriptions may still be charged, and that the user can return
  after reactivation.

Failed login attempts for deactivated or pending-deletion accounts never send
email. A minimal internal security/rate-limit event may be recorded, but it must
not contain the submitted password, raw identifier, raw IP address, raw device
identifier, or unnecessary lifecycle detail. Access is restricted to authorized
security/staff tooling with bounded retention.

## 3. Deletion

Deletion is triggered by the account owner from Settings → Account while logged
in. A deactivated account must reactivate before it can request deletion; there
is no direct deactivated-to-deleted request path.

Deletion requires fresh current-password confirmation and OTP identity
verification when `OTP_ENABLED=true`. Before confirmation, the modal must state
plainly that:

- deletion is permanent after completion and cannot be undone;
- the account first enters the configured deactivated period (32 days by
  default);
- returning and confirming reactivation cancels deletion;
- subscription billing is cancelled immediately when deletion begins;
- no refund is issued for the remaining current billing period.

On confirmation, the account immediately enters `pending_deletion`, all sessions
are revoked, and the configured deletion countdown begins. The deletion request
has a unique identifier/version used by every warning and deletion job.

### Configurable lifecycle timing

The lifecycle durations are server-side environment variables with these
defaults:

```env
ACCOUNT_DELETION_GRACE_DAYS=32
ACCOUNT_DELETION_WARNING_DAYS=4
```

Both values must be positive integers, and the warning period must be shorter
than the grace period. The warning period is measured back from the stored
deletion deadline. When a deletion request begins, the service stores its
calculated deadline and request version; later environment changes must not
silently change deadlines for existing requests. All calculations use UTC.

Production changes to these values require an operational review and must be
recorded in deployment logs. The variables are server-side only and are never
returned to clients.

During the configured grace period:

- email and username remain reserved;
- valid login shows a distinct pending-deletion reactivation screen;
- the screen explains that confirmation cancels pending deletion and restores
  the account;
- reactivation requires valid credentials plus a fresh OTP when
  `OTP_ENABLED=true`;
- successful reactivation restores normal visibility and use, cancels the
  deletion request, and creates only one new session; other devices authenticate
  again;
- subscription billing does not automatically resume and must be re-subscribed
  separately;
- reactivation remains possible until the deletion transaction begins,
  including during the final hour.

The configured warning period before the deadline (four days by default), send
one warning email to the account's on-file
email address if the account is still `pending_deletion`. The warning explains
that permanent deletion is imminent and that logging in and confirming
reactivation cancels it. Delivery failure never blocks deletion, and reactivation
prevents later warning retries for the cancelled request.

The warning is a separate deletion-lifecycle email, not a Phase 7 failed-login
notification. It uses a single-use, expiring, hashed request token or equivalent
authenticated return path. Provider failure is a redacted outbox result and is
retryable only while the deletion request remains current.

If the account does not return within the configured grace period, the deletion
worker permanently removes public and user-generated data, including:

- the profile and public profile media;
- posts, replies, quotes, likes, saves, and follows;
- post media and other user-uploaded public content.

The following remain under restricted access:

- the immutable UUID as a deleted referential-integrity tombstone;
- private historical email and username records;
- legally or operationally required billing records;
- security and audit records;
- retained chat messages, with the sender shown as `Account Deleted`.

Active sessions, refresh tokens, recognized-device credentials, temporary
reservations, and OTP/challenge material are revoked or purged. Retained chats
remain readable but read-only; new messages, follows, mentions, and reactions
are not possible.

The deletion worker is retryable and idempotent. A failure raises a staff-visible
operational flag, and authorized staff may complete or repair deletion through an
audited backend action. Staff actions cannot expose the account's retained
private history to ordinary users.

## 4. Presentation and content rules

While an account is `deactivated` or `pending_deletion`:

- profile, post, like, and notification surfaces use the hidden-account behavior;
- identity that must remain visible uses `Friink User`, the real username, and a
  default avatar;
- existing chats remain readable but cannot send new messages;
- standard follower, reply, reaction, and similar notifications are suppressed;
- email/username changes and other account-detail changes are unavailable.

After permanent deletion, retained chat history uses `Account Deleted` rather
than the temporary `Friink User` placeholder.

After reactivation, all surfaces must resolve the restored account identity
again; placeholder identity must not remain cached in profiles, likes,
notifications, search, feeds, or chat participants.

## 5. Login and reactivation routing

The login flow preserves privacy and uses this order:

1. Normalize the supplied identifier and resolve any matching account without
   changing the generic unauthenticated response for unknown identifiers.
2. Verify the password before exposing lifecycle-specific UI.
3. For an active account, continue through ordinary risk, lockout, and session
   creation rules.
4. For a deactivated account with valid credentials, show the calm reactivation
  screen and do not create a normal session until confirmation and fresh OTP
  verification succeed when `OTP_ENABLED=true`; with the test override off,
  valid credentials complete reactivation directly.
5. For a pending-deletion account with valid credentials, show the distinct
   cancellation-of-deletion screen and do not create a normal session until
   confirmation and fresh OTP verification succeed when `OTP_ENABLED=true`;
   with the test override off, valid credentials complete reactivation directly.
6. For a deleted account, never offer reactivation.

Wrong passwords, malformed identifiers, and unknown identifiers must not reveal
which lifecycle state a possible account has. Only active accounts may access
the platform normally; deactivated and pending-deletion accounts have access
only to the narrowly scoped reactivation flow.

Successful reactivation creates one new ordinary session and does not restore
previous sessions or remembered device credentials. No account-detail change is
available before reactivation.

## 6. Billing and transition policy

- Deactivation does not cancel or pause billing. The user is warned before
  confirmation and can manage the subscription separately.
- Deletion cancels billing immediately. A later reactivation does not resume the
  subscription; the user must subscribe again.
- Repeated lifecycle cycling is rate-limited. There is no reactivation delay;
  after reactivation, another deactivation is allowed only after a 24-hour
  cooldown. Staff overrides may bypass the product cooldown when audited.

## 7. Implementation gates and resolved decisions

The following policy decisions are resolved:

- Deactivated-account failed-login attempts are internal-only and never send
  user email. Phase 7 remains limited to normal active accounts.
- Deactivation is stronger than ordinary account locking: the server rejects
  authenticated requests for the deactivated state immediately, while the
  transaction revokes all refresh families and sessions.
- Only active-account wrong-password failures participate in Phase 7. Failed
  OTP/MFA, cooldown rejections, administrative locks, and lifecycle-state
  attempts use separate counters/events.
- Deactivation requires fresh current-password confirmation. Deletion requires
  current-password confirmation plus OTP and reactivation requires valid
  credentials plus a fresh OTP when the master OTP switch is enabled.
- Reactivation creates only a new session and never restores prior sessions.
- Staff retain backend override functionality, protected by role checks and
  immutable audit events.

The following implementation gates remain open:

1. **Reset and warning-link contract:** finalize expiry, single-use behavior,
   token hashing, address-change races, bounce handling, and retry semantics for
   password-reset and deletion-warning links.
2. **State-transition concurrency:** implement transaction/idempotency rules for
   reactivation racing with the deletion job, logout-all, email changes, and
   notification dispatch. Every job must validate the current request
   identifier/version before acting.
3. **Abuse controls:** define and test cross-account, IP, device, OTP, and
   provider limits so lifecycle actions and notifications cannot cause floods.
4. **Deletion operations:** implement retryable deletion jobs, staff-visible
   failure flags, audited staff completion, legal/operational retention, and the
   final-hour cancellation boundary.
5. **UX/accessibility:** specify and test the deactivation confirmation,
   logged-out confirmation screen, reactivation screens, deletion warning,
   loading/error/retry states, keyboard/focus behavior, and calm copy across
   mobile, tablet, and desktop.

No lifecycle runtime implementation or green verification flag should be
claimed until these gates are implemented, tested, and synchronized across the
architecture, lifecycle, progress, and active product-rule documents.

## 8. Cross-references

- `docs/auth-and-session.md` governs ordinary login, progressive lockout,
  failed-login notification, session revocation, refresh, and auth routing.
- `docs/auth-and-session-progress.md` records implementation and staging
  evidence; this document is a business contract, not runtime evidence.
- Billing cancellation, continuation, and re-subscription must remain aligned
  with the billing/account-entitlement contract when that contract exists.
