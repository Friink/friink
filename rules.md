# Friink Rules

This file documents product/business logic rules for features currently implemented
and active in the codebase. It does NOT cover planned features, deprecated behavior
(beyond marking it Deprecated below), or visual/design rules (see design.md).

When adding a new rule after implementing a feature: add it under the relevant feature
area heading using the template below. If no matching heading exists, create one. Do
not remove entries - mark superseded/removed behavior as Deprecated rather than deleting
the entry, so history isn't lost.

## Authentication & Accounts

### Rule: Signup Creates Active Public Accounts
- **What:** A successful signup creates a user with a lowercased unique email, unique username, display name defaulting to username when omitted, `is_private = false`, a hashed password, and `is_verified = true`.
- **Edge cases:** Signup rejects duplicate emails and duplicate usernames with `409`. OTP records/services exist only as stubs; no OTP challenge is active in signup.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `api/app/models/user.py`
- **Since:** 2026-08-29 (07:15 UTC-0)

### Rule: Password And Username Validation
- **What:** Passwords must be at least 8 characters, contain no whitespace, and include at least one uppercase letter, lowercase letter, number, and special character. Usernames must be 1-64 characters and may contain only letters, numbers, `.`, `_`, and `-` with no spaces.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `web/components/login-screen.tsx`, `api/tests/test_validation.py`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Minimum Signup Age
- **What:** Signup requires users to be at least 13 years old based on `date_of_birth`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/auth.py`, `api/tests/test_validation.py`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Login Lockout
- **What:** Five failed login attempts for an existing account lock the account for 3 hours. A locked account returns `423` with an ISO retry timestamp. Successful login clears failed-attempt state.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_lockout.py`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: JWT Sessions
- **What:** Login returns a bearer access token and sets an HTTP-only refresh-token cookie. Access tokens default to 30 minutes; refresh tokens default to 14 days. Token payloads must match the expected `typ` value (`access` or `refresh`).
- **Edge cases:** Refresh tokens are not rotated or denylisted yet. Logout deletes the refresh cookie and returns `204`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/routers/auth.py`, `api/app/services/security.py`, `api/app/config.py`, `web/lib/auth.ts`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Current User Updates
- **What:** Authenticated users may update username, email, display name, about text, and privacy status. Username/email updates reject conflicts with another user.
- **Edge cases:** If no submitted value changes the user, the API returns the existing user without committing. `about` is capped at 256 characters and display name at 120.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/app/schemas/auth.py`, `web/components/account-screens.tsx`
- **Since:** 2026-08-29 (07:15 UTC-0)

### Rule: Web Session Persistence
- **What:** The web client stores authenticated sessions in `localStorage` under `friink-auth-session`; logout clears that stored session.
- **Edge cases:** `loadPersistedAuthSession()` intentionally ignores the local demo email `demo@friink.local` so the public landing page does not redirect for demo sessions.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/lib/auth.ts`, `web/app/landing-auth-redirect.tsx`, `web/components/login-screen.tsx`
- **Since:** 2026-08-27 (00:00 UTC-0)

## Privacy & Connections

### Rule: Directional Follow Relationships
- **What:** Follows are directional and non-mutual. A row in `follow_requests` from `requester_id` to `recipient_id` represents the relationship or request history.
- **Edge cases:** Self-follow is rejected with `400`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/connection.py`, `api/app/services/connections.py`, `api/app/routers/connections.py`
- **Since:** 2026-08-29 (07:15 UTC-0)

### Rule: Public Accounts Accept Follows Immediately
- **What:** Following a public account creates an `accepted` follow request row immediately and returns it as the active following relationship.
- **Edge cases:** If an active or pending row already exists, the existing row is returned instead of creating a duplicate.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29 (07:15 UTC-0)
- **Related rules:** Private Accounts Require Pending Requests; Follow Notifications

