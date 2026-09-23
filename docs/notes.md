# Friink notes

## Legacy auth/session note

This is a note from an older implementation. The file with five phases was
moved to the archives under `docs/`. Auth and session were never tested end to
end, so this information may be useful when testing them. It is retained for
now.

Current auth/session scope: Phases 1–3 are closed, Phase 4 is closed for the
current web/API-focused release, Phase 5a–5d staff discovery, bootstrap, roles,
privileged sessions, and administrative security are implemented and verified
on staging, and Phase 6 operations are implemented with final operational
rehearsals still open. Staging is the authoritative release gate when it is
production-parity; production receives the verified artifact and gets smoke
checks only.

Mobile authentication and session requirements are preserved in the historical
archive at `docs/archives/auth-and-session-mobile.md` and remain deferred until
a mobile client exists.

## Remembered accounts reappeared after local staging API recovery

**Recorded:** 2026-09-23T22:39:40Z — **Status:** Code path identified; exact
incident request sequence unverified.

### Reported sequence

The user reported that the local frontend initially loaded, then showed a
`Failed to fetch`/logged-out or reconnecting state while its API connection was
unavailable. After the API connection returned, the app appeared signed in,
but the feed and profile did not load correctly. The staging database was then
migrated to the repository's latest Alembic head, after which remembered
accounts that had been present during earlier local runs appeared in the
account switcher. The user's hypothesis was that the API/database mismatch
had hidden earlier sessions and the migration made them reappear.

### Finding in the current implementation

There is a concrete recovery path that can make the timing look that way:

1. Authenticated route entry calls `restoreAuthSessionForEntry()` in
   `web/lib/auth.ts`. Recoverable network failures leave the app in its session
   recovery state; the client only attempts remembered-slot recovery after a
   terminal refresh response.
2. On a terminal refresh failure, the client reads previously cached,
   device-scoped account summaries, sorts them by last use, and tries each
   eligible remembered slot through `POST /auth/refresh` with the opaque slot
   ID in `X-Friink-Account-Slot`.
3. The API validates the `friink_device_id` cookie, the slot, its active
   unrevoked auth session, and the account's active lifecycle state. If the
   slot's refresh cookie is absent, the API can issue a new refresh token for
   that still-valid server-side session and return a new access token.
4. After a session is restored, `GET /auth/accounts` lists active,
   unrevoked slots associated with that same device. The account switcher
   refreshes this list when the shell mounts and when the selector opens.

This means an API outage can prevent a browser from reaching sessions that
remain in the database. Once the API is reachable and the refresh flow is
retried, the existing device-bound sessions can become usable again. The
switcher list is not a query for every account in the database; it is limited
to eligible remembered sessions for the browser's device cookie.

### Migration boundary and conclusion

The staging migrations applied in this run (`20260924_0057` and
`20260924_0058`) changed chat conversation structure: the first added and
backfilled conversation membership, and the second adjusted direct/group
conversation constraints and indexes. They did not modify users, auth
sessions, refresh tokens, or account-session slots. Therefore the migrations
could not themselves recreate or restore those auth records. The most
consistent explanation is that API recovery enabled the existing session
recovery/account-slot path, while the chat migration separately addressed the
database schema mismatch. The migrations alone do not establish why the feed
or profile failed.

The source code supports this explanation, but the exact sequence for the
screenshot is not proven: the local API is no longer running and the request
log from the incident is unavailable. No dedicated client regression test for
the terminal-refresh-to-remembered-slot fallback was found during this review.
The visible account list is consistent with accounts intentionally remembered
on this browser and is not, by itself, evidence of a breach. Any account the
user did not intentionally add would still require review of the matching
device slots, auth sessions, and authentication/account-switch events.

## Add-account limit mismatch after refresh

**Recorded:** 2026-09-21T21:44:25Z
**Status:** Fixed locally; staging acceptance pending.

On staging, the active browser can show only one remembered account, but the
Add account flow can report `Remove an account before adding another.` after
the session has been refreshed repeatedly. That message is emitted when the
API considers the browser's device-scoped remembered-account slots full.

Multiple refreshes should rotate the existing slot's refresh credential and
must not create additional account slots. The suspected causes are a stale or
mismatched long-lived `friink_device_id`, a staging override of
`MAX_REMEMBERED_ACCOUNTS_PER_DEVICE`, or an account-list refresh race that
leaves the UI showing an incomplete list. The account list and availability
responses must be compared for the same browser/device before changing the
slot logic:

