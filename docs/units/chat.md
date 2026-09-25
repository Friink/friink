# Chat

Chat provides conversations, messages, requests, read receipts, mute/archive
settings, and policy-aware access between Friink users.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-25T01:00:36Z
**Platforms:** Web and API

## Canonical ownership

This document owns conversation and message behavior, chat access policy,
request state, read state, and per-conversation settings. [Connections](./connections.md)
owns follow relationships; [Blocking](./blocking.md) can restrict chat access.

## Related units

- [Connections](./connections.md) — mutual accepted follows enable ordinary chat.
- [Blocking](./blocking.md) — blocking makes existing chats read-only.
- [Search](./search.md) — owns global search visibility consumed by chat discovery.
- [Notifications](./notifications.md) — consumes chat unread/request events.
- [Settings](./settings.md) — exposes read-receipt preference.
- [Subscriptions](./subscriptions.md) — contributes paid requester policy.
- [Design System](../design-system.md) — owns shared composer, rows, and receipts.

## Rules

- **CHAT-R-001:** Mutual accepted follows enable ordinary direct chat.
- **CHAT-R-002:** A user with the server-resolved `message_requests`
  entitlement may initiate a non-mutual request subject to the requester
  message cap; the receiver must accept or reply as specified.
- **CHAT-R-003:** Pending requests appear in Requests; accepted conversations
  appear in All; mute and archive affect placement/notifications, not ownership.
- **CHAT-R-004:** Read receipts are tracked per user with server-authoritative
  cursors. Delivered and read are distinct states.
- **CHAT-R-005:** Visible-app polling is adaptive and pauses while hidden;
  focus/visibility recovery refreshes state.
- **CHAT-R-006:** Transport failure must remain distinct from policy-disabled
  composer state.
- **CHAT-R-007:** Blocked or no-longer-mutual chats remain readable but read-only
  where the active blocking contract requires it.
- **CHAT-R-008:** Conversation-list transport failures render an in-app error
  state with a retry action; they must not surface as an uncaught runtime
  overlay or be mistaken for an empty chat list.
- **CHAT-R-009:** Conversation rows render the participant name and latest
  message preview on the first line, truncating the preview with an ellipsis
  when needed. The row keeps the full ProfileCard identity on the left; its
  flexible middle column contains the preview, relative date, and unread or
  receipt state, while the overflow action menu contains Mute, Archive, and
  Block.
- **CHAT-R-010:** Direct conversation pages use the document viewport as their
  only vertical scroll surface. The participant header is fixed below the
  global top bar and aligned to the centered chat content column; the message
  list does not create a nested scrollbar, and the shared content-width cap
  remains intact. On desktop, the header surface covers the full main panel
  while its participant content remains aligned to the centered chat column.
  The fixed composer remains clear of the final messages with a consistent
  1rem gap after the last message across viewport sizes.
- **CHAT-R-011:** Direct conversation pages restore the authenticated session
  through the shared refresh flow when a full browser refresh clears the
  in-memory access session. A terminal refresh failure routes to login; a
  successful refresh keeps the user on the requested conversation.
- **CHAT-R-012:** Chat messages may include up to eight images. The shared
  composer prepares them with the post-media JPEG preset before authenticated
  chat-media upload and confirmation; text-only and media-only messages are
  valid.
- **CHAT-R-013:** Attached chat images render as a deterministic gallery: one
  image uses a contained frame, two to four images use balanced tiles, and
  larger attachments show four tiles with a `+N` overflow indicator. Selecting
  any tile opens the shared full-screen image viewer.
- **CHAT-R-014:** Existing conversations use `/chats/{conversation_id}` as the
  canonical web route. Username chat routes resolve through the authenticated
  chat API and redirect to the conversation ID when a conversation exists;
  bare `/{conversation_id}` remains a profile route.

## UX and flows

During client-side route changes, each account/conversation retains its draft
and pending-message UI state in the root shell-state provider. Sends carry a
stable `client_message_id`; the API deduplicates retries for the same
conversation and echoes that ID so the client can reconcile the result after
remount. This in-memory continuity does not cover a full document reload.

