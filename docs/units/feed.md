# Feed

Feed presents authored content in Explore, Following, profile, saved, and
other contextual timelines.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-22T23:41:02Z
**Platforms:** Web and API

## Canonical ownership

This document owns feed surfaces, membership, ordering, pagination, refresh,
and reading position. [Posts](./posts.md) owns post semantics and visibility.

## Related units

- [Posts](./posts.md) — defines feed item types, visibility, and interactions.
- [Connections](./connections.md) — defines Following-feed membership.
- [Profiles](./profiles.md) — defines author-scoped feeds.
- [Saved Items](./saved-items.md) — defines saved-post feed behavior.
- [Design System](../design-system.md) — owns shared content and card patterns.

## Rules

- **FEED-R-001:** Home has Explore and Following tabs; Explore is the default.
- **FEED-R-002:** Following contains posts strictly from accounts the viewer
  follows, subject to visibility and blocking rules.
- **FEED-R-003:** Feed pagination and updates use server-authoritative cursors
  and must not duplicate or silently drop items.
- **FEED-R-004:** Home restores reading position where the current web contract
  requires it.
- **FEED-R-005:** Profile feeds use the viewed author's scoped collection, not
  a client-side filter over the global feed.
- **FEED-R-006:** Feed failures preserve usable content and expose retry rather
  than inventing content or clearing the active session.
- **FEED-R-007:** The shared post action row anchors its four actions from the
  left content edge to the right content edge. The post-header utilities form
  one vertically centered, right-aligned pair in Share-then-More order with a
  12px touch-safe gap, within the shared content inset. These utilities use
  their own compact, borderless icon-control geometry rather than the shared
  standard-button minimum dimensions, with no decorative border or outline.
- **FEED-R-008:** Post action controls change to the current accent color on
  hover, keyboard focus, and press. Like and Save retain the accent color while
  active; their counts remain muted except while the associated control is
  being interacted with.
- **FEED-R-009:** Scrollable tab strips show the right arrow only while more
  content remains to the right; tab arrows must fit inside the tab bar without
  extending beyond its bounds, and visible arrows sit flush against the bar's
  left or right edge.
- **FEED-R-010:** The Home feed refresh control spans the same content column as
  the feed body and floating composer; it must not add a second horizontal
  inset of its own.
- **FEED-R-011:** Composer text is held in screen-local memory only. Leaving a
  feed or contextual composer does not restore its previous text from browser
  storage.

## UX and flows

The Home surface defaults to Explore and supports Following. Feed cards use the
shared `FeedPost`; the floating composer is available on feed surfaces and is
hidden on profiles. Empty, loading, refresh, and error states are explicit.
When new posts are prepended after a refresh or post creation, the feed updates
after the current React lifecycle and preserves the reader's scroll position
without forcing a synchronous render from an effect.

## Technical contract

Feed responses are currently returned through the posts API (`FeedPageResponse`)
and consumed by `home-screen.tsx`, `feed-post.tsx`, and profile screens. Cursor
pagination and update endpoints remain server-authoritative.

## Acceptance criteria

- [ ] **FEED-AC-001** Explore and Following membership are distinct.
- [ ] **FEED-AC-002** Following never includes an unauthorized author.
- [ ] **FEED-AC-003** Pagination and updates are cursor-safe and duplicate-safe.
- [ ] **FEED-AC-004** Feed errors preserve usable state and allow recovery.
- [ ] **FEED-AC-005** Profile feeds use author-scoped data.

## Known limitations

Ranking and personalization beyond the current Explore/Following behavior are
not yet specified.
