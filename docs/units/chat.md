# Chat

Chat provides conversations, messages, requests, read receipts, mute/archive
settings, and policy-aware access between Friink users.

**Status:** Active  
**Tier:** Full  
**Last edited:** 2026-09-21T00:00:00Z
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
- **CHAT-R-002:** A paid-tier user may initiate a non-mutual request subject to
  the requester message cap; the receiver must accept or reply as specified.
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
- **CHAT-R-009:** Conversation rows render identity once and use the secondary
  line for conversation state; Muted and Archived remain represented by their
  dedicated tabs rather than row labels.
- **CHAT-R-010:** Direct conversation pages use the document viewport as their
  vertical scroll surface. The participant header, message history, and page
  content must not create a nested message-only scrollbar; the fixed composer
  remains clear of the final messages.

## UX and flows

The chat list is at `/chats`; filters are All, Muted, Requests, and Archived.
Conversation rows show the participant's display name once, an avatar-only
profile link, and a state line: an unread count (`New message` or `N new
messages`), `Seen`/`Delivered`/`Sent` for the user's latest outgoing message,
or the latest incoming message preview. Muted and Archived are tab-level
filters and are not repeated as row metadata. Mute and archive controls are
borderless contextual icon actions with accent hover, focus, and active states.
Conversations use `/{username}/chat`. The composer communicates policy states
such as `Reply to accept.`, `Request pending.`, and `Chat unavailable.`. Own
messages use single/double receipt ticks for sent/delivered/read, and unread
messages use a separator and conversation-row state line.
The direct conversation page scrolls as one document, so the participant
header and message history share the browser/app scrollbar rather than placing
scrolling inside the message list.

## Technical contract

REST endpoints live in `api/app/routers/chat.py`; the web transport uses
`web/lib/chat-transport.ts` and adaptive polling. Conversation settings include
mute and archive. Read operations use per-user cursors and server checks.

## Acceptance criteria

- [ ] **CHAT-AC-001** Ordinary access requires mutual accepted follows.
- [ ] **CHAT-AC-002** Request and paid-tier message limits are enforced server-side.
- [ ] **CHAT-AC-003** Delivered and read states remain distinct.
- [ ] **CHAT-AC-004** Hidden-tab polling pauses and recovery refreshes state.
- [ ] **CHAT-AC-005** Transport failure never invents a policy state.
- [ ] **CHAT-AC-006** Blocking preserves required read-only history behavior.
- [ ] **CHAT-AC-007** A conversation-list timeout or transport failure shows a
  recoverable error state with Try again.
- [x] **CHAT-AC-008** Conversation rows remove duplicate identity content,
  expose unread/receipt state in the secondary line, and use borderless
  accent-reactive mute/archive actions.

## Known limitations

Delivery is REST/polling-based; realtime push transport is not implemented.
