# Posts

Posts are Friink's authored content objects, including ordinary posts, nested
replies, quotes, media attachments, likes, saves, visibility, and canonical
permalinks.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-15T23:19:08Z
**Platforms:** Web and API

## Canonical ownership

This document owns what a post is, how it is created and viewed, its content
relationships, visibility, reactions, and post-level navigation. [Feed](./feed.md)
owns selection and ordering; [Media](./media.md) owns upload mechanics.

## Related units

- [Feed](./feed.md) — surfaces posts and owns feed pagination/ordering.
- [Profiles](./profiles.md) — surfaces author-scoped posts and replies.
- [Media](./media.md) — owns image preparation and storage.
- [Connections](./connections.md) — contributes visibility and following rules.
- [Blocking](./blocking.md) — restricts access to protected content.
- [Notifications](./notifications.md) — receives mention and Like events.
- [Design System](../design-system.md) — owns shared post-card patterns.

## Rules

- **POSTS-R-001:** One posts model stores posts, replies, and quotes; kind and
  parent relationships determine behavior.
- **POSTS-R-002:** Post content and media limits are enforced by client hints
  and authoritative API validation.
- **POSTS-R-003:** Replies preserve their nested conversation tree while visual
  indentation remains capped for readability.
- **POSTS-R-004:** Private post visibility is enforced server-side, including
  when viewing, replying, or quoting.
- **POSTS-R-005:** Private posts cannot be quoted; unavailable quoted originals
  render a non-clickable unavailable block.
- **POSTS-R-006:** Canonical post URLs use author username plus authoritative
  public post ID; cosmetic slug text is not the lookup key.
- **POSTS-R-007:** Likes and Saves are unique durable reactions per user/content
  object. Like identity visibility follows privacy rules; Saves have no actor list.
- **POSTS-R-008:** A post card's non-interactive area navigates to detail;
  controls, profile links, mentions, and quoted-post links retain their targets.
- **POSTS-R-009:** Unavailable post details use a calm post-like unavailable
  state rather than a technical 404 presentation. The state explains that the
  post may be private, deleted, or no longer visible and provides a `Go home`
  action. Authenticated client-side failures retain the app shell; route-level
  failures use the same card in a lightweight page wrapper.

## UX and flows

The composer supports text, replies, quotes, and submit-time image attachments.
Feed and detail cards show author identity, body, quoted content, expansion,
replies, Like, and Save actions. Loading, unavailable, private, empty, and
error states remain explicit. A missing, deleted, private, or inaccessible
direct post URL renders a post-like unavailable card without exposing a
technical error code; the canonical post URL still redirects when the post is
otherwise accessible.

## Technical contract

Post routes and schemas live in `api/app/routers/posts.py` and
`api/app/schemas/posts.py`; shared UI uses `FeedPost`, `PostDetailScreen`, the
composer, and `PostUnavailableState`. Deletion removes associated media before
marking the post deleted. The API continues to return a privacy-preserving
404-equivalent for posts the viewer cannot access; the web maps that response
to the unavailable-post state.

## Acceptance criteria

- [ ] **POSTS-AC-001** Post, reply, and quote payloads enforce their kinds.
- [ ] **POSTS-AC-002** Private visibility is enforced for all access paths.
- [ ] **POSTS-AC-003** Canonical public URLs resolve by public ID.
- [ ] **POSTS-AC-004** Like and Save toggles are unique and retry-safe.
- [ ] **POSTS-AC-005** Media failure does not leave half-created posts.

## Known limitations

Link attachments remain reserved for future behavior. Final crop dimensions are
not persisted.
