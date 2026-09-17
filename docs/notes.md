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
rehearsals still open. Production rollout remains a separate release gate.

Mobile authentication and session requirements are preserved in the historical
archive at `docs/archives/auth-and-session-mobile.md` and remain deferred until
a mobile client exists.

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
