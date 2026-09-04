# Likes and Stars

Status: implementation contract for the first Likes and Stars release. The
implementation is present, both databases are migrated to `20260904_0024`,
and the authenticated reaction E2E flow passes against staging. Production
has passed read-only schema verification. Deploy the current web/API code to
each environment, then complete the browser/manual checklist below.

## Release readiness

- Database readiness: staging and production are both at migration head
  `20260904_0024`.
- API readiness: the focused authenticated reaction E2E flow passed against
  staging; production has read-only schema verification.
- Remaining release step: deploy the current application code to both
  environments and manually verify the browser flows at mobile, tablet, and
  desktop sizes.

## Product summary

Likes are public social engagement. Stars are private-to-the-user saves, similar
to bookmarks. Both reactions belong only to posts, both expose a public
aggregate count, and both can be toggled repeatedly. A user
can have at most one Like and one Star on a post at any moment.

## Requirements

### Likes

- A signed-in user can Like or Unlike any post they are allowed to view,
  including their own posts.
- A Like is unique per `(user, post)` pair. Repeated requests must not create
  duplicate rows or increment the count more than once.
- Every viewer can see the post's Like count; only authenticated viewers can
  open the Like actor list.
- The post owner receives one in-app notification after a confirmed Like from
  another user. Self-Likes do not notify the owner.
- Unlike is silent. It does not retract a prior notification.
- A user's liked posts are available from the profile tab
  `/{username}/likes`. The tab is visible to signed-in viewers for now.
- The signed-in user can always see their own liked posts.

### Stars

- A signed-in user can Star or Unstar any post they are allowed to view,
  including their own posts.
- A Star is unique per `(user, post)` pair. Repeated requests must not create
  duplicate rows or increment the count more than once.
- Every viewer can see the post's Star count.
- The Starred drawer destination remains the user's private Starred page.
  Other users must not be able to use it to inspect someone else's Stars.
- Star and Unstar never notify the post owner.
- The post owner can see the aggregate Star count but cannot see who Starred it.

### Privacy

- Add a Like visibility setting under `/settings/privacy`.
- The initial setting is enabled for existing and newly-created users.
- When enabled, the user's Like identity may appear in Like lists and their
  `/{username}/likes` tab is available to signed-in viewers.
- When disabled, the user's Like identity is omitted from every Like list and
  their `/{username}/likes` tab is hidden from other viewers. The user can still
  view their own liked posts.
- Disabling Like visibility does not remove the Like, change the aggregate Like
  count, or affect notifications already created.
- Stars are not controlled by this setting.
- Keep the visibility check server-side and centralized so a future paid
  per-post or account-level privacy policy can replace the current default
  without changing reaction storage or client contracts.

### Like-user list

- Clicking the Like count opens the shared responsive Modal.
- The modal uses the existing row/list pattern and ProfileCard for each actor.
- Each visible ProfileCard links to the actor's profile.
- The list supports database-backed case-insensitive search and opaque-cursor
  infinite scroll, following the blocked-users list behavior in
  `docs/blocking.md`.
- The list excludes actors whose profile is private, who have a bilateral block
  relationship with the viewer, or whose Like visibility is disabled.
- Search applies on the server, not only to already-loaded rows.
- Search changes reset the cursor and de-duplicate results.
- The list is available only to authenticated users.
- An empty result uses the shared list empty-state language: `Not found.`

### Post action layout

Post actions retain the existing visual language and are arranged as:

`comment count · quote count · like count · star count                 share · more`

- Like uses an outlined heart when inactive and a filled heart when active.
- Star uses an outlined star when inactive and a filled star when active.
- The Like count is a keyboard-accessible button that opens the actor list and
  exposes its count through an accessible label. The Star count is a labelled,
  read-only aggregate because Star actors are private.
- Share sits beside the three-dot menu and is no longer mixed into the counted
  reaction group.
- Counts are always rendered, including zero, to preserve alignment.

## Scope

### In scope

- Durable Like and Star relations for posts.
- Unique constraints and idempotent toggle behavior.
- Public post aggregate counts.
- Authenticated Like and Star controls on shared post cards and post detail.
- Authenticated Liked-post profile tab and existing private Starred page.
- Like actor modal with ProfileCard rows, search, and cursor pagination.
- Like visibility preference in Settings > Privacy.
- In-app Like notifications to post owners.
- Removal of inaccessible posts from Liked and Starred lists.
- A neutral Post unavailable response for direct access to inaccessible posts.

### Out of scope

- Likes on replies, comments, quotes, users, or other non-post objects.
- Star actor lists.
- Email, push, or realtime reaction delivery.
- Notification grouping, notification retraction, or unlike notifications.
- Paid privacy entitlements. The setting and API policy seam are included so
  paid rules can be added later.
- Moderation, reaction reporting, reaction export, or bulk removal.
- Restoring a reaction after a post is deleted or becomes inaccessible.

## Technical design

### Data model

- Add a `post_likes` table with an opaque UUID primary key, `post_id`,
  `user_id`, and `created_at`.
- Add a `post_stars` table with the same shape.
- Both tables use foreign keys to `posts` and `users` with cascade deletion,
  indexes for post and user lookups, and a unique `(post_id, user_id)` pair.
- Add a `like_count` and `star_count` denormalized counter to `posts`, both
  non-negative and defaulting to zero. The database mutation that creates or
  deletes a relation must update the matching counter atomically.
- Add a user preference field such as `likes_visible` with a default of true.
  The field controls discoverability, not whether the relation or aggregate
  count exists.
