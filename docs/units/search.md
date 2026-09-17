# Search

Search is Friink's MVP capability for finding people and posts globally and
messages within permitted conversations through authenticated,
permission-aware results.

**Status:** Partial  
**Tier:** Standard  
**Last edited:** 2026-09-17T20:20:18Z  
**Platforms:** Web and API  
**Canonical sources:** [Rules](../rules.md), [Testing](../testing.md),
`api/app/routers/search.py`, `web/components/top-bar.tsx`, and
`web/components/screens.tsx`

---

## Canonical ownership

This document owns search entry points, suggestions, query scopes, result
presentation, search authorization, indexing, pagination, and verification. It
does not own profile, post, chat, or message semantics, which remain with
[Profiles](./profiles.md), [Posts](./posts.md), and [Chat](./chat.md). The
professional directory belongs to [Discovery](./discovery.md).

## Related units

- [Discovery](./discovery.md) — owns the professional directory and eligibility.
- [Profiles](./profiles.md) — owns profile identity and visibility.
- [Posts](./posts.md) — owns post visibility and canonical destinations.
- [Chat](./chat.md) — owns conversations, messages, and chat permissions.
- [Connections](./connections.md) — owns relationship state used by access checks.
- [Account Lifecycle](./account-lifecycle.md) — owns active/deactivated/deleted state.
- [Navigation](./navigation.md) — owns the shared TopBar and shell navigation.
- [Design System](../design-system.md) — owns shared result-row and surface contracts.

---

## 1. Product definition

### MVP decision rationale

Search is intentionally being shipped as a useful MVP rather than as a
dedicated search-platform project. People, posts, and permitted Messages are
the highest-value use cases, and PostgreSQL already owns the source data and
the permission relationships needed to filter them safely. PostgreSQL trigram
indexes provide an adequate starting point for partial, case-insensitive
matching without adding another service, deployment surface, or operational
cost. The Search API and service boundary remain stable so a dedicated search
provider can be introduced later if measured scale or latency requires it.

This keeps the MVP small while preserving the extension points that matter:
typed results, explicit scopes, stable pagination, canonical links, and
server-authoritative visibility. Hashtags, global conversations, live
personalized suggestions, advanced ranking, analytics, and personalization are
planned follow-up work, not reasons to delay the initial release.

### Purpose

Search gives signed-in users one way to find relevant people and content. Home
search covers people and posts; Messages search covers permitted messages and
conversation participants.

### Goals

- Return useful, canonical people and post results, plus permitted Messages results.
- Preserve privacy, blocking, account-lifecycle, and chat access boundaries.
- Keep search bounded, indexed, paginated, responsive, and verifiable.

### Scope

TopBar entry points, query submission, simple scope shortcuts, global and
Messages scopes, result rows, API authorization, database search indexes,
basic pagination, empty/loading/error states, and release verification.

### Non-goals

Search does not define profile, post, conversation, message, relationship, or
directory eligibility rules. It consumes those units' authoritative state.

## 2. Users, actors, and permissions

### Actors

- An authenticated member searching the product.
- The web client requesting suggestions and results.
- The API and database enforcing scope, visibility, and account boundaries.

### Permissions

Search requires an authenticated session. Global results may include only
active, visible people and content. Messages results are restricted to the
current user's permitted conversations and participants.

### Privacy and security

The API is authoritative for privacy, blocking, lifecycle, and chat access.
The client must not synthesize unavailable identities or protected content.
Search responses must not expose secrets, internal database identifiers where a
public identifier exists, or unauthorized message text.

## 3. Domain model

### Entities

Search results represent people, posts, conversations, or messages. Hashtags
are a planned global result type. A query has a normalized term, scope, bound,
ordering, and (after completion) an opaque cursor.

### Relationships

Results link to canonical profile, post, or chat routes owned by related units.
Visibility is resolved from account lifecycle, profile privacy, blocking,
relationships, conversation membership, and post/message permissions.

### States and transitions

The web flow moves through idle, loading, success, empty, error, and retry
states. Changing a query or scope resets result pagination and cancels stale
requests. No persistent search state is created.

### Terminology

- **Global search:** Home search across people, usernames, and posts.
- **Messages search:** Contextual search across permitted users,
  conversations, and chat content.
- **Scope shortcut:** A bounded action such as “Search people,” “Search posts,”
  or “Search messages” that submits the current query with a scope.

## 4. Subunits

### 4.1 Search entry points and suggestions

#### Purpose

Let a member open search from Home or Messages and choose a scope or submit a
query.

#### Scope

TopBar search controls, query input, keyboard submission, simple scope
shortcuts, and navigation to full results or canonical destinations.

#### UX and surfaces

The TopBar exposes Search on signed-in screens. The search route keeps the query
field available without forcing its suggestions dropdown open. Scope shortcuts
are text-only and bounded; Enter opens `/search/{query}`. Search scope controls use
the shared `Tabs` component at the application-shell level, so the strip spans
the main panel while result content remains inside the shared capped content
box.

