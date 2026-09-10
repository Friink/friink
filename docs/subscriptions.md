# Friink Subscriptions

Status: Planned admin-only subscription foundation; billing and customer
checkout are not implemented.

Last updated: 2026-09-10

This document defines the first subscription phase for Friink. It records the
product requirements and technical boundary for assigning plans manually from
the superadmin control panel while leaving payment integration for a later
phase.

## 1. Product objective

Friink will eventually offer monthly platform subscriptions:

- **Friink Free** — the default plan and permanently usable core account;
- **Friink Pro** — paid professional and communication features;
- **Friink Pro+** — Pro plus analytics, feed boost, and reduced advertising.

The initial implementation does not charge users. It allows an authorized
superadmin to assign a plan to a user for a fixed number of days or
indefinitely. This lets Friink bootstrap professional users, test entitlements,
and validate the user experience before a payment provider is available.

## 2. Plan and entitlement boundary

Plans are named bundles of predefined platform entitlements. Plan names and
prices may change, but entitlement keys are controlled by the application.
Administrative plan configuration must not be allowed to invent arbitrary
permission logic.

Initial entitlement keys are:

```text
message_requests
profile_views
longer_posts
professional_registration
professional_directory
analytics
profile_boost
reduced_ads
```

The intended product mapping is:

| Plan | Entitlements |
| --- | --- |
| Free | Core Friink participation, including posts, replies, quotes, follows, saves, likes, and mutual-follower chat |
| Pro | Free plus message requests, profile views, longer posts, professional registration requests, and professional directory access after approval |
| Pro+ | Pro plus profile/post analytics, profile boost, and reduced advertising |

Core participation must not depend on a paid plan. An entitlement check should
be used at the feature boundary rather than scattered checks for a plan name or
boolean such as `is_pro`.

## 3. Admin-only MVP requirements

The superadmin control panel must be able to:

1. Find a user without exposing unnecessary internal identifiers.
2. View the user's current effective plan and grant history.
3. Assign Free, Pro, or Pro+.
4. Set a duration in days, or leave the expiry empty for indefinite access.
5. Supply a reason for the assignment.
6. Revoke an active assignment.
7. See whether access is active, expired, or revoked.

The assignment must take effect immediately after a successful API response. The
user should be able to see the effective plan and expiry date in subscription
settings, but there is no customer checkout, payment form, invoice, or billing
portal in this phase.

Only the superadmin permission may grant or revoke plans. Ordinary users,
public endpoints, client-side state, and plan display pages must never grant
paid entitlements.

## 4. Assignment lifecycle

An admin assignment has these states:

```text
active → expired
active → revoked
```

An indefinite assignment has a null expiry date and remains active until an
authorized superadmin revokes it. A fixed assignment expires when the server's
UTC clock reaches its `expires_at` value. The client must not decide whether a
plan is expired.

When a paid assignment is expired or revoked, the user's effective plan falls
back to Free. Existing content is not deleted:

- existing longer posts remain visible;
- stored analytics remain retained but are no longer accessible;
- new paid-only actions are rejected;
- professional directory visibility follows the professional-status policy;
- login sessions remain valid.

An assignment should replace the user's current effective plan rather than
stacking multiple plans. Historical assignments remain available for audit.

## 5. Recommended data model

Plans should have stable internal identity and stable application references:

```text
Plan
- id: UUID
- code: immutable key, for example `friink_pro`
- name: editable display name
- description: editable display text
- active: whether the plan can be newly assigned
```

Entitlements should be represented by application-owned keys and a plan-to-
entitlement relationship:

```text
PlanEntitlement
- plan_id
- entitlement_key
```

Manual access should be represented separately from the future billing
provider:

```text
SubscriptionAssignment
- id: UUID
- user_id
- plan_id
- starts_at
- expires_at: nullable for indefinite access
- status: active, expired, or revoked
- granted_by_user_id
- reason
- created_at
- revoked_at: nullable
- revoked_by_user_id: nullable
```

The model must keep the assignment source distinguishable from future paid
subscriptions. A later billing integration can add a provider customer ID,
provider subscription ID, and provider price ID without making those fields
mandatory for manual assignments.

## 6. Effective access resolution

Feature access should be resolved by a small server-side capability service:

```text
effective_plan(user) → Free | Pro | Pro+
has_entitlement(user, key) → true | false
```

The resolver must:

- use server time;
- ignore expired and revoked assignments;
- return Free when no active assignment exists;
- treat the user as having at most one active assignment at any time;
- return that single active assignment's plan, or Free if no valid assignment
  exists;
