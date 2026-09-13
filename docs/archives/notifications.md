# Notifications

## Purpose

Notifications give a user one place to see meaningful activity, security
events, and requests that need action. The feature should feel calm and useful:
the unread indicator is immediate, the dropdown is a quick preview, and the
full Notifications page is the source for reading and managing notification
history.

This contract covers the authenticated web experience and the existing
notification API. It does not introduce push notifications, email delivery, or
new notification-producing business rules.

## Surfaces

### Header dropdown

- The header bell shows a green dot when the unread count is greater than zero.
- The numeric pill shows the actual unread count, using `99+` above 99.
- When there are no unread notifications, opening the dropdown shows the shared
  `Nothing to show.` empty state. Read notifications must not populate the
  dropdown.
- When unread notifications exist, the dropdown shows unread items only,
  ordered newest first. It may show up to four items initially and becomes
  vertically scrollable when more unread items are available.
- The dropdown retains an `All Notifications` action that opens `/notifications`.
- Opening the bell does not mark anything read.
- Selecting a dropdown item may navigate to its destination or to the full
  Notifications page, but does not mark the item read. Read state is owned by
  the full Notifications page rule below.
- Dropdown actions such as Accept, Decline, or Reply remain usable in place.
  Performing an action does not by itself mark the notification read.

### Notifications page

- The canonical route is `/notifications`.
- The page uses the existing `NavigationBar`, `Tabs`, `PageSurface`, `ListRow`,
  `ProfileCard`, and `ActionMenu` components. No notification-specific visual
  system is introduced.
- The page has two tabs: `All` and `Security`.
- The overflow menu provides `Show unread only` / `Show all notifications` and
  `Mark all as read`.
- `All` includes all notification kinds. `Security` includes security
  notifications, including login-security events and future security events
  classified by the API.
- The unread-only filter applies within the selected tab. If no items match,
  show the appropriate empty state.
- Informational notifications link to their canonical destination when one is
  available. Profile identities link to the relevant profile.
- Pending private follow requests and chat requests expose their available
  actions inline on both the full page and the dropdown.

## Read-state contract

- Opening the bell does not mark notifications read.
- Opening the Notifications page alone does not mark every notification read.
- A notification becomes read only when it is meaningfully visible in the full
  Notifications list, such as after the user scrolls it into view, or when the
  user explicitly uses `Mark all as read`.
- Clicking a dropdown item, navigating directly to a destination, or opening a
  notification detail does not replace the full-list read rule.
- A notification action may update the related request state, but action
  completion does not replace the full-list read rule.
- Read state is persisted through the existing single-notification and
  mark-all API operations. Failed read requests must not silently claim that
  the server has accepted the change; the next authoritative refresh must be
  allowed to reconcile the UI.
- Read state is per user. A user cannot mark another user's notification read.

## Notification categories

The API notification type remains authoritative. The web groups the existing
types into these user-facing categories:

| Category | Examples | Default behavior |
| --- | --- | --- |
| Social activity | Follow, new follower, like, reply, mention | Link to the profile or post |
| Requests | Private follow request, chat request | Show the available inline action |
| Security | Login security, login approval, verification/security events | Show in Security and All |
| Service/platform | Account or platform messages | Link to the relevant destination when available |

Unknown or future API types must remain safely renderable with a generic
notification icon and copy supplied by the API/client mapping. They must not
break the list or cause an unsafe navigation.

## Polling and freshness

- The unread count is polled every four seconds while the authenticated app is
  active and the document is visible.
- Polling pauses while the document is hidden and resumes immediately on focus
  or visibility recovery.
- Poll requests are deduplicated while one request is in flight. Transient
  failures use the existing adaptive backoff and must not clear a known-good
  count or notification list.
- The full notification list refreshes while `/notifications` is open.
- Existing unread notifications establish a silent baseline when the app starts
  or refreshes. They must not produce historical toasts.
- A toast is reserved for a genuinely new important notification, is emitted at
  most once per notification ID in the current client session, and must not
  appear randomly on ordinary polling cycles.
- Polling changes the displayed count; it does not mark notifications read.

## Inline actions and navigation

- Follow requests support the existing Accept and Decline operations.
- Chat requests support the existing Accept and Decline operations and retain
  the chat-request policy already documented in `docs/chat-behavior.md`.
- Actions disable only the affected action while pending and show a visible
  busy state. Other notifications remain usable.
- Successful actions refresh or reconcile the affected notification and related
  request state. Failed actions preserve the notification and show recoverable
  feedback.
- Informational item activation closes the dropdown before navigation and uses
  the canonical route supplied by the existing app navigation rules.

## API and data boundaries

The feature reuses the existing authenticated notification operations:

- `GET /notifications` for the paginated feed
- `GET /notifications/unread-count` for the bell count
- The existing single-read operation for a notification
- The existing mark-all-read operation
- Existing connection and chat request operations for inline actions

The API remains authoritative for ownership, unread state, pagination, action
authorization, and destination identifiers. The client must not infer unread
state from timestamps, local-only notification creation, or the presence of a
dropdown row.

Feed pagination defaults to 20 items and clamps at 100. The client may request
up to 40 items for the current full-list refresh, but the dropdown is a filtered
presentation of unread items and must not turn that fetch limit into a visible
four-item read-history list.

## Failure and fallback behavior

- If unread-count polling fails, retain the last known count and retry with the
  existing backoff. Do not show a false zero.
- If a full-list refresh fails, retain the last known list and show no random
  toast. The user can retry through the normal page refresh/navigation path.
- If an inline action fails, keep the item available and show an error message;
  do not remove or mark it read optimistically.
- If the user is unauthenticated or the session expires, use the existing
  session recovery and `/login` fallback. Notifications must not create a new
  session path.
- API authorization and ownership failures remain generic to the client and
  must not disclose another user's notifications.

## Privacy and security

- Notification reads and actions are authorized for the signed-in account only.
- Security notifications may contain sensitive activity context and must use
  the existing safe display payloads; never expose tokens, cookies, passwords,
  OTPs, raw IPs, or internal identifiers in the UI.
- Notification content and destinations must respect blocking, privacy, and
  account lifecycle rules enforced by the existing API.

## Acceptance checks

1. Zero unread notifications produces no dropdown rows, no green dot, and no
   numeric unread pill.
2. One unread notification produces one dropdown row and the exact `1` count.
3. More than four unread notifications produces a scrollable unread-only list.
4. Four read notifications with zero unread produce the empty dropdown state.
5. Clicking a dropdown item navigates without marking it read.
6. Opening `/notifications` does not mark the entire list read; scrolling an
   item meaningfully into view does.
7. All/Security and unread-only filtering compose correctly.
8. Mark all as read clears the unread count and persists through the API.
9. Accept/Decline actions work from both surfaces and remain safe on failure.
10. Four-second polling updates the count, pauses in hidden tabs, resumes on
    focus, and does not produce duplicate or historical toasts.
11. Existing failed-login notification behavior remains unchanged; this
    presentation layer does not alter the failed-login policy.

## Implementation alignment note

The web implementation aligns this contract through the shared Header,
ContextualDropdown, AppShell, and NotificationsScreen components. The contract
does not require new notification APIs or changes to notification-producing
business rules.