### Rule: Private Accounts Require Pending Requests
- **What:** Following a private account creates a `pending` request instead of an active follow. The recipient can accept or reject it.
- **Edge cases:** Pending requests are exposed through incoming/outgoing request endpoints and do not count as followers or following.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`, `web/components/connections-screen.tsx`
- **Since:** 2026-08-29 (07:15 UTC-0)
- **Related rules:** Request Notifications; Connections Lists Count Accepted Rows Only

### Rule: Rejected Requests Cool Down For 24 Hours
- **What:** When a pending request is rejected, the row is retained as `rejected` with `responded_at`, and the requester cannot resend to that private profile until 24 hours have passed.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Sender-Canceled Requests Can Trigger A Resend Lockout
- **What:** A requester may cancel pending requests, but after three cancellations within a rolling 3-hour cycle, another request to that private profile is blocked until 24 hours after the first cancellation in that cycle.
- **Edge cases:** One cancellation does not lock resending. The cooldown uses retained `canceled` rows where `removed_at` is null, so owner-side follower removals do not count as sender cancels.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Unfollow Removes The Active Edge From Counts
- **What:** Either party may remove an accepted connection by setting the row to `canceled`; it no longer appears in follower/following lists or counts.
- **Edge cases:** Unfollow does not notify the target. The implementation retains the row instead of hard-deleting it.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/routers/connections.py`
- **Since:** 2026-08-29 (07:15 UTC-0)

### Rule: Owner-Removed Followers Cool Down For 24 Hours
- **What:** When an account owner removes a follower, the active row becomes `canceled` with `removed_at`, and that follower cannot follow the owner again for 24 hours.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/tests/test_connections.py`
- **Since:** 2026-08-29 (00:00 UTC-0)

### Rule: Private-To-Public Auto-Accepts Pending Requests
- **What:** When a user changes from private to public, all pending requests received by that user become `accepted` in the same update flow.
- **Edge cases:** Changing from public to private does not alter existing followers or following rows.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/auth.py`, `api/tests/test_auth_updates.py`
- **Since:** 2026-08-29 (07:15 UTC-0)
- **Related rules:** Request Accepted Notifications

### Rule: Connections Lists Count Accepted Rows Only
- **What:** Followers and following endpoints return only users connected through `accepted` rows. Pending, rejected, and canceled rows are excluded.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `web/components/app-shell.tsx`
- **Since:** 2026-08-29 (12:20 UTC-0)

### Rule: Requests Tab Is Private-Account UI
- **What:** The web Connections page shows `All`, `Followers`, `Following`, and `Requests` for private signed-in accounts; public signed-in accounts see only `All`, `Followers`, and `Following`. If a public account lands on Requests, the web UI resets the filter to `All`.
- **Edge cases:** The backend request endpoints remain authenticated API routes regardless of the current user's privacy setting.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/connections-screen.tsx`
- **Since:** 2026-08-29 (12:15 UTC-0)

## Posts, Replies & Quotes

### Rule: One Posts Table Stores Posts, Replies, And Quotes
- **What:** Posts, replies, and quotes are distinguished by `kind`. Replies set `parent_post_id`; quotes set `quoted_post_id`; ordinary posts set neither.
- **Edge cases:** Replies are excluded from the main feed query. Deleted posts are excluded from normal fetches.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/post.py`, `api/app/services/posts.py`, `api/app/schemas/posts.py`
- **Since:** 2026-08-29 (00:00 UTC-0)

### Rule: Post Content And Media Limits
- **What:** Post content is required and capped at 512 characters. Media payloads validate at no more than 16 items, but media uploads are not currently supported by the creation service.
- **Edge cases:** Any non-null `media` payload currently returns `400` with `Media uploads are not yet supported.`
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/schemas/posts.py`, `api/app/services/posts.py`, `web/components/app-shell.tsx`
- **Since:** 2026-08-29 (00:00 UTC-0)

### Rule: Create Payload Must Match Post Kind
- **What:** Reply posts require `parent_post_id`; non-replies may not set `parent_post_id`. Quote posts require `quoted_post_id`; non-quotes may not set `quoted_post_id`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29 (00:00 UTC-0)