- perform no plan comparison, ranking, or stacking in this phase;
- remain independent from login sessions and refresh-token state.

This phase uses lazy, read-time expiry enforcement only. `effective_plan()` and
`has_entitlement()` compare `expires_at` with server time on every call. No
scheduled or background job is required or built in this phase. The stored
`status` value on `SubscriptionAssignment` may lag behind actual expiry—for
example, it may remain `active` after `expires_at` has passed—until an optional
future reconciliation step updates it. Access decisions never depend on the
stored status being current.

The API remains authoritative. Frontend checks may hide or explain unavailable
actions, but every paid-only endpoint must enforce the entitlement again on the
server.

## 7. Professional registration

`professional_registration` means that a Pro user may submit an application.
It does not mean that payment or plan status automatically grants professional
verification.

The registration workflow remains separate:

```text
Pro entitlement → application → review/verification → approved professional
```

Professional approval, directory visibility, and subscription access are
different states. A plan expiry may affect directory eligibility according to
the professional policy, but it must not erase the verification history.

Complimentary Pro assignments are the bootstrap mechanism for invited or
founding professionals. They follow the same application and review flow as a
paid Pro user.

## 8. Security and audit requirements

- Require the normal authenticated staff authorization boundary.
- Do not expose internal plan or user UUIDs in ordinary user-facing screens.
- Validate that the selected plan is assignable and active.
- Reject negative, malformed, or unreasonably large durations.
- Compute expiry on the server; do not trust a client-supplied timestamp.
- Require a reason for every grant and revocation.
- Write an immutable audit event for grant, replacement, expiry processing, and
  revocation.
- Protect against duplicate submissions and conflicting concurrent admin edits.
- Never let a client-side plan label unlock a paid API action.

## 9. API and UI expectations

The eventual API should expose separate read and mutation boundaries:

- authenticated user: read effective plan and permitted user-facing benefits;
- superadmin: list plans, inspect assignments, grant plans, and revoke plans;
- no scheduled or background expiry job is required or built in this phase;
  an optional future reconciliation step may mark fixed assignments expired.

The admin UI should clearly distinguish:

- Free baseline;
- complimentary/manual access;
- future paid access;
- fixed expiry versus indefinite access;
- active, expired, and revoked history.

Any admin UI or assignment list/detail view that displays assignment status must
compute effective status using the same server-time expiry check as
`effective_plan()` and `has_entitlement()`. It must not read the raw stored
`status` column directly.

The public `/subscriptions` page and settings subscription page remain
informational until billing exists. They must not imply that a user can purchase
or self-activate Pro during this phase.

## 10. Testing requirements

The admin-only phase should test at least:

- Free fallback when no assignment exists;
- immediate Pro and Pro+ activation;
- fixed-day expiry;
- indefinite access;
- manual revocation;
- replacing Pro with Pro+ and vice versa;
- unauthorized grant/revoke attempts;
- expired access at the API boundary;
- frontend behavior after plan refresh;
- professional application access for Pro and denial for Free;
- preservation of sessions and existing content after expiry;
- audit records for every administrative mutation.

Tests should use deterministic server time or a controllable clock. They should
not require a real payment method or external billing account.

## 11. Limitations of this phase

This phase does not provide:

- customer checkout;
- recurring charges or invoices;
- payment-method storage;
- payment failure retries or grace periods;
- refunds, chargebacks, taxes, or regional pricing;
- provider webhooks;
- customer self-service cancellation or upgrade;
- creator-defined subscriptions;
- mobile app-store billing;
- automatic professional verification.

Manual assignments are an operational bootstrap tool, not evidence that billing
is production-ready. They should be clearly marked as complimentary access so
future reporting does not mistake them for revenue.

## 12. Future billing boundary

When Friink is ready to accept payments, a billing adapter should activate the
same plans and entitlements through provider events. The application should
consume normalized events such as:

```text
subscription_activated
subscription_payment_failed
subscription_canceled
subscription_expired
```

Provider-specific product IDs, price IDs, checkout details, and webhook
verification belong inside the billing adapter. The rest of Friink should ask
only whether the user has an entitlement.

This keeps the admin-only foundation compatible with Stripe, a merchant of
record, a regional gateway, or mobile app-store billing later.

## 13. Related contracts

- `RULES.md` — current public-plan and subscription-settings behavior;
- `docs/chat-behavior.md` — the paid boundary for non-mutual chat requests;
- `docs/account-lifecycle.md` — account deactivation/deletion interaction with
  subscription state;
- `docs/auth-and-session.md` — session state must remain separate from
  subscription entitlements.
