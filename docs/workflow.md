# Friink work workflow (draft)

**Status:** Draft — not yet an adopted operating policy  
**Last edited:** 2026-09-22T00:08:28Z

This document proposes a shared workflow for planning, implementing, testing,
and releasing Friink work. It is a draft for discussion and should not
override the active repository instructions, testing guide, deployment guide,
or unit-specific acceptance criteria until formally adopted.

## Work type

Each work item should identify its type separately from its workflow status:

- Feature
- Defect
- Enhancement
- Maintenance
- Documentation

“Defect” and “Enhancement” are work types, not workflow statuses.

## Workflow statuses

1. **Proposed** — An idea or report that still needs clarification.
2. **To Do** — Defined, documented, prioritized, and ready to start.
3. **Doing** — Actively being implemented.
4. **Local Verification** — Implementation is complete and local tests,
   builds, API checks, and documentation checks are being run.
5. **Staging Acceptance** — Deployed to the production-parity staging
   environment and undergoing browser, API, and acceptance testing.
6. **Done** — Staging acceptance passed; the exact artifact is ready for
   production promotion.
7. **Closed** — The staging-verified artifact was promoted to production and
   basic production smoke checks passed.

## Side states

- **Blocked** — Work cannot proceed because of an external dependency,
  unresolved decision, or failed prerequisite.
- **Deferred** — Work is intentionally postponed by decision, with the reason
  recorded. Resume it by moving it back to **To Do**.
- **Rejected/Won’t Do** — The work was deliberately decided against.

Side states preserve the main workflow position and should include a short
reason and the next review condition where applicable.

## Definition of done

Work is **Done** only when it has been validated on a staging environment
identical to production in runtime and configuration behavior, while using
separate non-production data, credentials, and secrets. Local checks alone do
not establish Done status.

Work is **Closed** only after the exact staging-verified artifact is promoted
to production and basic smoke checks confirm routing, startup,
authentication, and critical availability. Production smoke checks do not
replace staging acceptance.

## Reopening work

A defect or enhancement discovered after Done or Closed returns the work to
**To Do** with the new evidence recorded. Preserve the prior completion and
release history; do not erase the earlier Done or Closed state.

## Proposed flow

```text
Proposed → To Do → Doing → Local Verification → Staging Acceptance → Done → Closed
                         ↘ Blocked
                         ↘ Deferred
```

This draft should be reviewed before being made the repository-wide active
workflow.
