# Friink testing guide

This document is the shared testing and verification guide for Friink. Unit
documents define feature-specific acceptance criteria; this document defines
the common evidence required to consider a change tested and ready for
release.

**Status:** Active  
**Last edited:** 2026-09-13T00:05:14Z  
**Related:** [`template.md`](template.md), [`rules.md`](rules.md), and the
relevant documents in [`units/`](units/)

## Testing principles

- Test the behavior described by the affected unit document and active rules.
- Prefer evidence from the real implementation over assumptions from plans or
  historical documents.
- Test successful, invalid, restricted, empty, loading, failure, retry,
  duplicate, and concurrent paths when they apply.
- Verify privacy, authorization, account isolation, and security-sensitive
  behavior explicitly.
- Preserve user-entered state during recoverable failures where the product
  contract requires it.
- Record unresolved or deferred verification rather than claiming it passed.

## Verification discipline

- Commit before switching agents or handing off work. Do not run a full build
  or test suite automatically as a matter of course — verification is done
  manually. Only run a targeted check (for example, a single affected test or
  a type-check on changed files) if the task specifically requires it or you
  are uncertain a change compiles.

- New or changed API endpoints must be verified with a real request/response
  check before the task is considered complete — confirm the endpoint returns
  the expected status and response shape, not just that the code compiles or
  imports cleanly. This is required regardless of confidence level; "the code
  looks correct" is not sufficient evidence for an endpoint. This is a
  targeted check (one real call), not a full test suite run, and does not
  conflict with the manual-verification-by-default rule above.

## Test levels

### API and service tests

API behavior is tested with pytest and pytest-asyncio. Tests live under
[`api/tests/`](../api/tests/) and should cover validation, authorization,
state transitions, persistence, idempotency, error responses, and isolation
between users or accounts.

New or changed API endpoints require a real request/response verification in
addition to automated tests. Confirm the actual status code and response shape.

### Web verification

The current automated web checks are the Next.js production build and
TypeScript checks. Run the targeted check relevant to the change; do not run a
full build or suite automatically unless the task requires it or compilation
and behavior are uncertain.

The web client uses the repository's current Next.js and TypeScript scripts in
[`web/package.json`](../web/package.json). On the Windows development machine,
the local build or dev server may require Next's `--webpack` fallback because
the native SWC binding is invalid. Vercel should use its normal native build
environment.

### Browser and manual acceptance

Use the affected unit document's UX flows and acceptance criteria to verify:

- Entry points, navigation, addressable URLs, and browser back behavior.
- Loading, empty, success, error, disabled, restricted, and retry states.
- Keyboard access, visible focus, accessible names, dialogs, and dismissal.
- Light, dark, and system themes where the surface supports them.
- Responsive behavior at desktop, tablet, and mobile widths where relevant.
- Privacy and visibility rules using more than one appropriate account.
- Refresh, expiry, duplicate activation, and recovery behavior.

### Deployment and environment verification

Before acceptance testing, apply and verify the current Alembic migration head
for the target environment. The current repository migration head is
`20260911_0046`.

Use isolated development data for local testing. Never use production
credentials or a production database for local or destructive rehearsals.
Staging is the environment for deployed acceptance testing; production rollout
is a separate release gate.

Verify deployment configuration when it is part of the change, including API
origins, required environment variables, database connectivity, object
storage behavior, and any feature flags. Do not treat a local pass as proof of
deployed configuration.

## Acceptance and traceability

Each unit document should give rules and acceptance criteria stable IDs, such
as `UNIT-R-001` and `UNIT-AC-001`. For Full and Standard units, connect those
IDs to tests or manual checks in the document's traceability matrix.

A criterion is complete only when its expected result has evidence. A test
that merely renders a page or returns a successful response is insufficient if
the criterion also requires authorization, persistence, notifications,
privacy, or recovery behavior.

## Release gates

Before release, confirm the applicable gates:

- Affected automated tests pass.
- The web build and TypeScript checks pass when web code changed.
- Changed endpoints have a real request/response check.
- Database migrations are applied and verified in the target environment.
- Acceptance criteria and relevant manual flows pass.
- Security, privacy, account isolation, and permission behavior are verified.
- Error, retry, empty, loading, and disabled states are covered where
  applicable.
- No known implementation-versus-rule conflict is silently unresolved.
- Deployment-specific configuration and integrations are verified when
  applicable.
- Unit documentation, related links, and the documentation viewer are current.

## Deferred verification

Deferred checks remain visible until they are completed, explicitly retired,
or superseded. Historical deferred scenarios are retained in
[`archives/tests.md`](archives/tests.md). Do not delete a deferred scenario or
turn it into a passing result without evidence.

## Test record

Record test evidence in the affected unit document when it changes the current
implementation status. Include the date, environment, scope, result, and any
follow-up question or limitation. Project-wide task history belongs in
[`CHANGELOG.md`](../CHANGELOG.md) and [`AGENTLOG.md`](../AGENTLOG.md).
