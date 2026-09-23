# Chat

Chat provides conversations, messages, requests, read receipts, mute/archive
settings, and policy-aware access between Friink users.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-23T01:20:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns conversation and message behavior, chat access policy,
request state, read state, and per-conversation settings. [Connections](./connections.md)
owns follow relationships; [Blocking](./blocking.md) can restrict chat access.

## Related units

- [Connections](./connections.md) — mutual accepted follows enable ordinary chat.
- [Blocking](./blocking.md) — blocking makes existing chats read-only.
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
  when needed. The relative date appears on the second line, aligned to the
  right; Muted and Archived remain represented by their dedicated tabs rather
  than row labels.
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

## UX and flows

The chat list is at `/chats`; filters are All, Muted, Requests, and Archived.
Conversation rows show the participant's display name once, an avatar-only
profile link, and the latest message preview beside the name on the first line.
Long previews truncate with an ellipsis. The relative date remains on the
second line and is aligned to the right. Muted and Archived are tab-level
filters and are not repeated as row metadata. Mute and archive controls are
borderless contextual icon actions with accent hover, focus, and active states.
Conversations use `/{username}/chat`. The composer communicates policy states
such as `Reply to accept.`, `Request pending.`, and `Chat unavailable.`. Own
messages use single/double receipt ticks for sent/delivered/read, and unread
messages use a separator and conversation-row state line.
The chat composer supports up to eight image attachments with the shared
post-media compression target; attached images render in the message bubble.
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
`web/lib/chat-transport.ts` and adaptive polling. Conversation settings include
mute and archive. Read operations use per-user cursors and server checks.

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
- [x] **CHAT-AC-008** Conversation rows remove duplicate identity content,
  expose unread/receipt state in the secondary line, and use borderless
  accent-reactive mute/archive actions.
- [x] **CHAT-AC-009** Chat image attachments use the shared compression preset,
  enforce the eight-image limit, and remain associated with the authenticated
  message after upload.

## Known limitations

Delivery is REST/polling-based; realtime push transport is not implemented.
