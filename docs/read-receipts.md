# Friink Read Receipts

Status: Implementation scope for chat delivery and read state.

Date: 2026-09-02

## Product scope

- Chat messages use three receipt states: sent, delivered, and read.
- A single grey tick means the API accepted the message.
- Double grey ticks mean the recipient's visible Friink app inbox sync or open
  conversation fetched the message.
- Double accent-colored ticks mean the recipient read the message.
- Polling remains the delivery mechanism; no WebSocket is required.
- The existing 4-second polling interval remains unchanged.

## Read behavior

- Delivery is recorded when a visible authenticated app sync discovers the incoming
  message through the conversation list, or when the full conversation endpoint
  fetches it. A conversation-list sync never marks a message read.
- Read state is based on messages reached while the conversation is visible.
- Opening a pending request can mark visible messages as read without accepting it.
- Reading a request never implies acceptance; replying or pressing Accept still accepts.
- Read cursors advance monotonically and apply to every earlier message in the thread.
- If messages 1–5 are read and 6–8 arrive later, 1–5 are read and 6–8 remain unread.
- A user's own outgoing messages are never counted as unread for that user.

## Unread indicators

- Unread counts include only incoming messages.
- Conversation rows show a pill containing the unread message count.
- An open conversation shows an `Unread messages` separator before the first unread message.
- The row pill disappears when the unread count reaches zero.
- Receipt and unread state synchronizes across refreshes, devices, and browser tabs.

## Requests, mute, archive, and blocking

- Pending message requests use the same delivery and read receipt behavior as ordinary chats.
- Mute suppresses notifications only; it does not suppress delivery, read state, or unread counts.
- Archive changes organization only; it does not change receipt behavior.
- Blocked conversations remain readable but cannot send messages.
- While a block is active, read receipts are not exposed to either participant to avoid
  revealing activity after blocking.
- While a block is active, delivery does not advance either: inbox sync and message
  fetches leave existing messages at the sent/single-tick state, preventing activity
  from leaking through delivery ticks.

## Privacy

- Each user has a persisted `read_receipts_enabled` setting, defaulting to true.
- The setting is available now in Settings > Privacy and is backed by authenticated
  GET/PATCH preference endpoints.
- Privacy is mutual: a user can see read receipts only when both participants have
  read receipts enabled.
- Disabling read receipts hides read state from the other participant and also hides
  that participant's read state from the user.
- Delivery state remains separately visible when read receipts are disabled.

## Message contract

- Chat messages accept up to 2,048 Unicode characters.
- The chat composer always shows a `count/2048` counter and enforces that limit.

## Technical implementation

- Store per-user conversation cursors: `last_delivered_message_id` and
  `last_read_message_id`.
- Store `read_receipts_enabled` on the user so the Privacy settings UI can update it
  without changing conversation records.
- The message page returns receipt metadata even when no new messages are returned,
  allowing polling to update tick colors.
- The app shell runs the inbox sync every four seconds while visible outside the
  Chat screen; the Chat screen reuses its existing list poll while open. Hidden
  documents pause the sync and focus/visibility recovery resumes it immediately.
- The mark-read endpoint is idempotent and refuses to move a cursor backward.
- The client marks messages read only while the conversation is visible and messages
  are reached in the scroll viewport.
- Receipt state is calculated relative to the other participant and never trusted from
  client-submitted status fields.

## API surface

- `GET /chat/conversations/{id}/messages` returns messages, unread metadata, and the
  viewer-relative peer receipt cursors.
- `POST /chat/conversations/{id}/read` advances the viewer's read cursor.
- `PATCH /chat/preferences/read-receipts?enabled={true|false}` updates the persisted
  privacy preference used by Settings > Privacy.

## Out of scope

- WebSockets or sub-second receipt delivery.
- Typing indicators, presence, reactions, editing, deletion, or manual unread toggles.
- Additional privacy controls beyond the read-receipt setting.
- Push, email, or external read-receipt notifications.