#### User flows

##### Submit a query

**Preconditions:** The member is authenticated.

**User steps:**

1. Open Search and type a query.
2. Press Enter or activate the submit control.
3. The client navigates to the encoded query route.

**Expected result:** The search surface loads results for the typed query.

**Alternate paths:** A contextual surface may add `scope=messages`.

**Error and recovery behavior:** Empty input does not submit. Request failure
shows an error state with retry behavior.

#### Business rules

- Scope shortcuts must be bounded and submit the typed query with the selected scope.
- Enter must submit the typed query rather than a shortcut label.

#### State behavior

Idle, open, loading, success, empty, error, and dismissed states are required.

#### Data requirements

The client stores only the active query, scope, suggestion state, and current
result request. It must discard stale responses after a query change.

#### API and service contract

MVP shortcuts do not require a separate suggestions endpoint. Full results use
`GET /search` with `query`, `scope`, and bounded `limit` parameters.

#### Frontend contract

Use shared TopBar, ContextualDropdown, PageSurface, ListRow, and identity
components. Initialize the result-page field from the URL and preserve query
and scope during navigation.

#### Backend contract

The server validates the query and scope and authorizes every result.

#### Acceptance criteria

- [ ] **SEARCH-AC-001** Scope shortcuts are bounded, actionable, and distinct
  from full-query Enter navigation.
- [ ] **SEARCH-AC-002** The authenticated search route renders loading, success,
  empty, error, and retry states.

#### Test scenarios

- [ ] Happy path and Enter submission
- [ ] Empty query and empty results
- [ ] Error, retry, and stale-request behavior
- [ ] Keyboard access, focus, and responsive layout

#### Verification

- [ ] Browser flow checked on Home and a contextual screen.
- [ ] Canonical navigation and URL hydration checked.
- [ ] No known contradiction with Navigation or Design System.

### 4.2 Search API and result retrieval

#### Purpose

Return authorized, bounded results from the database.

#### Scope

Global and Messages scopes, permission filtering, result schemas, indexes,
ordering, pagination, and API tests.

#### UX and surfaces

Results use shared list rows and canonical links; unauthorized or unavailable
items are omitted rather than replaced with synthetic identities.

#### Business rules

- Global search covers people, usernames, and posts for the MVP.
- Messages search covers permitted users, conversations, and chat content.
- Search is authenticated, server-authoritative, bounded, indexed, and supports
  basic pagination for the MVP.

#### State behavior

The API returns a stable result page and an explicit continuation indicator.
Invalid query, scope, or authentication state returns the standard API error.

#### Data requirements

Search reads users, posts, conversations, and messages. PostgreSQL trigram
indexes are introduced by migration `20260917_0051_search_indexes.py`.

#### API and service contract

`GET /search` currently accepts `query`, `scope=global|messages`, `kind=all|person|post`,
and `limit=1..50`, returning `items` and `has_more`. The Search surface now
exposes URL-backed All/People/Posts/Messages scope controls; MVP completion adds
a stable opaque cursor or equivalent basic “Load more” contract. Global conversation and
hashtag search, live suggestions, and advanced ranking are planned later.

#### Frontend contract

The client calls the endpoint with the authenticated bearer token and renders
the returned `SearchResult` records through shared rows.

#### Backend contract

The API applies active-account, privacy, conversation-membership, and content
visibility checks before returning results. It must add stable cursor ordering
and test isolation across users.

#### Acceptance criteria

- [ ] **SEARCH-AC-003** MVP global and Messages scopes return their complete,
  documented result types.
- [ ] **SEARCH-AC-004** Unauthorized private, blocked, inactive, deleted, or
  otherwise inaccessible data is excluded.
- [ ] **SEARCH-AC-005** Results use basic stable pagination, bounded counts,
  canonical links, and duplicate-free client loading.
- [ ] **SEARCH-AC-006** API tests cover MVP scopes, permissions, limits, ordering,
  pagination, and response shape.

#### Test scenarios

- [ ] Happy path for global and Messages scopes
- [ ] Validation and authentication failure
- [ ] Privacy, blocking, lifecycle, and account-isolation checks
- [ ] Empty, bounded, ordered, paginated, duplicate, and concurrent requests
- [ ] Regression coverage for canonical links and response schema

#### Verification

- [ ] Automated API tests pass.
- [ ] One real authenticated development request returns the expected shape.
- [ ] One authenticated staging request/response check passes.

## 5. Cross-subunit behavior

Changing the query or scope resets the result state and invalidates in-flight
shortcut/result requests. Selecting a scope shortcut submits the current query
with that scope; Enter navigates to the full query route. Both paths use the
same server authorization rules.

## 6. Cross-unit dependencies

Search consumes visibility and canonical-route contracts from Profiles, Posts,
Chat, Connections, Account Lifecycle, and Discovery. Navigation owns where the
TopBar control appears; Design System owns the shared row and dropdown geometry.
Search must not duplicate or weaken those units' permissions.