- `GET /auth/accounts` — returned remembered slots and account summaries.
- `GET /auth/accounts/add-availability` — server `allowed` result.
- The final `POST /auth/login` from the Add account flow — status and error
  response.

Check the staging account-slot logs alongside those responses. Do not treat
the browser's visible account count as authoritative until the device cookie
and server slot count agree. The local fix excludes slots whose auth session
has been revoked or whose account is no longer active, repairs a stale slot
link during account discovery, and adds a regression request/response test.
Staging verification remains open.

## Search MVP decision

**Recorded:** 2026-09-17T20:00:36Z

Search is intentionally scoped as an MVP feature, not as a search-platform
R&D project. The first release covers people and posts globally, plus Messages
within conversations the member is permitted to access. These use cases solve
the immediate product need while keeping the UX understandable and the
permission model close to the source data.

PostgreSQL remains the MVP search backend because Friink already depends on it,
the searchable entities and access relationships already live there, and
`pg_trgm` indexes support the required partial, case-insensitive matching. This
avoids introducing Elasticsearch/OpenSearch or another operational dependency
before real usage demonstrates a need. Search is still isolated behind an API
and typed result contract so a dedicated search provider can replace the
PostgreSQL implementation later without requiring a frontend redesign.

The following are deliberately Planned rather than MVP blockers: global
conversation search, hashtag search, live personalized suggestions, typo
tolerance, match highlighting, advanced ranking, analytics, personalization,
and a dedicated search service. Revisit those decisions using measured query
latency, dataset size, usage patterns, and user feedback—not speculation.

## UI/UX consistency audit backlog

**Recorded:** 2026-09-21T00:00:00Z
**Status:** Audit backlog; no product behavior is changed by this note.

The following gaps were identified against [`docs/design-system.md`](design-system.md)
and [`packages/design/design.md`](../packages/design/design.md). They are
recommendations for future cleanup, not active implementation rules.

1. **Button hover and active states.** Shared primary and secondary buttons
   currently establish the surface treatment but do not always communicate a
   sufficiently distinct hover or pressed state. Primary buttons should deepen
   the solid accent surface; secondary buttons should strengthen their
   translucent accent surface; both need a clear active/pressed treatment.
2. **Subscription status language.** Settings and Control Panel surfaces use
   different capitalization and labels for equivalent states, such as
   `Active`, `active`, `Expired`, `Revoked`, and `Free default`. Normalize the
   vocabulary and capitalization across member and staff views.
3. **Disabled subscription actions.** Current-plan, available, and coming-soon
   states are presented as disabled buttons in some places. Use non-interactive
   status badges or labels when there is no action, reserving buttons for an
   operation the user can perform.
4. **Actionable-row hover behavior.** Generic list rows provide a hover surface,
   while settings rows intentionally remain transparent. Decide whether
   actionable settings and administrative rows need a shared, subtle hover
   affordance and document the exception when they do not.
5. **Icon-only control variants.** The platform mixes bordered neutral utility
   controls, borderless contextual controls, and compact accent controls. Define
   explicit icon-button variants so the difference is intentional rather than
   route-specific.
6. **Control Panel discoverability and copy.** Some Control Panel descriptions
   still describe subscription or professional-registration capabilities as
   planned even though related staff workflows are present. Align visible copy
   and documentation with the actual capability and its remaining release gate.
7. **Subscription administration terminology.** Staff actions use labels such as
   `Adjust plan`, while the clearer workflow vocabulary is `Grant access`,
   `Change access`, and `Return to Free`. Normalize action names and retain
   explicit manual-access/non-payment language.
8. **Status styling.** Subscription, registration, and lifecycle states are not
   consistently represented as status labels or badges, and raw capitalization
   varies. Use restrained status treatments with text always carrying the
   meaning; color should not be the only signal.
9. **Auth/session recovery surface.** The local Control Panel can show a session
   recovery message in a standalone-looking surface rather than the normal app
   shell. Keep recovery messaging, spacing, and button treatment consistent with
   the shared shell where possible. This is an operational UX concern, not a
   request to change authentication behavior.

### Intentional contextual exceptions

The following should remain contextual exceptions unless a later audit shows a
specific usability problem: public subscription marketing cards, FeedPost
Share/More controls, the compact profile Message control, and chat mute/archive
controls. Their distinct treatment is acceptable when it reflects their
compact, contextual, or destructive/utility role.

### Recommended order of work

Start with shared button hover/active behavior, then normalize subscription
status language and actions, align Control Panel copy, formalize icon-button
variants, and finally revisit actionable-row hover behavior. This sequence
reduces the most visible inconsistency without requiring a broad redesign.
