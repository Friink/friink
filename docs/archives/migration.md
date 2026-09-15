# Unit Documentation Migration

This document defines how to migrate the archived and existing product
knowledge into the new unit documents. The goal is to create one reliable,
complete artifact per unit that can guide product decisions, implementation,
testing, and a future rebuild of Friink.

**Status:** Active  
**Last edited:** 2026-09-12  
**Scope:** `docs/units/`

## Core operating rule

Process exactly one unit document at a time. Do not batch-populate multiple
unit files or make assumptions in one unit based on an unfinished document in
another unit.

Each unit must be reconciled through three lenses:

1. **History** — archived documents reveal previous requirements, decisions,
   limitations, and unresolved questions.
2. **Current contract** — root `RULES.md` contains active product and business
   rules. `packages/design/design.md` is authoritative for shared visual and
   interaction contracts.
3. **Implementation** — the current web, API, database, integrations, and
   tests show what the product actually does.

Archived documents provide context but are not authoritative. Existing code is
evidence, not automatically the correct product behavior.

## Source precedence

When sources disagree, use this order as a starting point:

1. Explicit current product decision or user direction.
2. Active business, privacy, or security rule in `RULES.md`.
3. Current design contract in `packages/design/design.md` for visual behavior.
4. Verified current implementation and tests.
5. Archived documentation and historical notes.

This order is not permission to silently overwrite an important conflict. Any
uncertainty must be recorded as an open question or decision.

## Per-unit workflow

### 1. Establish the unit boundary

Before editing, confirm:

- the unit's canonical filename;
- what behavior it owns;
- what it explicitly does not own;
- related units that must be linked;
- the appropriate documentation tier.

Use the existing unit list and `README.md`, but revise a boundary if the
evidence shows that it is artificial or fragmented.

### 2. Gather historical material

Search `docs/archives/` for documents, sections, and references relevant to
the unit. Extract useful material into working notes, including:

- intended product behavior;
- user flows;
- business rules;
- data and state assumptions;
- technical constraints;
- acceptance checks;
- planned, deferred, or deprecated behavior.

Do not copy an archived document wholesale. Archived material may describe an
older product state or a decision that was later superseded.

### 3. Gather active rules and shared contracts

Read the applicable sections of:

- `RULES.md`;
- `README.md`;
- `CHANGELOG.md` and recent `AGENTLOG.md` entries;
- `packages/design/design.md`, when UI or interaction behavior is involved;
- other completed unit documents, when they are a dependency.

Record every active rule that the unit owns or depends on. Cross-unit rules
belong in `RULES.md` and should be linked rather than duplicated.

### 4. Audit the implementation

Inspect the relevant evidence across the whole product:

- web routes, screens, shared components, and client libraries;
- API routers, schemas, services, and authorization checks;
- database models, migrations, indexes, and constraints;
- external integrations and configuration;
- automated tests and available manual verification evidence.

Follow a behavior through its full path where possible:

```text
User action → frontend state → API request → server rules → persistence
→ response/event → visible result
```

Do not define a unit by file location alone. Code may be shared, legacy, or
organized differently from the product boundary.

### 5. Classify each behavior

For every meaningful rule or flow, classify the evidence as one of these:

| Classification | Meaning | Documentation action |
|---|---|---|
| Aligned | Rules, docs, and implementation agree. | Record as current behavior. |
| Implemented but undocumented | The product does this, but the contract is missing. | Document it and add verification. |
| Documented but not implemented | The intended behavior is absent. | Mark planned or create an implementation task. |
| Implementation conflict | Code contradicts an active rule or agreed product behavior. | Correct code if the rule is valid; otherwise record a decision to change the rule. |
| Unclear | Evidence does not establish the intended behavior. | Record an open question; do not invent an answer. |
| Deprecated | Behavior is intentionally retired. | Preserve the history and mark it deprecated. |

### 6. Apply the approval gate

Writing down what the implementation actually does does not require approval.
Proceed with documentation for behavior classified as Aligned, Implemented but
undocumented, Documented but not implemented, Unclear, or Deprecated according
to the classifications above.

When a genuine implementation-versus-rule conflict is found, do not modify
application code. Record the conflict in the unit document's Open Questions,
including:

- the active rule or documented product decision;
- the observed implementation and evidence;
- the precise point of contradiction;
- the impact and affected units; and
- a recommended resolution.

Flag the conflict in the migration handoff for review. Documentation may
continue for all other unaffected content in the same unit. Code or rule
changes happen only after the product owner approves the recommended
resolution in a separate change.

Do not change code or rules merely to make sources agree. If an implementation
appears unsafe or accidental but no active rule contradicts it, document the
behavior and record the concern as an Open Question rather than changing it
during migration.

### 7. Write the unit document

Populate the target file using `units/template.md`. Include enough detail to
rebuild and verify the unit:

- canonical ownership and scope;
- related-unit links, including inline dependency links;
- domain entities and state transitions;
- subunit UX and flows;
- business rules and edge cases;
- permissions, privacy, and security;
- data, API, frontend, backend, and integration contracts as applicable;
- acceptance criteria and test scenarios;
- implementation status, limitations, and open questions.

Use stable identifiers such as `UNIT-R-001` and `UNIT-AC-001`. Connect those
identifiers to tests or manual checks in the traceability matrix.

### 8. Verify the completed unit

Before considering the unit complete, check:

- [ ] The file has one clear canonical owner and boundary.
- [ ] Relevant archive material was reviewed, not blindly copied.
- [ ] Active rules were checked.
- [ ] Current implementation was audited across web/API/data/tests.
- [ ] Conflicts were classified and recorded; any implementation-versus-rule
      conflict was flagged for product-owner review.
- [ ] Related units are linked where dependencies matter.
- [ ] Main, alternate, error, permission, privacy, and empty states are covered.
- [ ] Acceptance criteria are testable.
- [ ] Every rule and acceptance criterion has verification evidence or a planned check.
- [ ] Status and known limitations are honest.
- [ ] No archived document is presented as current without reconciliation.

## Output discipline

One migration cycle produces one reconciled unit document. Supporting changes
are limited to what is required for that unit's integrity, such as correcting
an explicitly identified documentation inconsistency, updating a cross-unit
rule when the change is separately authorized, or adding required project-log
entries. Implementation-versus-rule conflicts are recorded and escalated, not
corrected during migration.

Do not populate neighboring unit documents speculatively. Record their needed
follow-up in the current document's related units or open questions instead.

## Migration notes and conflicts

Record every implementation-versus-rule conflict discovered during migration
here, even when the conflict is also mentioned in the affected unit's Open
Questions. This is the central review list for the end of the migration.

Do not remove a note when it is resolved. Update its status and resolution so
the migration record preserves what was found and how it was handled.

| ID | Unit | Date | Conflict | Evidence | Recommended resolution | Status |
|---|---|---|---|---|---|---|
| MIG-001 | account-access | 2026-09-12 | Active `RULES.md` said refresh tokens default to 14 days, while the API settings and example environment default to 30 days. | `RULES.md` — `JWT Sessions`; `api/app/config.py` — `refresh_token_expire_days`; `api/.env.example` — `REFRESH_TOKEN_EXPIRE_DAYS`; archived session progress | Keep the existing 30-day implementation and align the active documentation to it. | Documented |

Allowed statuses are `Open`, `Decision needed`, `Approved`, `Implemented`,
`Documented`, and `Rejected`.

## Completion standard

A unit is complete when a new developer or agent can understand what the unit
is, implement its behavior, test its important paths, identify its dependencies,
and distinguish current behavior from planned or deprecated behavior without
having to reconstruct the product from scattered history.

