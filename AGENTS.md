# Agent instructions

This file contains the operating guidance for AI agents working in the Friink
repository.

## Before starting work

- Read `CHANGELOG.md` and the latest entries in `AGENTLOG.md` to understand
  recent work and touched scope.
- Read `README.md` once for the repository overview, stack, setup, and
  deployment guidance.
- Read `docs/rules.md` for the current implementation-backed product and
  business rules. The archived [`RULES.md`](docs/archives/RULES.md) is a
  historical reference only.
- For documentation work, read [`docs/AGENTS.md`](docs/AGENTS.md) first, then
  read `docs/README.md`, `docs/units/template.md`, and the relevant unit
  documents before changing documentation.
- For visual, layout, or styling work, read `packages/design/design.md` and
  follow the shared design contracts.

## Product and code boundaries

- Do not change authentication, session, account-access, or other
  security-sensitive behavior without explicit human approval.
- Keep reusable behavior and layout fixes at the shared component or
  documented-contract level. Do not use inline styles, route-only patches, or
  page-specific quick fixes for global UI behavior.
- Web app styling belongs in `web/app/globals.css` and the shared tokens
  generated from `web/theme.config.ts`. Components must use semantic classes;
  runtime-only geometry may update documented CSS custom properties through
  refs, but JSX `style` props are not permitted. This applies to `web/`; the
  public site remains outside this cleanup scope.

## Documentation rules

- Every completed task must be logged in both `CHANGELOG.md` and `AGENTLOG.md`,
  including documentation-only work.
- Use UTC ISO 8601 timestamps with seconds and a `Z` suffix for new entries:
  `YYYY-MM-DDTHH:mm:ssZ`. Preserve older date-only entries when the time is
  unknown.
- Keep `docs/rules.md` limited to implemented active behavior and a history of
  superseded, deferred, or retired rules. Do not use it as a planning backlog.
- Update `docs/design-system.md` for product-level visual and interaction
  contracts. Update `packages/design/design.md` when a shared implementation
  contract changes.
- Keep unit documents linked to related units and update those links when
  ownership or behavior changes, so documentation does not drift into isolated
  copies.
- Keep [`docs/index.html`](docs/index.html) synchronized whenever documentation
  is added, renamed, moved, archived, or removed, especially unit documents;
  update its registry, sidebar, search, indexes, and links as needed.
- Preserve historical records. Do not delete old rules or migration notes; mark
  their status instead.

## Verification and handoff

- Do not run a full build or test suite automatically. Use a targeted check
  when the task requires it or when compilation or behavior is uncertain.
- Any new or changed API endpoint requires one real request/response
  verification of its status and response shape.
- Verify changed documentation links, syntax, and rendered output when
  practical.
- Use `development` for local implementation, `staging` for deployed
  acceptance testing, and `main` for production release.
- Commit before switching agents or handing off work.

## Documentation routing

- Read [`docs/README.md`](docs/README.md) for the documentation map and
  source-of-truth boundaries.
- Read [`docs/rules.md`](docs/rules.md) before changing product or business
  behavior.
- Read [`docs/stack.md`](docs/stack.md) for technologies, environments, and
  deployment configuration.
- Read [`docs/architecture.md`](docs/architecture.md) for repository structure
  and runtime boundaries.
- Read [`docs/testing.md`](docs/testing.md) for verification and release
  criteria.
- Read [`docs/design-system.md`](docs/design-system.md) and
  `packages/design/design.md` before visual or UI work.
- Read the relevant document in [`docs/units/`](docs/units/) before changing a
  product area.
- Treat [`docs/archives/`](docs/archives/) as historical reference only.
- Read [`docs/AGENTS.md`](docs/AGENTS.md) before changing documentation.