The chat list is at `/chats`; filters are All, Muted, Requests, and Archived.
Conversation rows show the full participant ProfileCard once, including the
picture, display name, enabled badges, and username. The flexible middle
column shows the latest message preview for up to two lines, truncating longer
content with an ellipsis, followed by the message date/time and unread or
receipt state. An overflow action menu provides Mute, Archive, and Block.
Muted and Archived are also tab-level filters and are not repeated as row
metadata.
Conversations use `/chats/{conversation_id}`. The legacy `/{username}/chat`
and `/chats/{username}` routes resolve through the authenticated chat API and
redirect to the canonical ID route when a conversation exists; a username route
remains available for a not-yet-created request conversation. `/chat` redirects
to `/chats`, and `/chat/new` redirects to `/chats/new`. The composer communicates policy states
such as `Reply to accept.`, `Request pending.`, and `Chat unavailable.`. Own
messages use single/double receipt ticks for sent/delivered/read, and unread
messages use a separator and conversation-row state line.
The chat composer supports up to eight image attachments with the shared
post-media compression target; attached images render in a bounded
message-bubble gallery. One image preserves its aspect ratio inside a
contained frame; multiple images use balanced square tiles with a `+N`
overflow indicator after the fourth image. Selecting a tile opens the
full-screen viewer with keyboard navigation and a counter.
The direct conversation page uses the document scrollbar for the message
history. On a full browser refresh, the route restores the authenticated
session through the shared refresh flow before loading the conversation. The
participant card remains fixed below the global top bar, aligned with the
centered chat content column, while the conversation is scrolled. On desktop,
the fixed header background spans the main panel so messages cannot show
through beside the capped content column. The shared content-width cap is
preserved and no inner chat scrollbar is rendered. Shared shell bottom padding
is removed for this route so it does not compound the message-list reservation;
the final message remains 1rem above the floating composer.

## Technical contract

REST endpoints live in `api/app/routers/chat.py`; the web transport uses
`web/lib/chat-transport.ts` and adaptive polling. `GET
/chat/conversations/{conversation_id}` loads an authorized canonical
conversation context, while the existing username resolver preserves the
current access and request rules. Conversation settings include mute and
archive. Read operations use per-user cursors and server checks.

## Acceptance criteria

- [ ] **CHAT-AC-001** Ordinary access requires mutual accepted follows.
- [x] **CHAT-AC-002** Request and paid-tier message limits are enforced
  server-side from the subscription entitlement contract.
- [ ] **CHAT-AC-003** Delivered and read states remain distinct.
- [ ] **CHAT-AC-004** Hidden-tab polling pauses and recovery refreshes state.
- [ ] **CHAT-AC-005** Transport failure never invents a policy state.
- [ ] **CHAT-AC-006** Blocking preserves required read-only history behavior.
- [ ] **CHAT-AC-007** A conversation-list timeout or transport failure shows a
  recoverable error state with Try again.
- [x] **CHAT-AC-008** Conversation rows use one full ProfileCard, expose the
  latest message/date/unread-or-receipt stack in the middle, and provide Mute,
  Archive, and Block through one overflow action menu.
- [x] **CHAT-AC-009** Chat image attachments use the shared compression preset,
  enforce the eight-image limit, and remain associated with the authenticated
  message after upload.
- [x] **CHAT-AC-010** Canonical conversation-ID loading is authorized by the
  API, username aliases redirect when an ID exists, and `/chat` plus
  `/chat/new` remain compatibility redirects.
- [x] **CHAT-AC-011** Client-side navigation preserves the active
  account/conversation draft and pending send ID; retrying a send with the same
  ID returns the original message instead of creating a duplicate.

## Known limitations

Delivery is REST/polling-based; realtime push transport is not implemented.
The current conversation-list rows still show the username as part of the
full ProfileCard. A follow-up mobile-first refinement is proposed to omit the
username from list rows, giving the latest message more room; usernames remain
available in the conversation header and profile view. This proposal is not
implemented yet.

## Planned evolution: ID-based conversations and group-ready backend

This section records implementation status and planned work. It is not an active rule in
[`docs/rules.md`](../rules.md) until the implementation and verification are
complete.

### Implemented URL and compatibility model

