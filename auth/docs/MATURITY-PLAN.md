# Friink Auth App Maturity Plan

**Status:** Planned  
**Last edited:** 2026-10-19T02:15:00Z
**Owner:** `auth/`  
**Purpose:** Prepare the standalone Auth app to become Friink Web App's future
identity and account-lifecycle authority.

## 1. Scope and boundary

This plan covers work inside `auth/` only. The Friink Web App, the legacy
FastAPI authentication path, product API behavior, and their databases remain
unchanged until Auth has passed its readiness gate and a separate integration
project is approved.

Auth must become internally complete before integration. It may define future
integration contracts, but it must not require the Web App or API to consume
them during this plan.

Auth owns:

- identity records and credentials;
- email verification, password recovery, and lifecycle OTPs;
- Auth sessions, device sessions, account switching, and revocation;
- account lifecycle state and identity-level deletion;
- Auth-owned audit records and future lifecycle-event preparation.

Auth does not yet own:

- Web App product authorization;
- posts, media, follows, notifications, conversations, or other product data;
- product-side content deletion;
- billing-provider actions;
- the current Web App/API login or session behavior.

The active product rules remain in [`../../docs/rules.md`](../../docs/rules.md).
The lifecycle contract is summarized in
[`../../docs/units/account-lifecycle.md`](../../docs/units/account-lifecycle.md).
Those documents describe the target product behavior; this document describes
the Auth-only preparation needed before integration.

## 2. Readiness objective

Auth is ready to begin a separate Web App integration project when it can
reliably:

1. create and manage verified identities;
2. authenticate and reauthenticate users without leaking account existence;
3. manage multiple sessions and devices;
4. deactivate, schedule deletion, cancel deletion, reactivate, and permanently
   delete Auth-owned identity data according to the lifecycle contract;
5. invalidate sessions immediately when lifecycle state changes;
6. provide stable, documented HTTP and redirect contracts;
7. pass targeted security, API, browser, migration, and deployment checks in a
   production-parity staging environment.

Readiness does not mean that Web App integration has started. It means Auth is
safe to integrate later.

## 3. Phased plan

### Phase 0 — Freeze the Auth contract

**Goal:** Turn the current pilot behavior and product lifecycle rules into an
Auth-owned implementation contract.

Work:

- record supported Auth routes, request/response shapes, error codes, redirect
  rules, cookie behavior, and session semantics;
- define the lifecycle state machine:
  `active`, `deactivated`, `pending_deletion`, and `deleted`;
- define idempotency behavior for repeated lifecycle requests;
- define what is Auth-owned versus deferred to the future product integration;
- define the future lifecycle event/outbox shape without connecting a consumer.

Exit criteria:

- the state-transition table and API contract are reviewed;
- no planned Auth behavior depends on a Web App or API change;
- unresolved billing and product-content decisions are explicitly marked
  deferred.

### Phase 1 — Auth identity and lifecycle persistence

**Goal:** Give the Better Auth database durable lifecycle state.

Add and migrate fields equivalent to:

- `lifecycleStatus`;
- `deactivatedAt`;
- `deletionRequestedAt`;
- `deletionDeadline`;
- `deletionRequestId`;
- `reactivationCooldownUntil`;
- a security/session invalidation version where required.

Add the necessary indexes and constraints. Preserve reserved email and
username values while an account is deactivated or pending deletion. Keep
restricted identity history and tombstone data separate from public identity
presentation.

Exit criteria:

- migrations are repeatable and reversible where practical;
- all four lifecycle states can be persisted;
- duplicate requests cannot create conflicting deletion requests;
- Auth-owned data retention is documented.

### Phase 2 — Auth lifecycle service and endpoints

**Goal:** Implement lifecycle transitions inside Auth.

Add Auth-owned operations for:

- deactivation with current-password confirmation;
- deletion start with current-password confirmation;
- deletion confirmation with fresh email OTP;
- reactivation with valid credentials and fresh OTP;
- pending-deletion cancellation;
- Auth identity finalization after the grace period.

The service layer must own validation, transactions, state transitions, session
revocation, cooldown handling, and idempotency. The endpoint layer must not
contain independent lifecycle rules.

The target behavior is:

- deactivation revokes all Auth sessions and remembered device sessions;
- deletion moves the account to `pending_deletion` and revokes access;
- deletion remains cancellable for 32 days, including the final hour;
- reactivation creates one new session and does not restore old sessions;
- a successful reactivation blocks deactivation for 480 seconds;
- permanent deletion anonymizes or tombstones Auth identity data as required;
- unknown identifiers and wrong passwords remain lifecycle-state agnostic.

Exit criteria:

- every endpoint has a real request/response verification;
- current-password, OTP, expiry, attempt, rate-limit, and origin protections
  are covered;
- repeated and concurrent requests produce safe results;
- no endpoint returns secrets, tokens, internal identifiers, or lifecycle data
  to unauthorized callers.

### Phase 3 — Session and authentication enforcement

**Goal:** Make lifecycle state authoritative at every Auth access boundary.

Check lifecycle state during:

- password login;
- OTP verification;
- `get-session` and session refresh;
- multi-session listing and switching;
- protected Auth pages and APIs;
- redirect handoff to future consuming applications.

Deactivated and pending-deletion accounts must not receive ordinary sessions.
Their credentials may enter only the narrowly scoped reactivation or deletion
cancellation flow. Existing sessions must be rejected after a lifecycle
transition, including sessions on other devices.

Exit criteria:

- all active sessions stop working after deactivation or pending deletion;
- reactivation creates exactly one fresh session;
- old tokens, device sessions, and remembered sessions remain invalid;
- account switching cannot select a lifecycle-inactive account as active.

### Phase 4 — Auth account UI and recovery behavior

**Goal:** Make lifecycle actions usable without relying on the Web App.

Add the controls to the Auth account area, including:

- Deactivate account;
- Delete account;
- Confirm deletion with OTP;
- Cancel scheduled deletion;
- Reactivate account;
- deadline and cooldown messaging;
- explicit subscription and data-retention consequences.

Each flow needs loading, disabled, success, validation, retry, cancellation,
expired-code, network-error, and keyboard/focus states. Lifecycle changes must
notify other Auth tabs and update the account switcher without exposing private
credentials or using browser-readable token storage.

Exit criteria:

- browser flows work at desktop and mobile widths;
- light, dark, and system themes remain usable;
- multi-tab and multi-session behavior is manually verified;
- failed actions preserve a usable current state.

### Phase 5 — Auth-owned deletion scheduling and operations

**Goal:** Complete the irreversible Auth-side portion safely.

Implement a scheduled worker or deployment-compatible job that finds expired
`pending_deletion` records using locking and processes them idempotently.

It may delete or anonymize Auth-owned identity, session, verification, and
recovery data. It must retain the required restricted tombstone, identity
history, security, and audit information. Product content and conversations
remain outside this phase and are explicitly deferred to the later integration
project.

Add operational visibility for job success, retry, failure, and accounts that
remain pending after a failed attempt. Do not expose sensitive values in logs.

Exit criteria:

- a deletion can be cancelled before the deadline;
- an expired deletion is processed once despite retries or duplicate runs;
- partial failures are retryable and auditable;
- a staging rehearsal proves the 32-day boundary and final-hour cancellation.

### Phase 6 — Future integration contract, without integration

**Goal:** Make later Web App integration predictable while keeping it out of
scope now.

Document stable future contracts for:

- Auth user ID ownership;
- session validation/introspection;
- lifecycle state visibility;
- lifecycle events such as `account.deactivated`,
  `account.pending_deletion`, `account.reactivated`, and `account.deleted`;
- product-side consequences and retry semantics.

If an Auth outbox is implemented, it must remain Auth-owned and testable in
isolation. No Web App or API consumer should be required for Auth deployment,
testing, or normal operation.

Exit criteria:

- a future integration team can consume the contract without reverse
  engineering Auth behavior;
- event delivery and duplicate handling are specified;
- the current Web App/API behavior remains unchanged.

### Phase 7 — Auth readiness and handoff

**Goal:** Decide whether Auth is mature enough to start integration planning.

Run targeted verification in isolated development and production-parity
staging:

- signup, email verification, login, OTP, password recovery, and email change;
- account switching and device-session revocation;
- deactivation and recovery;
- deletion, cancellation, and finalization;
- inactive-account login privacy;
- concurrent and repeated requests;
- migration and rollback rehearsal;
- deployment configuration, email delivery, cookies, redirects, and CORS;
- accessibility and responsive browser behavior.

