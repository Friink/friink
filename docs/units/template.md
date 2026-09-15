<!--
TEMPLATE USAGE NOTES

Delete this comment block when creating a real unit document.

Use one of three documentation tiers. Choose the tier based on the unit's
actual complexity and risk, then upgrade it when the unit grows.

- FULL: security/authentication, money, real state machines, external
  integrations, or high blast radius. Use every section.
- STANDARD: implemented behavior with meaningful rules and workflows. Use
  every section except Performance and reliability, Observability, and
  Deployment and migration unless they are relevant.
- MINIMAL: simple, low-risk, or not-yet-built behavior. Use the header,
  product definition, relevant domain model, related units, subunit purpose,
  UX, business rules, limitations, acceptance criteria, and a lightweight
  verification checklist.

The tier controls documentation depth, not product importance. A minimal
document may still describe a globally important product surface.
-->

# [Unit name]

[One- or two-sentence summary of what this unit does and why it exists.]

**Status:** Active | Planned | Partial | Deprecated  
**Tier:** Full | Standard | Minimal  
**Last edited:** YYYY-MM-DD  
**Platforms:** Web | API | Mobile | All  
**Canonical sources:** [Relevant rules, design, code, or external systems]

---

## Canonical ownership

This document is the source of truth for [the behavior this unit owns].
It does not define [related behavior], which belongs to [related unit].

## Related units

If this unit depends on another unit's rules, data, or state, list and link it
here. Also link it inline at the exact point where the dependency matters.
Use relative links from `docs/units/`, for example `../rules.md` and
`./posts.md`.

- [Unit name](./unit-name.md) — relationship and contract that must be preserved.

---

## 1. Product definition

### Purpose

Why this unit exists and what problem it solves.

### Goals

What this unit must accomplish.

### Scope

The complete boundary of this unit.

### Non-goals

What this unit intentionally does not cover.

## 2. Users, actors, and permissions

### Actors

Users, staff, services, or external systems involved.

### Permissions

What each actor can and cannot do.

### Privacy and security

Visibility rules, sensitive data, abuse prevention, authentication
requirements, and security constraints.

## 3. Domain model

### Entities

Important product objects and the data they represent.

### Relationships

How the entities relate to each other and to entities owned by other units.

### States and transitions

Possible states, allowed transitions, transition triggers, and invalid
transitions.

### Terminology

Definitions of product-specific words and distinctions.

## 4. Subunits

Repeat the following structure for every meaningful subunit. A subunit may be
a feature, workflow, stateful capability, or other coherent responsibility.

### 4.1 [Subunit name]

#### Purpose

What this subunit does.

#### Scope

What behavior belongs here and what does not.

#### UX and surfaces

Screens, entry points, controls, displayed information, navigation, and
accessibility expectations.

#### User flows

##### [Flow name]

**Preconditions:**

- [What must be true before the flow begins.]

**User steps:**

1. [User action.]
2. [System response or next user action.]
3. [Completion action.]

**Expected result:**

- [What the user sees.]
- [What state changes.]
- [What confirmation or navigation occurs.]

**Alternate paths:**

- [Valid variation of the flow.]

**Error and recovery behavior:**

- [Failure, retry, cancellation, timeout, or unavailable-data behavior.]

#### Business rules

Use stable identifiers for rules, for example `CHAT-R-001`. Rules that apply
across multiple units belong in [`rules.md`](../rules.md); reference them here
instead of duplicating their text.

- **[UNIT-R-001] — [Rule name]**
  - [The rule and its edge cases.]

#### State behavior

Describe loading, empty, success, error, disabled, restricted, expired,
offline, and retry states where applicable.

#### Data requirements

Data created, read, changed, deleted, retained, hidden, or derived.

#### API and service contract

Endpoints or service operations, inputs, outputs, validation,
authorization, pagination, idempotency, concurrency, and error responses.

#### Frontend contract