The canonical conversation route is `/chats/{conversation_id}`, where
`conversation_id` is the existing conversation UUID. The inbox remains
`/chats`, and `/chats/new` is reserved for the one-to-one
conversation-starting flow implemented in the next UX phase. The profile entry
point `/{username}/chat` and compatibility form `/chats/{username}` use the
authenticated username resolver and redirect to the canonical conversation ID
when an existing conversation is returned. If no conversation exists yet, the
username route remains available so the existing request-on-first-message
behavior is preserved. A bare `/{conversation_id}` remains a profile namespace
and is not treated as a chat URL.

### `/chats/new` flow (implemented on staging)

The first version remains one-to-one only. It opens a modal with one search
field. After two characters, a debounced chat-specific endpoint returns up to
20 active, unblocked people matching username or display name. Public profiles
are discoverable; a private profile appears only when the viewer has an
accepted follow relationship to that profile. The user selects one person and
receives immediate eligibility feedback from a read-only server check.
`Next` repeats that check and then uses the chat resolver for the final
authoritative decision. The API applies the existing access rules:

- Mutual accepted follows open an accepted conversation.
- A user with the `message_requests` entitlement may start a pending request
  subject to the existing requester message cap.
- A receiver of a pending request sees the existing `Reply to accept.` state.
- Free non-mutual users, blocked users, and unavailable conversations receive
  the existing restricted or unavailable state.
- If the direct conversation already exists, the flow redirects directly to
  `/chats/{conversation_id}`.
- A new request-eligible direct chat continues through the username route so
  the conversation is created by the first message. A pending request receiver
  can open the existing canonical conversation without accepting it merely by
  selecting the person.
- Search, empty, unavailable, and validation states remain neutral and
  retryable. Switching accounts clears the query, result list, selection, and
  eligibility result. Closing the modal returns to `/home`.

Selecting more than one username remains unavailable until group-chat rules
and UX are explicitly launched. The server, not only the frontend, must reject
group creation while the feature is disabled.

### Settled `/chats/new` UX decisions

- Search begins after two characters, since usernames are defined with a
  minimum two-character prefix. Results are shown in a scrollable suggestion
  list and include the profile picture, display name, and username to avoid
  ambiguity.
- Search may match usernames and display names, but autocomplete inherits the
  existing Search visibility rules. Unauthorized private, blocked, deactivated,
  and pending-deletion users are excluded. A private user may appear only when
  the viewer is already authorized to see that identity; chat eligibility is
  still evaluated separately by the server.
- Selecting a person starts immediate server validation for responsive
  eligibility feedback. `Next` performs a final authoritative validation
  before navigation, so client state cannot bypass chat policy.
- Existing conversations redirect to `/chats/{conversation_id}`. Opening a
  pending request opens the chat but does not accept it; the existing request
  state and `Reply to accept.` behavior remain visible.
- Declined requests follow the existing Chat business rule and are not
  silently restarted by this flow.
- Restricted, blocked, or otherwise unavailable cases use a neutral message
  rather than revealing relationship or privacy details.
- The modal has a close control. Closing `/chats/new` without entering a chat
  returns the user to `/home`; selecting a second person is prevented while
  group chats are unavailable.
- `/chat` redirects to `/chats`, and `/chat/new` redirects to `/chats/new` as
  compatibility aliases. Browser Back closes the modal before leaving the
  Chats surface when the modal is represented in history.
- `Next` is disabled while immediate eligibility validation is loading. The
  selected person's identity remains visible while validation runs, and an
  active-account change clears the selection and its validation result.
- The first version uses a chat-specific people-search contract that reuses
  the existing Search visibility policy rather than expanding global Search
  with live suggestions.

### Planned backend foundation deliverables

1. **Conversation membership schema — implemented on `development`:** Added
   `conversation_type` (`direct` or `group`) and a `conversation_members`
   table containing conversation ID, user ID, role, join/leave timestamps, and
   composite membership uniqueness. Existing direct conversations are
   backfilled with exactly two member rows without changing their IDs. The
   current pair columns remain in place for compatibility. The migration is
   applied to development, staging, and production; group-chat behavior remains
   controlled separately by the disabled-by-default feature flag.
2. **Member-based authorization — implemented on the staging branch:** Move
   conversation access, message sending, list queries, and direct-chat
   resolution to membership while preserving direct-chat policy.
