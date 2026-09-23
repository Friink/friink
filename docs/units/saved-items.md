# Saved Items

Saved Items provides private saved-post and saved-profile access.

**Status:** Active
**Tier:** Minimal  
**Last edited:** 2026-09-23T00:05:46Z
**Platforms:** Web and API

## Canonical ownership

This document owns saved-item surfaces and privacy. [Posts](./posts.md) owns
the Save reaction itself.

## Related units

- [Posts](./posts.md) — defines Save/Unsave behavior.
- [Profiles](./profiles.md) — supplies profile identity and lifecycle state.
- [Feed](./feed.md) — supplies the saved-post feed surface.

## UX and flows

The canonical saved-post route is `/saved/posts`. `/saved` and legacy
`/starred` redirect there. Saved posts use the filled brand star. Save counts
are display-only because Save actors are private. `/saved/profiles` lists the
current user's private profile saves. The Saved `Posts`/`Profiles` tabs are
owned by the application shell so the tab strip spans the main panel; saved
content remains inside the shared capped content box.

## Business rules

- **SAVED-R-001:** Saves are private to the saving user and have no actor list.
- **SAVED-R-002:** Deleted, private, blocked, or inaccessible content is omitted
  from the user's saved list.
- **SAVED-R-003:** One user has at most one active Save per content object.
- **SAVED-R-004:** Saved-post navigation uses `/saved/posts`; legacy roots redirect.
- **SAVED-R-005:** Profile saves are private, unique per viewer/profile pair,
  and are created or removed from the profile action menu.
- **SAVED-R-006:** A deactivated or pending-deletion saved profile remains as a
  removable unavailable row without a link or profile details. Reactivation
  restores its details; permanent deletion removes the relationship through
  the account cascade.
- **SAVED-R-007:** A saved-profile row renders its ProfileCard identity once and
  uses a visible star-with-slash removal control.
- **SAVED-R-008:** Available saved-profile rows expose Follow/Following state
  and a More menu containing Remove from saved and Block user actions.

## Acceptance criteria

- [ ] Saved posts load only for the owning user.
- [ ] Save and Unsave are retry-safe and unique.
- [ ] Save actors are never exposed.
- [ ] Saved profiles show available profiles and removable unavailable rows.
- [x] Available saved profiles expose connection and moderation actions.

## Known limitations

Profile saves do not currently expose save counts or a profile-saver list.