### Rule: Private Post Visibility Is Enforced Server-Side
- **What:** A private author's posts are visible only to the author and accepted followers. Public-author posts are visible without an accepted-follow check.
- **Edge cases:** Unauthorized or unauthenticated post detail and reply-list access resolves as `404`-equivalent `Post not found.` for protected posts.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/lib/auth.ts`
- **Since:** 2026-08-29 (13:10 UTC-0)
- **Related rules:** Reply Creation Rechecks Parent Visibility; Quote Cards Hide Protected Content

### Rule: Reply Creation Rechecks Parent Visibility
- **What:** A user cannot reply to a post unless the API confirms that user can view the parent post.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29 (13:10 UTC-0)
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### Rule: Private Posts Cannot Be Quoted
- **What:** Posts authored by private accounts cannot be quoted, even by the private account owner.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/tests/test_posts.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Quote Cards Hide Protected Content
- **What:** If a quoted post is deleted or unavailable, the quote payload is marked unavailable. If the quoted post's author is private and the viewer cannot view it, the quote card content becomes `Content not available`.
- **Edge cases:** Deleted or missing quoted posts use `Original post unavailable.`
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `web/components/feed-post.tsx`
- **Since:** 2026-08-29 (13:10 UTC-0)
- **Related rules:** Private Post Visibility Is Enforced Server-Side

### Rule: Feed Pagination And Updates
- **What:** `GET /posts` returns cursor-paginated non-reply feed pages ordered newest first, with a default limit of 20 and maximum limit of 100. `GET /posts/updates` returns posts newer than a supplied top-feed anchor. `GET /posts/context/{post_id}` returns an anchor-centered slice for restoring reading position.
- **Edge cases:** Invalid cursors return `400`. Context for a missing, reply, or unauthorized anchor returns no context and the router reports `404`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/posts.py`, `api/app/routers/posts.py`, `web/components/home-screen.tsx`
- **Since:** 2026-08-29 (10:05 UTC-0)

### Rule: Web Home Feed Restores Reading Position
- **What:** The web Home feed stores the top visible post id in `localStorage` and attempts to restore around that anchor on the next load.
- **Edge cases:** If the saved anchor fails to load, the client clears it and falls back to a normal feed load. Polling for newer posts runs only while the document is visible and uses a 10-second interval.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/home-screen.tsx`
- **Since:** 2026-08-29 (10:05 UTC-0)

### Rule: Canonical Post URLs Use Author Username And Post ID
- **What:** Canonical post-detail URLs use `/{username}/{postId}`. The legacy `/posts/{postId}` route fetches the post and redirects to the canonical author-scoped URL.
- **Edge cases:** If the username segment is stale or mismatched, the canonical route permanently redirects to the current author username while preserving query parameters.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/[username]/[postId]/page.tsx`, `web/app/posts/[postId]/page.tsx`, `web/lib/post-path.ts`
- **Since:** 2026-08-29 (10:20 UTC-0)

## Notifications

### Rule: In-App Notifications Are Fetchable And Readable
- **What:** Authenticated users can fetch a paginated notification feed, fetch an unread count, mark one notification read, or mark all their notifications read.
- **Edge cases:** Notification feed pages default to 20 items and clamp to a maximum of 100. Marking another user's notification read returns `404`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/models/notification.py`, `api/app/services/notifications.py`, `api/app/routers/notifications.py`, `web/lib/auth.ts`, `web/components/notifications-screen.tsx`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Follow Notifications
- **What:** Following a public profile creates `follow_sent_public` for the actor and `new_follower` for the target.
- **Edge cases:** Unfollowing is silent for the target.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Request Notifications
- **What:** Sending a private follow request creates `request_sent` for the actor and `request_received` for the target.
- **Edge cases:** Canceling a request is silent for the target. Rejecting a request is silent for the requester.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