3. **Disabled group capability — implemented on the staging branch:** Add
   server-side group creation and member operations behind a feature flag that
   defaults to false. The backend rejects disabled group operations directly.
4. **Shared conversation behavior — implemented on the staging branch:** Make
   unread counts, read receipts, mute/archive settings, notifications, polling,
   and media access member-aware while keeping the canonical conversation route.
5. **Migration and release verification — in progress:** The migration gate is
   applied and `alembic check` passes at the repository head in development,
   staging, and production. Production's schema is current; this database-only
   migration did not deploy application code or enable group chat. Still verify
   direct-chat regressions and authorization, the disabled group API, and
   complete staging acceptance before promoting application code to production.

**Staging smoke-check record (user-reported):** One message send succeeded on
staging during the 2026-09-23/24 local session; the exact event time and request
details were not captured. This single send does not close Phase 5. The user
reported that the `/chats/new` flow is being tested; no result has been
recorded yet.

### Planned migration constraints

Conversation IDs remain stable through the membership migration. Existing
one-to-one conversations are represented by exactly two active membership rows.
The pair columns remain as compatibility fields for direct chats; group rows
use null pair values. The follow-up migration replaces global pair uniqueness
with a direct-only unique index and checks pair-column shape by conversation
type. Authorization, conversation lists, direct resolution, message access,
search, notification fan-out, and read state use active membership rows.
Production migration was applied through the repository deployment gate;
staging and production databases remain separate. Schema migration alone does
not promote application code or enable group chat.

### Membership-backed service behavior (implemented on the staging branch)

- Existing direct conversations have two active membership rows from the
  foundation backfill. Newly created direct conversations write both rows in
  the same transaction.
- Conversation-ID authorization and conversation lists require an active
  membership row. A departed member loses access to the conversation and its
  message/media history.
- Unread and delivered/read cursors remain per member. Group receipt state is
  `read` only after every active recipient has read the message and `delivered`
  only after every active recipient has received it. Each member's setting and
  read-receipt preference is respected.
- Group notifications fan out to active members other than the sender and
  respect each recipient's mute/archive setting. Message history and media are
  returned only through membership-authorized conversation endpoints.
- `GROUP_CHAT_ENABLED` defaults to `false`. While false, group creation,
  member changes, group conversation reads, and group search are rejected or
  omitted by the API. The web client does not expose group creation.
- When enabled after the release gate, the API supports creation with a
  creator and at least two invitees, adding members, removing/leaving, and role
  changes. The creator starts as admin; admins manage members. If the last
  admin leaves, the earliest active member becomes admin. Groups cannot include
  inactive/deleted, blocked, or private profiles the actor cannot see. The
  request bound is 100 total members.
- Enabling group chat requires separate product approval and the migration/
  release gate.

### Recommended implementation breakdown

The work should be delivered in five bounded workstreams:

1. **Conversation data foundation — complete on `development`:** Add the
   conversation type and membership schema, backfill direct conversations,
   preserve IDs, and retain pair-column compatibility until all reads and
   writes have moved to membership data.
2. **Canonical routing and resolver — complete on `development`:** Added
   `/chats/{conversation_id}` and the reserved `/chats/new` route, preserved
   username aliases with authenticated resolution, added the ID context API,
   and made `/chat`/`/chat/new` compatibility redirects.
3. **New-chat discovery UX — implemented on staging:** Build the modal, two-character debounced search,
   scrollable profile-rich suggestions, single-person selection, immediate
   eligibility feedback, loading/empty/error states, account-switch reset,
   close behavior, and keyboard/mobile accessibility.
4. **Policy and shared behavior migration — implemented on the staging branch:** Move authorization, conversation
   lists, requests, unread state, receipts, mute/archive, notifications, and
   media access to membership-aware services. Add disabled group endpoints
   behind `GROUP_CHAT_ENABLED=false`; do not expose group selection in the UI.
5. **Verification and release — in progress:** The staging database is at the
   repository migration head and the migration gate passes. Cover direct-chat
   regressions, privacy and account isolation, duplicate/concurrent starts,
   every eligibility state, route aliases, disabled group endpoints, and
   staging acceptance before promotion.