- Register all models with SQLAlchemy metadata and add one Alembic migration.

### API contract

All reaction and list endpoints require the current authenticated user.

- `POST /posts/{post_id}/like` — create a Like idempotently; return the
  post's current `like_count` and `liked` state.
- `DELETE /posts/{post_id}/like` — remove the current user's Like; return the
  current count and `liked: false`.
- `POST /posts/{post_id}/star` — create a Star idempotently; return the
  current `star_count` and `starred` state.
- `DELETE /posts/{post_id}/star` — remove the current user's Star; return the
  current count and `starred: false`.
- `GET /posts/{post_id}/likes?query=&cursor=&limit=` — return visible
  ProfileCard-compatible actors, `next_cursor`, and `has_more`.
- `GET /users/{username}/likes?cursor=&limit=` — return the authenticated
  viewer's visible liked-post page for the requested profile, subject to the
  requested user's Like visibility and profile/access rules.
- `GET /posts/starred?cursor=&limit=` — return only the authenticated user's
  Starred posts. This must not accept an arbitrary username.
- `GET /auth/me` and `PATCH /auth/me` — read and update the current user's
  `likes_visible` preference through the existing settings preference contract.

Post responses include public `like_count` and `star_count` for every viewer.
The authenticated viewer additionally receives `liked` and `starred` state;
unauthenticated responses leave those state fields null and expose no reaction
lists or toggle affordances.

### Authorization and visibility

- The API remains authoritative for post visibility, authentication, block
  checks, privacy, and reaction ownership.
- A reaction is allowed only when the viewer can view the post. Private-post
  access continues to use the existing accepted-follow/owner rules.
- Like actor results are filtered by the viewer's access to the actor and by
  the actor's `likes_visible` preference. Filtering must not reveal why an
  actor is absent.
- Liked-post results are filtered through the same post visibility and
  bilateral block rules as the normal feed. Deleted or inaccessible posts are
  omitted.
- A direct post URL that no longer resolves for the viewer returns the existing
  neutral unavailable state rather than revealing whether the post was deleted,
  made private, or blocked.

### Consistency and notifications

- Database uniqueness is the final defense against double reactions from
  retries, multiple tabs, or concurrent requests.
- Toggle operations should return server-authoritative state. The web client
  may update optimistically and must roll back on failure.
- A Like notification is created only after the Like relation and counter are
  successfully committed. The notification payload should include the post
  public ID/slug and actor display data needed to navigate to the post.
- Self-Likes do not create notifications. Unlikes do not remove notifications.
- Existing notification polling supplies the first delivery mechanism; no new
  realtime transport is required.

## Implementation details

- Extend the existing `Post` response mapping and shared `Post` client model;
  do not create a second post-card implementation for Liked or Starred pages.
- Extend `FeedPost` so the Like and Star buttons have real handlers, active
  states, counts, and count-button modal behavior.
- Reuse `Modal`, `ListRow`, `ProfileCard`, `PageSurface`, and the blocked-list
  cursor/search pattern. Add semantic classes and shared CSS only in
  `web/app/globals.css`; do not add route CSS, inline styles, or visual rules
  in TSX.
- Extend `ProfileScreen` tabs/route handling for `/username/likes`, keeping
  the profile header and existing tab URL contract intact.
- Replace demo-only local Starred filtering with server-backed data while
  retaining the existing drawer entry and destination.
- Add the Like visibility preference to the existing Privacy settings section
  and persist it through the API with the existing save/toggle feedback pattern.
- Handle cursor resets, in-flight request guards, duplicate rows, search
  debounce, end-of-list state, and unmount cleanup in the modal/list surfaces.

## Acceptance and end-to-end verification

Before considering this feature complete, verify with API tests and a real
authenticated request/response flow:

1. Create two users and posts; Like, Unlike, Star, and Unstar each post.
2. Confirm duplicate and concurrent-like attempts leave one relation and the
   correct count.
3. Confirm self-Like increments the count without creating a notification.
4. Confirm another user's Like increments the count and creates one in-app
   notification for the owner; UnLike leaves that notification intact.
5. Confirm Stars change counts but never create owner notifications.
6. Confirm post responses expose counts and viewer state only to authenticated
   users.
7. Confirm the Like modal searches the database, paginates with a cursor,
   reuses ProfileCard, and excludes private/blocked/privacy-disabled actors.
8. Confirm the privacy toggle hides the user's identity and profile Likes tab
   from other signed-in users while preserving counts and the owner's own view.
9. Confirm `/starred` shows only the current user's Starred posts and does not
   accept another user's identity as a filter.
10. Confirm deleted/private/blocked posts disappear from reaction lists and
    direct access renders the neutral unavailable state.
11. Confirm the action-row layout at mobile, tablet, and desktop widths and
    keyboard activation/labels for every reaction and count control.
12. Run the focused API tests, web TypeScript check, production build, and
    browser end-to-end flow after the implementation.

## Risks and limitations

- Denormalized counters can drift after an operational failure. Add a later
  reconciliation job or admin check before treating counters as permanent
  analytics.
- Cursor pages can shift when new reactions arrive during scrolling. Resetting
  on a new search and de-duplicating client rows is sufficient for the first
  release.
- Filtering private, blocked, and privacy-disabled actors means a visible Like
  count may be larger than the number of names in the modal. This is intentional
  and avoids exposing hidden users.
- Optimistic controls can briefly disagree across tabs. The next server refresh
  is authoritative; realtime synchronization is intentionally deferred.
- The first privacy preference is account-wide. Per-post paid privacy and
  granular actor-list policy are future extensions, not current behavior.
