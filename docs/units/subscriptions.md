# Subscriptions

Subscriptions describes Friink plans, current entitlement presentation, and
the boundary between informational plans and future billing.

**Status:** Partial — informational plans, server-resolved summaries, and manual staff assignment are active; billing is not active
**Tier:** Standard  
**Last edited:** 2026-09-21T00:00:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns plan presentation and subscription entitlement behavior.
Chat may consume the server-resolved entitlement for its paid request policy.

## Related units

- [Chat](./chat.md) — consumes paid-tier request eligibility.
- [Settings](./settings.md) — shows the current plan and compares available plans.
- [Staff Admin](./staff-admin.md) — owns current administrative assignments.
- [Design System](../design-system.md) — owns public plan-card presentation.

## Plan definitions

### Friink Free

Free is the default plan and includes:

1. Unlimited posts, replies, and quotes.
2. Chat (mutual followers).
3. Use Friink as a professional.

### Friink Pro

Pro includes everything in Free, plus:

1. Everything in Friink Free.
2. Message requests.
3. Profile view count.
4. Longer posts up to 512 characters.
5. Directory listing for registered professionals.

The planned commercial price is USD 4 per month after the first month. Planned
billing rules revoke Pro after 8 days of nonpayment. Professional registration
is independent of subscription and is never revoked because a subscription
expires or is cancelled.

### Friink Pro+

Pro+ includes everything in Pro, plus:

1. Everything in Pro.
2. Profile and post analytics.
3. Profile boost for the feed.
4. Fewer ads.

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
- **SUBS-R-003:** Settings shows the current server-resolved plan first, then
  compares Free, Pro, and Pro+ in the same Subscription tab while paid billing
  is inactive.
- **SUBS-R-004:** Paid plan cards show non-action `Coming soon` states until
  billing is implemented; Free links to login as appropriate.
- **SUBS-R-005:** Subscription status must not bypass account, connection,
  blocking, or chat security rules.

## UX and flows

The public `/subscriptions` surface compares Friink Free, Pro, and Pro+. The
Settings Subscription tab shows a compact current-plan summary first, then
repeats the plan comparison in the authenticated settings context. The summary
contains the plan name, price, and access status; plan rows contain the feature
details and available action state. No checkout, payment, or self-service
billing flow is active.

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

### Recommended UX contract (planned)

The following decisions define the intended experience for the manual process.
The plan-change confirmation summary is implemented; notifications, reminders,
and the remaining paid-feature surfaces remain planned.

- Manual access must never be described as a purchase, payment, upgrade, or
  renewal. Use `Grant access`, `Change access`, and `Return to Free`.
- Every staff plan mutation requires a confirmation summary showing the user,
  resulting plan, effective date, expiry or `No expiration`, and what happens
  to the current assignment. Replacing an active assignment must explicitly
  say that the old assignment ends immediately.
- Users receive calm in-app feedback for every grant, change, revocation, and
  expiration. Email mirrors those events when email delivery is configured.
  Internal staff reasons are not exposed by default.
- Expiry reminders are sent at 7 days, 1 day, and expiration. Before billing
  exists, expired users are directed to support or an administrator rather
  than to a payment or checkout action.
- The Settings view always leads with the effective current plan. After paid
  access ends, it shows Friink Free and may include a quiet note identifying
  the previous plan and end date; expired or revoked paid plans must not look
  active.
- Paid features should not be scattered through the product as fake upgrade
  funnels while billing is unavailable. `Coming soon` belongs in the plan
  comparison until a feature is actually implemented. Once a paid feature is
  active, an unavailable Free-state affordance may explain `Available with
  Friink Pro` or `Available with Friink Pro+` in context.
- Staff see the complete assignment history and audit reasons. Users see the
  effective plan, access status, expiry, and concise recent-change feedback,
  not the internal assignment timeline.
- Every paid feature, including message requests, must resolve access from
  the server entitlement contract. Client plan names and legacy tier fields
  must not decide feature access.

### Planned flows

#### Staff grants or changes access

1. Staff opens Control Panel → Users and searches by username or email.
2. Staff opens the user and reviews the current effective plan and history.
3. Staff chooses `Adjust plan`, selects Free, Pro, or Pro+, and chooses a
   duration, custom expiry, or `No expiration`.
4. Staff enters a reason and reviews the confirmation summary.
5. The system replaces any active assignment atomically, records the audit
   event, and shows a success state describing manual access.
6. The user receives the corresponding in-app notification and email when
   configured.

#### Staff renews access

1. Staff opens an active assignment and chooses the same plan in `Adjust plan`.
2. Staff chooses a duration and enters a reason.
3. The summary explains that the duration extends from the existing expiry.
4. The system saves the new effective expiry and records the replacement and
   renewal history.

#### Staff returns a user to Free

1. Staff chooses `Return to Free` from an active paid assignment.
2. A separate confirmation asks for a reason and states that paid access ends
   immediately.
3. The system revokes the assignment, resolves the user to Friink Free, and
   records the audit event.
4. The user sees the Free state and receives a revocation notification.

#### Access approaches or reaches expiry

1. The system sends the planned 7-day and 1-day reminders.
2. At expiry, the effective plan resolves to Friink Free without requiring a
   background billing job.
3. Settings shows Free plus a quiet previous-access note, if available.
4. The user receives an expiration notification with support/admin guidance;
   no checkout action is shown.

#### User encounters a paid-only feature

1. If the feature is not yet implemented, the user does not encounter a
   scattered upgrade prompt; the plan comparison says `Coming soon`.
2. If the feature is implemented but unavailable to Free, the local surface
   explains the required plan and preserves a useful read-only or empty state.
3. The API makes the final entitlement decision and the UI reflects the
   server response.

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
current Settings subscription summary and plan comparison are connected to the
server-resolved entitlement only for current-plan state; public and settings
plan actions remain informational. The final capability matrix and billing
notifications remain planned. Professional registration is
documented and implemented independently of subscription access; subscription
status only participates in directory eligibility.
