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

Mobile authentication and session requirements are preserved separately in
`docs/auth-and-session-mobile.md` and are deferred until a mobile client exists.