### Rule: Request Accepted Notifications
- **What:** Accepting a pending follow request creates `request_accepted` for the requester. Private-to-public auto-accept uses the same notification type.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/services/connections.py`, `api/app/services/auth.py`, `api/app/models/notification.py`
- **Since:** 2026-08-29 (13:10 UTC-0)

## Web Navigation & Client Behavior

### Rule: API Origin Resolution
- **What:** Web API calls use `NEXT_PUBLIC_API_BASE_URL` when configured. Localhost browsing falls back to `http://localhost:8000`. Deployed browser contexts without an API origin throw a configuration error instead of silently calling localhost.
- **Edge cases:** If the configured origin is `https://staging-api.friink.com` and a network-level fetch fails, the client retries `https://api.friink.com`.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/lib/api-origin.ts`, `web/lib/auth.ts`
- **Since:** 2026-08-29 (10:40 UTC-0)

### Rule: Landing Page Redirects Authenticated Users
- **What:** The public landing page redirects users with a persisted non-demo auth session to `/home`.
- **Edge cases:** Demo sessions are ignored for this redirect.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/page.tsx`, `web/app/landing-auth-redirect.tsx`, `web/lib/auth.ts`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Landing Newsletter Uses Zoho Form Submission
- **What:** The landing-page subscribe form submits the `Email` field to the configured Zoho Forms endpoint through a hidden iframe target and then disables the form with a submitted state.
- **Edge cases:** The submitted state is deferred briefly so the native form submission includes the email input.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/app/subscribe-form.tsx`, `web/app/page.tsx`
- **Since:** 2026-08-18 (00:00 UTC-0)

### Rule: Chat Filters Are Client-Side Mock Data Filters
- **What:** The web Chat screen filters local conversation data into `All`, `Muted`, and `Requests` tabs using fields from `web/lib/mock-conversations.ts`.
- **Edge cases:** There is no live backend chat, mute, or request API in the current codebase.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/screens.tsx`, `web/lib/mock-conversations.ts`, `web/components/app-shell.tsx`
- **Since:** 2026-08-29 (12:05 UTC-0)

### Rule: Appearance And Sidebar Preferences Use Cookies
- **What:** The web app stores appearance (`light`, `dark`, or `system`) and desktop sidebar collapsed state in cookies for one year.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/app-shell.tsx`, `web/components/account-screens.tsx`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Profile Identity And Actions Are Client-Mapped
- **What:** The web profile screen treats the signed-in user's profile as self and other username routes as other-user profiles. Self-profile shows Edit; other-user profiles show follow/request/following state plus a message icon.
- **Edge cases:** Profile follower/following counts are currently rendered as `0` in the profile component; live counts are shown on the Connections page instead.
- **Status:** Active
- **Platform:** Web only
- **File(s):** `web/components/profile-screen.tsx`, `web/components/app-shell.tsx`, `web/app/[username]/profile-client.tsx`
- **Since:** 2026-08-26 (00:00 UTC-0)

## Infrastructure & Deployment

### Rule: FastAPI Uses Sync SQLAlchemy Sessions
- **What:** The backend uses FastAPI with synchronous SQLAlchemy sessions and psycopg3 database URLs. Alembic migrations define the database schema.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/db.py`, `api/alembic/env.py`, `api/requirements.txt`, `api/api/index.py`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: CORS Allows Configured Frontend And Local Development
- **What:** The API allows CORS from `FRONTEND_URL`, `http://localhost:3000`, `http://127.0.0.1:3000`, and explicitly `https://staging.friink.com`.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`, `api/app/config.py`
- **Since:** 2026-08-27 (00:00 UTC-0)

### Rule: Database Health Endpoint Checks Connectivity Only
- **What:** `GET /health/db` opens a psycopg connection and runs `SELECT 1`, returning `{"database": true}` on success.
- **Edge cases:** This endpoint does not verify ORM schema compatibility; ORM-backed endpoint checks are still needed after migrations.
- **Status:** Active
- **Platform:** All
- **File(s):** `api/app/main.py`
- **Since:** 2026-08-27 (00:00 UTC-0)
