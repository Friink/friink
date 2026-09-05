# Account Lifecycle — Business Rules (Draft)

Status: Draft business contract; do not implement until the open discussion
items below are resolved and synchronized with `docs/auth-and-session.md`.

Last updated: 2026-09-06

This document defines account deactivation, pending deletion, reactivation, and
permanent deletion. It is intentionally separate from the authentication and
session architecture, but the login-state routing and session-revocation
mechanisms must remain consistent across both documents.

## 1. Account states

The lifecycle uses these states:

- `active`: normal visibility, notifications, login, and account use.
- `deactivated`: the owner has temporarily hidden the account; it can be
  restored by a successful reactivation flow.
- `pending_deletion`: the account is deactivated and has entered the 32-day
  period before permanent deletion; reactivation cancels deletion.
- `deleted`: permanent deletion has completed; the account cannot be restored.

The account's email and username remain reserved while it is `deactivated` or
`pending_deletion`. They are released only after the account reaches
`deleted`.

## 2. Deactivation

Deactivation is triggered by the account owner from Settings → Account while
logged in.

Before confirmation, the user sees a modal stating that:

- deactivation is not deletion;
- the profile, posts, and likes become invisible to others;
- chats remain readable, but the composer is disabled for both parties;
- the display name becomes `Friink User` everywhere it appears, while the
  username is retained;
- the account is restored on confirmed reactivation;
- subscription billing continues during deactivation unless the user cancels
  separately, so Pro/Pro+ status is restored when the account returns.

On confirmation:

- all other active sessions are revoked immediately;
- the session performing deactivation is ended after confirmation;
- the account is removed from professional directories and search results;
- standard notifications are suppressed while deactivated;
- the draft lifecycle exception allows only failed/attempted-login
  notifications or successful-reactivation notifications while deactivated;
- the account's existing likes render `Friink User` with a default avatar;
- the account cannot send messages, and other users cannot initiate new
  messages to it.

The lifecycle exception above is unresolved and is not a Phase 7 failed-login
email. Its trigger, suppression, privacy, and delivery behavior must be
decided in the pre-development discussion gate below.

A login attempt for a deactivated account follows the authentication decision
order in section 5. After valid credential verification, it shows a
reactivation confirmation modal instead of creating a normal session.
Confirmation restores visibility, the display name, notifications, directory
listing, and normal account use.

## 3. Deletion

Deletion is triggered by the account owner from Settings → Account while
logged in. A deactivated account must reactivate before it can request
deletion; there is no direct deactivated-to-deleted request path.

Deletion requires OTP identity verification. Before confirmation, a modal must
state plainly that:

- deletion is permanent after completion and cannot be undone;
- the account first enters a 32-day deactivated period;
- returning and confirming reactivation during that period cancels deletion;
- subscription billing is cancelled immediately when deletion begins;
- no refund is issued for the remaining current billing period.

On confirmation, the account immediately enters the same hidden/deactivated
state described above, all sessions are revoked, and the 32-day deletion
countdown begins.

During the 32-day period:

- email and username remain reserved;
- a valid login shows a distinct pending-deletion reactivation modal;
- the modal explains that confirmation cancels pending deletion and restores
  the account;
- reactivation restores the account and cancels deletion;
- subscription billing does not automatically resume and must be re-subscribed
  separately.

Four days before the deadline, send one warning email to the account's on-file
email address if the account is still `pending_deletion`. The warning must
  explain that permanent deletion is imminent and that logging in and
  confirming reactivation cancels it. Delivery failure must not block deletion,
  and reactivation must prevent any later warning retry for the cancelled
  deletion request.

If the account does not return within 32 days:

- the profile, posts, likes, and other content in the deletion scope are
  permanently deleted;
- chat messages remain read-only, with the sender shown as `Account Deleted`;
- the internal UUID is retained only as a deleted referential-integrity marker;
- the account is not reactivatable;
- the email and username are released for new registration only after
  permanent deletion completes.

## 4. Presentation and content rules

While an account is `deactivated` or `pending_deletion`:

- profile, post, and like surfaces use the documented hidden-account behavior;
- the display name is `Friink User` and a default avatar is used where a user
  identity must remain visible;
- existing chats remain readable but cannot be used to send new messages;
- standard follower, reply, and similar notifications are suppressed.

After permanent deletion, retained chat history uses `Account Deleted` rather
than the temporary `Friink User` placeholder.

## 5. Login and reactivation routing

The login flow must preserve privacy and use this order:

1. Normalize the supplied identifier and resolve any matching account without
   changing the generic unauthenticated response for unknown identifiers.
2. Verify the password before exposing lifecycle-specific UI.
3. For an active account, continue through ordinary risk, lockout, and session
   creation rules.
4. For a deactivated account with valid credentials, show the plain
   reactivation modal and do not create a normal session until confirmation.
5. For a pending-deletion account with valid credentials, show the distinct
   cancellation-of-deletion modal and do not create a normal session until
   confirmation.
6. For a deleted account, never offer reactivation.

Wrong passwords, malformed identifiers, and unknown identifiers must not reveal
which lifecycle state a possible account has.

Session revocation and reactivation must use the authoritative server-side
mechanisms defined in `docs/auth-and-session.md`.

## 6. Cross-references

- `docs/auth-and-session.md` governs ordinary login, progressive lockout,
  failed-login notification, session revocation, refresh, and reactivation
  login routing.
- `docs/auth-and-session-progress.md` records implementation and staging
  evidence; this draft is not evidence of implemented behavior.
- Billing cancellation, continuation, and re-subscription must remain aligned
  with the billing/account-entitlement contract when that contract exists.

## 7. Pre-development discussion gate

The following items must be discussed and resolved before any account-lifecycle
or Phase 7 runtime development begins:

1. **Deactivated-account login emails:** The lifecycle draft says deactivated
   accounts are notified of failed/attempted logins, while Phase 7 explicitly
   applies only to normal active-account failures. Decide whether lifecycle
   alerts are removed, or defined as a separate notification type with its own
   trigger, suppression, privacy, and delivery rules. Until resolved, Phase 7
   remains active-account-only and deactivated/pending-deletion attempts do
   not enter its notification path.
2. **Immediate token invalidation:** Deactivation promises logout everywhere,
   while the existing ordinary account-lock rule allows already-issued access
   tokens to expire normally. Decide whether deactivation is a stronger
   account-state exception checked on every request, or uses another immediate
   invalidation mechanism.
3. **Failure and reactivation boundaries:** Confirm that only wrong-password
   failures for active accounts count toward Phase 7; failed OTP/MFA,
   cooldown rejections, administrative locks, and lifecycle-state attempts use
   separate rules.
4. **Reset and warning-link contracts:** Define expiry, single-use behavior,
   token hashing, session effects, address-change races, bounce handling, and
   delivery retry semantics for both password-reset and deletion-warning
   links.
5. **State-transition concurrency:** Define the transaction and idempotency
   behavior for reactivation racing with the 32-day deletion job, logout-all,
   email changes, and notification dispatch.
6. **Abuse controls:** Define cross-account/IP/device/provider limits so
   lifecycle and failed-login notifications cannot be used to send email
   floods.

No implementation or green verification flag should be claimed for these flows
until this gate is resolved and the decisions are synchronized across the
architecture, lifecycle, progress, and active product-rule documents.
