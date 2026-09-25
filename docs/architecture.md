# Friink architecture

This document describes the current implementation architecture: repository
boundaries, runtime deployment shape, shared web conventions, and the main
cross-cutting flows. Product behavior belongs in [Rules](rules.md) and the
relevant [unit documents](units/).

**Last edited:** 2026-09-25T01:00:36Z

## Repository and runtime boundaries

```text
web/  -> Next.js web client -> web Vercel project
api/  -> FastAPI service    -> API Vercel project
       -> PostgreSQL/Neon
       -> Cloudflare R2
```

The API entrypoint is `api/api/index.py`. The two Vercel projects are configured
independently; there is no root `vercel.json`. The web project talks to the API
through `NEXT_PUBLIC_API_BASE_URL`.

## Web application conventions

- `web/theme.config.ts` is the canonical source for design-token values.
- `web/app/globals.css` owns generated CSS variables and logged-in app visual/layout rules.
- Logged-in TSX components own structure, semantic class names, state, behavior, and accessibility; they do not define visual design.
- App-owned web surfaces have no page-specific CSS, CSS Modules, route-only stylesheets, or JSX inline styles. The public landing stylesheet `web/app/landing.module.css` is separate and outside this rule.
- Theme defaults to the system color scheme across authenticated and standalone auth/lifecycle surfaces. A valid `friink_appearance` preference (`light`, `dark`, or `system`) overrides it; public marketing remains system-driven.

## Shared layout and navigation

- Authenticated page components still mount `AppShellRoute` at the page
  level. The root layout now wraps routes in `AppShellStateProvider`, which
  preserves account-scoped shell state across those remounts. `AppShellRoute`
  initializes synchronously from the in-memory session to avoid the ordinary
  navigation restore flash. The `AppShell` instance still remounts, and
  route-owned operations are not all made resumable/idempotent; see
  [BUG-NAV-001](bugs.md#bug-nav-001--route-changes-remount-the-app-shell-and-discard-in-progress-work).
- Authenticated entry restores `/auth/me` from a slot-scoped HttpOnly access
  cookie bound to an active server-side session (`sid`). Refresh rotation is
  reactive to an expired/missing access cookie. Public routes render before
  their non-blocking entry-status check. See
  [Account Access](units/account-access.md).
- The shared visible app content column and contextual floating composer use `--space-content-col` with a `720px` tablet/desktop cap. The inline gutter is outside that cap: `16px` on desktop and `8px` on mobile.
- The floating composer is available on feed and supported contextual surfaces and is intentionally hidden on profile pages.
- The global Header owns the Chat link between Search and Notifications. It routes to `/chats` and shows an unread dot when a conversation has new messages. The drawer contains the remaining personal and network navigation.
- The global drawer places Directory directly beneath Saved and routes it to `/directory`; the surface currently reuses the existing Directory screen component.

## Cross-cutting behavior

- Other-user profiles expose a functional Message action that opens `/{username}/chat`; chat access requires mutual accepted follows.
- Other-user profile connection actions resolve from the authenticated relationship status after profile loading and must not inherit self-profile state.
- The signed-in account’s Connections surface always exposes Requests; pending incoming requests provide Accept and Reject actions from the authenticated API.
- Usernames are case-insensitive identities. Signup and Settings check availability before submission, the API remains authoritative, and accepted values are canonicalized to lowercase.

## Feature transport and persistence

- Chat uses REST-backed conversations and messages with a 4-second adaptive polling transport. Active `conversation_members` rows own access, lists, message/media reads, read state, and notification fan-out; the legacy pair columns remain for direct-chat compatibility. Mutual accepted follows enable direct chat immediately; paid-tier users can initiate a non-mutual request with up to eight requester messages. Group operations are API-gated by `GROUP_CHAT_ENABLED`, which defaults to false, and no group-creation UI is exposed. See [Chat](units/chat.md).
- Notifications use a 4-second adaptive unread-count polling transport with visibility/focus recovery. The full list refreshes while Notifications is open. See [Notifications](units/notifications.md).
- Post Likes and Saves are implemented with public aggregate counts, authenticated toggles, Like notifications, profile Likes, private Saved posts, and privacy-controlled Like identity visibility. See [Posts](units/posts.md) and [Saved items](units/saved-items.md).
- Current post media uses a fixed `3:5` crop tool, submit-time R2 upload, a `3:4` frame for multi-image galleries, and natural-ratio display for single images. Final crop dimensions/aspect ratio are not currently persisted. See [Media](units/media.md).

## Deployment and release flow

- Use `development` for local implementation and destructive rehearsals.
- Use `staging` for deployed acceptance testing and the authoritative release
  gate. Staging must match production in runtime and configuration behavior,
  while retaining separate data, credentials, secrets, and databases.
- Use `main` for production release.
- Each environment must apply and verify the current Alembic head before acceptance testing.
- Promote the exact staging-verified artifact to production and run only basic
  production smoke checks after promotion; production is not a second feature-
  acceptance gate.

## Related documents

- [Technology stack](stack.md)
- [Design system](design-system.md)
- [Testing](testing.md)
- [Account access](units/account-access.md)
- [Chat](units/chat.md)
- [Feed](units/feed.md)
- [Notifications](units/notifications.md)
