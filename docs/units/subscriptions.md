# Subscriptions

Subscriptions describes Friink plans, current entitlement presentation, and
the boundary between informational plans and future billing.

**Status:** Partial — informational plans and entitlement scaffolding exist; billing is not active  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns plan presentation and subscription entitlement behavior.
Chat may consume the server-resolved entitlement for its paid request policy.

## Related units

- [Chat](./chat.md) — consumes paid-tier request eligibility.
- [Settings](./settings.md) — shows the current plan and links to plans.
- [Staff Admin](./staff-admin.md) — owns current administrative assignments.
- [Design System](../design-system.md) — owns public plan-card presentation.

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

## Technical contract

Subscription routes, schemas, models, and services provide current plan and
administrative assignment behavior. Billing provider integration is not present.

## Acceptance criteria

- [ ] Public plans clearly indicate unavailable paid actions.
- [ ] Current plan is server-resolved and displayed consistently.
- [ ] Paid status cannot be fabricated by the client.
- [ ] Chat entitlement checks remain server-authoritative.

## Known limitations

Payments, checkout, recurring billing, cancellation, and customer self-service
are not implemented.