The readiness decision must record passed checks, deferred checks, known
limitations, and the explicit approval needed to begin Web App integration.

### Phase 8 — Integration-pilot cleanup and hardening

**Goal:** Remove pilot scaffolding and make Better Auth the durable identity
and session boundary for the Web App/API path.

The first pilot has proven the critical browser path: Better Auth authenticates
the browser, the API introspects the cross-subdomain session, and the API
resolves the Better Auth UUID to a product profile. The pilot is not complete
until this cleanup is finished.

Work:

- remove or disable legacy Web/API login, refresh-token, JWT, account-slot, and
  session-restoration paths that are no longer authoritative;
- remove temporary compatibility, fallback, bridge, and debugging code after
  replacement contracts are stable;
- make Better Auth profile provisioning reliable and idempotent for every new
  account, including safe parent/history write ordering and retryable missing-
  profile handling;
- replace generic authentication failures with user-safe handling for missing
  profiles, expired sessions, deactivated accounts, and pending deletion;
- reconcile production, staging, and development variables, cookie domains,
  CORS origins, internal tokens, and service URLs;
- add automated and real-request checks for session validation, provisioning,
  logout, expiry, deactivation, deletion, and recovery;
- align architecture, deployment, account-access, and lifecycle documentation;
- deploy through staging, run clean-browser acceptance checks, then promote the
  exact verified artifacts to production.

Exit criteria:

- no normal Web App request depends on the retired FastAPI authentication path;
- a new Auth account reaches the Web App without manual database repair;
- an existing Auth session restores the Web App shell after refresh;
- logout, expiry, lifecycle transitions, and provisioning have verified status
  codes and response shapes;
- no temporary secrets, diagnostics, migration-only branches, or dead auth code
  remain in the deployed path;
- staging acceptance passes with separate credentials and database data before
  production promotion.

## 4. Explicitly deferred until integration

These are not part of Auth maturity work:

- changing Web App login, session restoration, or account switching;
- replacing the FastAPI authentication path;
- changing Web App or API database ownership references;
- hiding product profiles or search results;
- disabling product notifications or messaging;
- product post/media deletion;
- chat anonymization or read-only enforcement;
- billing-provider cancellation or subscription behavior;
- production Web App cutover.

Auth should prepare contracts for these behaviors, but the behaviors belong to
the later integration project.

## 5. Readiness checklist

- [ ] Auth lifecycle schema and migrations are complete.
- [ ] Deactivation, deletion, cancellation, and reactivation are implemented.
- [ ] Password and OTP requirements are enforced server-side.
- [ ] All Auth sessions and devices are invalidated on lifecycle changes.
- [ ] Inactive accounts cannot create ordinary sessions.
- [ ] Auth UI exposes lifecycle actions with complete recovery states.
- [ ] Auth-owned deletion scheduling is retryable and observable.
- [ ] Auth API contracts and future event contracts are documented.
- [ ] Targeted API, browser, security, and migration checks pass.
- [ ] Staging verification is complete with separate data and credentials.
- [ ] Deferred Web App/API integration work is clearly separated.
- [ ] Human approval is recorded before starting integration.

## 6. Current status

The Auth pilot currently provides Better Auth identity, email/password and OTP
flows, onboarding, multi-session account switching, logout, email change, and
session management. The live pilot also proves cross-subdomain session
introspection and API profile resolution for a provisioned user. Cleanup and
hardening remain, followed by lifecycle persistence, lifecycle endpoints,
reactivation, deletion scheduling, and complete lifecycle UI in the standalone
Auth app.

The legacy FastAPI implementation contains product lifecycle behavior, but it
remains outside this Auth-only plan and must not be treated as an Auth
dependency.

## Changelog

- 2026-10-19T00:08:15Z — Created the Auth-only maturity plan, separating
  standalone lifecycle readiness from future Web App/API integration.
- 2026-10-19T02:15:00Z — Added the integration-pilot cleanup and hardening
  phase covering legacy auth removal, reliable provisioning, recovery states,
  environment reconciliation, verification, documentation, and staging gates.
- 2026-10-19T02:40:00Z — Simplified the authenticated Auth shell around the
  username profile, upper-right account switcher, slim navigation rail,
  security overview, sessions page, settings overview, and rail logout.
