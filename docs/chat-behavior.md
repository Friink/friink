# Friink Chat Behavior

Status: Implementation scope for the chat-request feature.

Date: 2026-09-02

## Product scope

Friink chat has two entry paths:

1. Users who mutually follow each other can open a chat and message immediately.
2. A user with a paid chat-request entitlement can message a non-mutual user. The
   first message creates a request; the requester may send at most eight messages
   while the request is pending. The receiver can accept with an Accept action or by
   replying. A reply accepts automatically. Acceptance unlocks ordinary two-way chat
   and notifies the requester unless that requester muted the conversation.

Free users cannot create a request. Their direct chat route still loads, but the
composer is disabled with a generic placeholder. Blocked users cannot view each
other's profiles, but an existing chat remains readable and the composer is disabled.
Block-management UI is outside this implementation and the block table/API are
provided as infrastructure for the later profile-menu feature.

Chat messages accept up to 2,048 Unicode characters. The chat composer always shows
a `count/2048` counter and enforces the same limit before submission.

## Conversation state

Conversation access state is independent from per-user presentation state:

- `pending`: a paid requester has sent at least one message and the receiver has not
  accepted. The conversation appears in Requests for both users, not All Chats.
- `accepted`: mutual follow or request acceptance has unlocked ordinary chat. The
  conversation appears in All Chats unless archived by the viewer.
- `blocked`: an existing conversation is readable by both participants, but sending
  is rejected and the UI uses `Chat unavailable.`.

There is intentionally no declined state. A receiver may mute a request instead of
declining it, preserving the request and suppressing notifications. The receiver may
still accept or reply later.

## Composer states and copy

- Mutual accepted follows or accepted request: enabled, `Write a message...`.
- Receiver of a pending request: enabled, `Reply to accept.`.
- Paid requester before message eight: enabled, `Write a message...`.
- Paid requester after eight requester-authored messages: disabled, `Request pending.`.
- Free non-mutual user: disabled, generic existing unavailable placeholder.
- Blocked existing chat: disabled, `Chat unavailable.`.

The composer must not be disabled merely because conversation discovery or message
history loading failed. Transport/API errors are shown as errors and remain distinct
from policy state. The backend remains authoritative for every send.

## Requests, chats, and tabs

Pending requests are visible to both participants in Requests. Once accepted, the
request leaves Requests and appears in All Chats. Accepted conversations are filtered
by the viewer's archive state:

- All: active, non-archived accepted chats.
- Muted: any muted chat, regardless of whether it is accepted or pending.
- Requests: pending chats, including muted pending requests.
- Archived: archived chats; archiving also mutes the chat.

Unarchiving removes the archive-implied mute. A user mute survives unarchiving.
Mute and archive are per-user settings and can coexist.

## Notifications

Chat notifications are created for request receipt, new messages, and request
acceptance. A conversation mute suppresses all chat notifications for the user who
muted it; it does not affect the other participant. Existing notification polling and
read behavior remain in use.

## Technical design

- `Conversation.status` and `Conversation.requester_id` model pending versus accepted
  state. A single conversation remains the durable thread for a user pair.
- `Conversation.requester_message_count` is incremented only for requester-authored
  messages while pending and is enforced transactionally at eight.
- `ConversationSetting` stores per-user `muted`, `archived`, and whether mute was an
  explicit user choice. Archive-implied mute can therefore be removed on unarchive
  without clearing an explicit mute.
- `UserBlock` stores future block relationships. Chat access checks it now; profile
  hiding and block controls are a later feature.
- `User.subscription_tier` is the future entitlement boundary. Chat calls a small
  capability function (`can_initiate_chat_request`) rather than embedding billing
  logic. Until subscriptions are populated, users default to `free`.
- Conversation discovery returns policy/context data separately from transport
  failures. A non-entitled non-mutual route can render the participant and a disabled
  composer without manufacturing a pending conversation.
- The existing polling transport remains unchanged in concept: it polls only an
  accepted or pending conversation with a real conversation ID and pauses while hidden.
  The `/chat` conversation-list screen also polls `GET /chat/conversations` every
  four seconds while visible. It pauses while the document is hidden, resumes
  immediately on visibility/focus recovery, cancels on unmount, preserves the active
  All/Muted/Requests/Archived tab, and refreshes previews, ordering, unread counts,
  and row state.
  Read receipt behavior and cursor persistence are specified separately in
  `docs/read-receipts.md`.

## Out of scope and limitations

- Subscription checkout, payment processing, entitlement administration, and paid-plan
  UI are not implemented here.
- Profile hiding and the three-dot block action are not implemented here; the block
  persistence and chat enforcement boundary are added for future work.
- Request limits are currently fixed at eight requester messages but must remain a
  named service constant so a future plan can change the limit.
- There is no decline action or declined-request state.
- Message editing, deletion, attachments, read receipts, typing indicators, and
  WebSocket delivery remain out of scope.
