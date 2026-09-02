# Friink Blocking

Verification status: focused end-to-end blocking test passes; existing chat request regression passes; web TypeScript check and production build pass.

Status: implementation scope and technical contract.

## Requirements

- A signed-in user can block another user from that user's profile overflow menu,
  regardless of follow state, chat state, or subscription tier.
- Blocking is confirmed in the shared modal and explains that profiles become
  unavailable, follows are removed, and existing chats become read-only.
- A block is mutual for access control: neither person can view the other's
  profile, follow, or send messages. Existing chats remain visible and readable;
  their composer is disabled with `Chat unavailable.` Pending requests remain in
  Requests but are read-only.
- Blocking removes accepted and pending follow relationships in both directions.
  Unblocking never restores them. Existing messages and historical notifications
  are retained; blocking creates no notification.
- Privacy settings contains a Blocked people action. It opens the existing modal,
  shows a searchable, cursor-paginated list, and allows unblocking with
  confirmation. The list is database-backed: search is case-insensitive partial
  matching on username and display name, not filtering only loaded rows.
- The blocked list loads more rows on demand, has no page numbers, preserves the
  search query while loading, and says `Not found.` for an empty result.
- Blocked-list profile cards remain clickable, but the destination renders the
  neutral `Profile unavailable.` state. Direct URL access has the same result.

## Scope

In scope: block/unblock persistence, transactional relationship cleanup,
profile access protection, profile action-menu confirmation, Privacy blocked-list
modal with debounced DB search and infinite loading, and existing chat enforcement.

Out of scope: reporting, appeals, moderation tooling, bulk actions, restoring
relationships, deleting messages, hiding historical notifications, and realtime
block events. A currently open page learns about changes on its next relevant
request/poll.

## Technical implementation

- `user_blocks(blocker_id, blocked_id)` is the durable directional record with a
  unique pair constraint. Access checks query both directions.
- `POST /users/{username}/block` inserts the pair idempotently and, in the same
  transaction, deletes accepted/pending follow requests in both directions.
- `DELETE /users/{username}/block` removes only the current user's block pair.
- `GET /users/blocked?query=&cursor=&limit=` returns newest blocks first with an
  opaque cursor and `next_cursor`; query matching is performed by the API/DB.
- Public profile lookup returns a non-identifying unavailable response when the
  viewer is blocked by or has blocked the profile owner. This avoids revealing
  which side created the block.
- All block mutations are authenticated and reject self-blocking. Chat's existing
  bilateral block check remains the server authority for send/read policy.
- The frontend uses shared `ActionMenu`, `Modal`, `ProfileCard`, `ListRow`, and
  global search styling. It never treats a disabled composer as authorization;
  the API remains authoritative.

## Limitations and noteworthy decisions

- Cursor results can change order if more blocks are created while scrolling;
  refresh/search resets the cursor and de-duplicates rows.
- There is no block notification. Unblock is explicit and does not undo follow
  cleanup.
- The existing block table is already present from chat infrastructure, so this
  feature should not require a schema migration unless the model contract changes.