## 7. Technical architecture

### Components and ownership

API: `api/app/routers/search.py` and `api/app/schemas/search.py`. Web:
`web/components/top-bar.tsx`, `web/components/screens.tsx`,
`web/components/app-shell.tsx`, and `web/lib/auth.ts`. Routes live under
`web/app/search/`.

### Storage and persistence

Search is read-only. PostgreSQL stores the source entities and uses the
`pg_trgm` extension plus search indexes from migration `20260917_0051`.

### Performance and reliability

Requests are bounded to 50 results. The MVP requires indexed queries, basic
stable pagination, stale-request cancellation, and no client deduplication
gaps. PostgreSQL remains the search backend; a separate search service is not
an MVP dependency.

## 8. Testing and verification

### Traceability matrix

| ID | Requirement | Test or verification | Status |
|---|---|---|---|
| SEARCH-AC-001 | Scope shortcuts | Browser acceptance flow | Planned |
| SEARCH-AC-002 | Authenticated UI states | Browser acceptance flow | Planned |
| SEARCH-AC-003 | Complete MVP scopes | API tests and request check | Planned |
| SEARCH-AC-004 | Permission isolation | API tests with multiple accounts | Planned |
| SEARCH-AC-005 | Basic stable pagination | API and browser tests | Planned |
| SEARCH-AC-006 | Search regression coverage | `api/tests/` search tests | Planned |

### Test matrix

| Area | Scenario | Expected result | Verification |
|---|---|---|---|
| UX | Submit, suggest, empty, error, retry | Correct state and navigation | Browser |
| API | Global and Messages query | Documented response shape | Request/response |
| Security | Private, blocked, and chat isolation | No unauthorized results | Automated/manual |
| Data | Indexes and cursor ordering | Bounded, stable pages | Database/API |

### Release gates

Search is not release-ready until the acceptance criteria pass, dedicated API
coverage exists, a real authenticated request/response is verified, and the
authenticated staging browser flow succeeds after the migration head is
applied.

### Manual verification

Check Home and contextual entry points, URL hydration, keyboard/focus behavior,
light/dark/responsive states, loading/empty/error/retry behavior, and two-user
privacy/account-isolation scenarios.

## 9. Deployment and migration

Apply and verify Alembic head `20260917_0051` in the target environment before
acceptance testing. Development is for implementation; staging is for deployed
acceptance; production requires the normal release gate. No destructive search
data migration is currently required.

## 10. Current implementation status

Implemented: signed-in TopBar entry points, `/search` and `/search/[query]`
routes, explicit route-to-shell query propagation, hydrated result-page input,
API client, result surface, global/Messages API scopes, URL-backed
All/People/Posts/Messages controls, API-side People/Posts filtering, permission
filters, and PostgreSQL trigram indexes. Partial: authenticated E2E proof, MVP
scope verification, pagination, and automated search coverage.

## Known limitations

The MVP intentionally does not include global conversation search, hashtag
search, live personalized suggestions, highlighting, typo tolerance, advanced
ranking, analytics, or personalization. These are planned extensions, not MVP
release blockers.

## Open questions

- Whether basic pagination should be exposed as a `Load more` button or an
  opaque cursor API detail can be finalized during implementation, provided the
  client behavior remains stable and duplicate-free.

## Planned after MVP

These items are intentionally deferred and are not MVP release blockers:

- Global conversation search.
- Hashtag search.
- Live personalized suggestions backed by a separate endpoint.
- Match highlighting, typo tolerance, and advanced relevance ranking.
- Search analytics, personalization, and a dedicated search service if
  PostgreSQL no longer meets measured performance needs.

## 11. Rebuild checklist

- [ ] Reproduce and fix the authenticated development flow
- [ ] Implement complete MVP global and Messages scope behavior
- [ ] Enforce and test permission boundaries
- [ ] Add stable cursor pagination and client loading
- [ ] Implement simple actionable scope shortcuts
- [ ] Add API and browser verification
- [ ] Verify migration and authenticated staging behavior

## Changelog

- 2026-09-17 — Created the dedicated cross-surface Search unit and separated
  its ownership from Discovery.
- 2026-09-17 — Defined PostgreSQL-backed people, posts, and Messages search as
  the MVP; moved global conversations, hashtags, live suggestions, highlighting,
  advanced ranking, analytics, and personalization to Planned.
- 2026-09-17 — Added URL-backed MVP scope controls and API-side People/Posts
  filtering; Messages remains the explicit contextual scope.
- 2026-09-17 — Fixed dynamic search routes so the query is passed explicitly
  through the shell and hydrated in the Search input instead of rendering the
  no-query placeholder.
- 2026-09-17 — Kept the persistent result-page search field separate from the
  optional suggestions dropdown so `/search/{query}` does not open suggestions
  automatically.