Client responsibilities, local state, caching, polling, optimistic updates,
navigation, accessibility, and browser behavior.

#### Backend contract

Server responsibilities, transactions, consistency, jobs, events,
notifications, and failure handling.

#### External integrations

Email, storage, payments, analytics, push notifications, or other systems.

#### Acceptance criteria

Use stable identifiers, for example `CHAT-AC-001`, so tests can trace back to
the product contract.

- [ ] **[UNIT-AC-001]** [Testable condition.]
- [ ] **[UNIT-AC-002]** [Testable condition.]

#### Test scenarios

Refer to [`testing.md`](../testing.md) for shared testing standards.

*(Full/Standard only.)*

- [ ] Happy path
- [ ] Validation failure
- [ ] Permission or privacy failure
- [ ] Empty state
- [ ] Error and retry behavior
- [ ] Duplicate or concurrent request behavior
- [ ] Regression coverage

#### Verification

*(Required for every tier. Minimal units use this checklist instead of the
full Test scenarios section.)*

- [ ] Acceptance criteria checked manually or by an existing test.
- [ ] Relevant error and permission states checked.
- [ ] No known contradiction with related units.

#### Known limitations

Intentional current limitations, deferred behavior, or incomplete areas.

#### Open questions

Decisions that still need to be made.

## 5. Cross-subunit behavior

Rules and workflows involving two or more subunits within this unit.

## 6. Cross-unit dependencies

What this unit consumes from other units, what it provides to them, and what
shared contracts must remain compatible.

## 7. Technical architecture

### Components and ownership

Relevant web components, API routers, services, models, jobs, and shared
infrastructure. Describe ownership rather than copying the codebase.

### Storage and persistence

Tables, fields, indexes, constraints, object storage, retention, and deletion
behavior.

### Events and notifications

Events emitted, consumers, delivery guarantees, ordering, and duplicate
handling.

### Performance and reliability

Latency expectations, limits, caching, polling, rate limits, retries, and
failure behavior.

### Observability

Logs, metrics, audit events, alerts, and diagnostic information. Never document
secrets, tokens, or other sensitive values.

## 8. Testing and verification

*(Full/Standard only. Standard units include the traceability matrix and test
matrix; Minimal units use the subunit Verification checklist.)*

### Traceability matrix

| ID | Requirement or rule | Test or verification | Status |
|---|---|---|---|
| UNIT-R-001 | [Requirement] | [Test name or manual check] | Planned |
| UNIT-AC-001 | [Acceptance criterion] | [Test name or manual check] | Planned |

### Test matrix

| Area | Scenario | Expected result | Verification |
|---|---|---|---|
| UX | [Scenario] | [Result] | Browser |
| API | [Scenario] | [Result] | Request/response |
| Data | [Scenario] | [Result] | Database |
| Security | [Scenario] | [Result] | Automated/manual |

### Release gates

Checks that must pass before this unit can be released.

### Manual verification

Checks that cannot be proven by automated tests.

## 9. Deployment and migration

Environment variables, migrations, backfills, rollout order, compatibility,
rollback, and production verification.

## 10. Current implementation status

What is implemented, partial, planned, deprecated, or known to be broken.

## 11. Rebuild checklist

- [ ] Product behavior implemented
- [ ] Business rules enforced
- [ ] UX surfaces and states implemented
- [ ] API and service contracts implemented, if applicable
- [ ] Data model and persistence implemented, if applicable
- [ ] Permissions and privacy verified, if applicable
- [ ] Integrations configured, if applicable
- [ ] Automated tests passing
- [ ] Manual verification complete
- [ ] Deployment and migration complete, if applicable

## Changelog

The repository [`CHANGELOG.md`](../../CHANGELOG.md) is authoritative for
project-wide history. This section records decisions and behavior changes
specific to this unit.

- YYYY-MM-DD — [What changed] — [commit hash, if available]
