# Code organization plan

**Status:** Active migration plan  
**Last edited:** 2026-10-02T01:20:00Z  
**Scope:** Internal structure within `api/` and `web/`

## Boundary rule

The repository keeps its existing top-level runtime boundary:

```text
api/   # Python API and server-side runtime
web/   # Next.js web shell and browser runtime
```

This plan does not merge, rename, or otherwise decouple those two top-level
applications. Organization changes happen inside each boundary.

## Goals

- Keep each code file at or below 512 lines.
- Group code by responsibility so ownership is clear.
- Move modules incrementally without a big-bang rewrite.
- Preserve old import paths with compatibility shims during migration.
- Keep one runtime owner for security-sensitive behavior such as sessions.
- Make every move independently buildable, testable, and reversible.

## Placeholder structure

The initial folders are intentionally placeholders. They do not change runtime
behavior until a module is moved into them.

```text
api/app/
  models/
  routers/
  schemas/
  services/
  repositories/       # persistence/query ownership as modules are extracted
  integrations/       # external service adapters as modules are extracted

web/
  app/                # routes and route composition
  components/         # shared UI components
  features/
    accounts/
    chat/
    posts/
    session/
    settings/
  lib/
    accounts/
    chat/
    posts/
    session/
    settings/
```

Existing folders remain authoritative. A placeholder is not permission to
duplicate an implementation; the first move must establish the new owner and
leave a compatibility export at the old path when needed.

## Migration method

### Phase 1 — Establish seams

- Add the placeholder folders.
- Define the owning module and public contract before moving code.
- Keep existing imports working through re-export shims.
- Do not change API routes, database schema, cookies, or deployment boundaries.

### Phase 2 — Extract one responsibility

- Move one coherent responsibility at a time.
- Keep each new code file under 512 lines.
- Avoid copying logic into both old and new locations.
- Use the old module only as an adapter or fallback during verification.

### Phase 3 — Migrate consumers

- Move one consumer or surface at a time.
- Run targeted type checks and tests after each move.
- Verify multi-tab, retry, and failure behavior for session-related changes.
- Use staging for acceptance testing before removing compatibility exports.

### Phase 4 — Retire legacy paths

- Confirm no imports remain with `rg`.
- Remove the compatibility shim only after staging verification.
- Record the completed move in `CHANGELOG.md` and `AGENTLOG.md`.

## First planned moves

1. Complete the session migration under `web/lib/session/` while keeping the
   legacy `web/lib/auth.ts` adapter available.
2. Split oversized API authentication responsibilities from
   `api/app/routers/auth.py` without changing endpoint contracts.
3. Split oversized service responsibilities from `api/app/services/chat.py`.
4. Move web domain clients into feature-owned folders only after their public
   contracts are documented.

## Guardrails

- No code file over 512 lines for new or reorganized code.
- No simultaneous new and legacy refresh owners.
- No database migration is implied by a folder move.
- No API/web top-level boundary change.
- Every migration must have a rollback path through the previous import or
  adapter until staging acceptance is complete.

## Verification checklist

- [ ] New folders contain only intentional modules or placeholders.
- [ ] Compatibility imports resolve.
- [ ] Type check passes.
- [ ] Relevant targeted tests pass.
- [ ] Changed files remain within the line limit.
- [ ] Staging behavior matches the pre-migration behavior.
- [ ] Documentation and migration history are updated.
