# Documentation agent instructions

These instructions apply to all work inside `docs/`. They supplement the
repository-level [`AGENTS.md`](../AGENTS.md).

## Before changing documentation

Read the current guidance and relevant evidence before editing:

1. [`README.md`](./README.md) for the documentation map.
2. [`rules.md`](./rules.md) for the current implementation-backed rules.
3. [`template.md`](./units/template.md) for the required unit-document structure.
4. [`testing.md`](./testing.md) for shared testing and release-gate criteria.
5. [`deployment.md`](./deployment.md) for environments, migration gates, and
   release flow.
6. The affected unit documents and their related-unit links.
7. [`design-system.md`](./design-system.md) for shared product-level visual
   and interaction contracts when the change concerns UX or UI.
8. [`stack.md`](./stack.md) and [`architecture.md`](./architecture.md) when
   the change concerns technology, runtime boundaries, or implementation
   structure.

Inspect the current implementation and the relevant historical documents when
the existing documentation does not establish the answer.

## Source-of-truth boundaries

- `docs/rules.md` is the complete source of truth for active, implemented
  product and business rules.
- `docs/rules.md` may also contain the history of superseded, deferred, or
  retired rules, but it is not a planning backlog.
- A unit document in `docs/units/` owns the product area named by that file:
  its purpose, boundary, UX, flows, domain model, technical behavior,
  acceptance criteria, testing, limitations, and rebuild guidance.
- `docs/design-system.md` owns shared product-level design intent.
- `packages/design/design.md` owns exact code-level design contracts, tokens,
  component contracts, and implementation source references.
- `docs/stack.md` owns the technology stack and environment description.
- `docs/architecture.md` owns repository boundaries and cross-cutting runtime
  structure.
- `docs/deployment.md` owns active deployment environments, migration gates,
  and release flow. Do not duplicate a current Alembic revision in general
  guidance; historical revision numbers belong in the logs.
- Archives are historical references. Do not treat archived documents as
  current authority unless explicitly comparing history.

## Creating and maintaining unit documents

- Before creating a new unit document or substantially rewriting one, read
  the current [`template.md`](./units/template.md) and use it as the structural
  contract.
- Preserve the template's metadata, heading order, ownership sections,
  related-unit links, UX and flow sections, technical sections, testing,
  limitations, open questions, and rebuild checklist.
- Do not remove a template section because it is currently empty. Mark it
  `Not applicable`, `Planned`, or `Unknown` and explain why when useful.
- Use the template tier rules to control depth, not product importance:
  `Full`, `Standard`, or `Minimal`.
- Keep the template generic. Unit-specific behavior belongs in the unit doc,
  not in `units/template.md`.
- Every unit document must state canonical ownership and what it does not own.
- Link related units at the top of the document and inline where a dependency
  or shared contract matters. Do not duplicate another document's canonical
  rule text.
- Use stable identifiers for local rules and acceptance criteria, such as
  `UNIT-R-001` and `UNIT-AC-001`, and connect them to verification where
  applicable.

## Evidence and status

Document what the product actually does, not what it is intended to do:

- `Active` means the behavior is implemented and currently supported.
- `Partial` means only part of the behavior is implemented.
- `Planned` means the behavior is not implemented yet.
- `Deprecated` means it is being retired or no longer supported.

When documentation and implementation differ, record both sides clearly. Do
not silently rewrite an active rule or modify application code while doing
documentation work. Record unresolved decisions under `Open questions`, known
gaps under `Known limitations`, and implementation-versus-rule conflicts in
the migration notes when applicable.

## Consistency and history

- Use UTC ISO 8601 timestamps with seconds and a `Z` suffix:
  `YYYY-MM-DDTHH:mm:ssZ`.
- Preserve historical records. Change their status instead of deleting them.
- When ownership, behavior, or shared contracts change, update affected
  related-unit links and review dependent documents for drift.
- If the template changes, review unit documents for structural drift when
  they are next substantially updated.
- Keep `docs/rules.md` focused on implemented behavior; plans and unresolved
  design decisions belong in the relevant unit documents.

## Documentation viewer

[`index.html`](./index.html) is the documentation directory's navigation and
rendering surface. Keep it synchronized with the files in this folder:

- When adding a document—especially a new file in `docs/units/`—add it to the
  viewer's document registry and the appropriate sidebar section.
- When renaming, moving, archiving, or deleting a document, update the
  registry, sidebar links, search results, and any built-in index links.
- Keep section headings, ordering, labels, and relative paths consistent with
  the actual documentation structure.
- Verify the viewer loads the changed document, renders its Markdown, and
  preserves light, dark, responsive, search, and breadcrumb behavior when
  those areas are affected.

## Verification and logging

Before considering documentation work complete:

- Check Markdown links and relative paths.
- Check that the document matches the current implementation and active rules.
- Check rule IDs, acceptance-criteria IDs, and traceability where applicable.
- Check rendered output when the change affects the documentation viewer or
  visual presentation.
- Log the completed work in both [`CHANGELOG.md`](../CHANGELOG.md) and
  [`AGENTLOG.md`](../AGENTLOG.md), using the required UTC timestamp format.
