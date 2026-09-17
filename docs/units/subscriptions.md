# Subscriptions

Subscriptions describes Friink plans, current entitlement presentation, and
the boundary between informational plans and future billing.

**Status:** Partial — informational plans, server-resolved summaries, and manual staff assignment are active; billing is not active
**Tier:** Standard  
**Last edited:** 2026-09-16T23:44:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns plan presentation and subscription entitlement behavior.
Chat may consume the server-resolved entitlement for its paid request policy.

## Related units

- [Chat](./chat.md) — consumes paid-tier request eligibility.
- [Settings](./settings.md) — shows the current plan and links to plans.
- [Staff Admin](./staff-admin.md) — owns current administrative assignments.
- [Design System](../design-system.md) — owns public plan-card presentation.

## Plan definitions

### Friink Free

Free is the default plan and includes:

1. Unlimited posts, replies, and quotes.
2. Chat with mutual followers.

### Friink Pro

Pro includes everything in Free, plus:

1. Message requests.
2. Profile view count.
3. Longer posts up to 512 characters.
4. Directory visibility for eligible professional profiles.

The planned commercial price is USD 4 per month after the first month. Planned
billing rules revoke Pro after 8 days of nonpayment. Professional registration
is independent of subscription and is never revoked because a subscription
expires or is cancelled.

### Friink Pro+

Pro+ includes everything in Pro, plus:

1. Profile and post analytics.
2. Profile boost for the feed.
3. Fewer ads.

The planned commercial price is USD 8 per month. The planned launch offer is
one month free for Pro users, and planned billing rules revoke Pro+ after 8
days of nonpayment.

Pricing, introductory offers, automatic renewal, and nonpayment revocation are
future billing behavior. They are not active while billing and payment
integration remain unavailable.

## Rules

- **SUBS-R-001:** Public plans are informational until billing exists.
- **SUBS-R-002:** Entitlements are resolved server-side from one assignment;
  clients must not self-declare paid access.
- **SUBS-R-003:** Settings shows the current `Friink Free` plan and a View plans
  link while paid billing is inactive.
- **SUBS-R-004:** Paid plan cards show non-action `Coming soon` states until
  billing is implemented; Free links to login as appropriate.
- **SUBS-R-005:** Subscription status must not bypass account, connection,
  blocking, or chat security rules.

## UX and flows

The public `/subscriptions` surface compares Friink Free, Pro, and Pro+. The
Settings Subscription tab summarizes the current plan. No checkout, payment,
or self-service billing flow is active.

Until billing exists, a superadmin may manually promote a user from Free to Pro
or Pro+, change Pro and Pro+ assignments, or return a paid assignment to Free.
Manual assignments require a plan, an optional expiration or no-expiration
choice, and a reason; the effective plan remains server-resolved. Users should
see their current plan and access expiration in Settings, with clear in-app
feedback when access is granted, changed, expired, or revoked.

### Manual-assignment UX (current rollout)

The Control Panel Users surface searches by username or email and shows all
matching accounts, including deactivated and pending-deletion accounts. A
deactivated account remains visible for context, but plan-management actions
are disabled. Pending deletion is shown with its deletion countdown, such as
`Scheduled for deletion in 18 days`, based on the existing 32-day lifecycle
window.

The user detail surface shows the current plan, effective status, expiry,
and assignment history. `Adjust plan` will use a duration selector with
presets for 30 days, 90 days, 1 year, a custom expiry date, and no expiration.
The custom date control is revealed only when selected, and cannot be earlier
than the current date. The form requires a reason and shows a confirmation
summary before saving. Replacing an active assignment explains the effect
before confirmation.

Manual renewal extends from the existing expiry when the assignment is still
active; an expired assignment starts from the current date. Revoke is a
separate confirmed action and immediately returns the effective plan to Free.
The user-facing state uses `Active`, `Expired`, and `Revoked`; staff also see
the full immutable assignment history and audit details.

Professional registration is independently modeled in the staff
workflow. Any user may apply without a subscription by submitting Institute
and Credential ID. Staff may approve, reject with a message, or revoke an
approved registration. A rejected user may reapply immediately. The active
directory gate is Pro or Pro+ plus either a self-declared professional intent
or active Friink registration. Free users may apply and may show profile
badges, but they are not listed in the directory. Subscription expiry or
revocation removes directory visibility without automatically changing the
profile's self-declared or registration state.

The self-declared `Professional` badge remains an opt-in profile-display
preference controlled by `How I use Friink`. `Friink Registered` is a separate
staff-controlled badge and remains visible while registration is active.
Clicking or hovering the registered badge may show the approved Institute and
Credential ID.

Grant, change, expiry, and revoke events have an in-app and email notification
contract. The existing email delivery path is used when configured, and email
delivery failure must not roll back the entitlement. The
planned expiry reminders are sent once at 7 days before expiry, 1 day before
expiry, and at expiry. Until payment integration exists, these are manual
assignment lifecycle notifications rather than billing or renewal notices.

## Technical contract

Subscription routes, schemas, models, and services provide current plan and
administrative assignment behavior. Billing provider integration is not present.

## Acceptance criteria

- [ ] Public plans clearly indicate unavailable paid actions.
- [ ] Current plan is server-resolved and displayed consistently.
- [ ] Paid status cannot be fabricated by the client.
- [ ] Chat entitlement checks remain server-authoritative.

## Known limitations

Payments, checkout, recurring billing, cancellation, automatic renewal,
nonpayment enforcement, and customer self-service are not implemented. The
current Settings subscription summary is connected to the server-resolved
entitlement. Public plan cards remain informational, and the final capability
matrix, notifications, and professional-status workflow remain planned.
