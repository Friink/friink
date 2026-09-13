# Saved Items

Saved Items provides private saved-post access and reserves a future surface
for saved profiles.

**Status:** Partial — saved posts active; saved profiles planned  
**Tier:** Minimal  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns saved-item surfaces and privacy. [Posts](./posts.md) owns
the Save reaction itself.

## Related units

- [Posts](./posts.md) — defines Save/Unsave behavior.
- [Profiles](./profiles.md) — future saved-profile behavior.
- [Feed](./feed.md) — supplies the saved-post feed surface.

## UX and flows

The canonical saved-post route is `/saved/posts`. `/saved` and legacy
`/starred` redirect there. Saved posts use the filled brand star. Save counts
are display-only because Save actors are private. `/saved/profiles` remains a
placeholder for future profile saving.

## Business rules

- **SAVED-R-001:** Saves are private to the saving user and have no actor list.
- **SAVED-R-002:** Deleted, private, blocked, or inaccessible content is omitted
  from the user's saved list.
- **SAVED-R-003:** One user has at most one active Save per content object.
- **SAVED-R-004:** Saved-post navigation uses `/saved/posts`; legacy roots redirect.

## Acceptance criteria

- [ ] Saved posts load only for the owning user.
- [ ] Save and Unsave are retry-safe and unique.
- [ ] Save actors are never exposed.
- [ ] Saved profiles remain clearly marked as future behavior.

## Known limitations

Profile saving is planned and not implemented.
