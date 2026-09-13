# Friink Auth, Session, and Media Architecture Audit

Last reviewed: 2026-09-01

This document summarizes the current implementation, boundaries, and known
operational behavior of authentication, server-managed sessions, profile
pictures, and post media.

## 1. Authentication architecture

The API uses FastAPI, bearer access JWTs, and an HTTP-only refresh-token cookie.
The web client stores the current access token and user snapshot in browser
local storage under `friink-auth-session`; the refresh token is not stored in
JavaScript.

### API authentication routes

Defined in `api/app/routers/auth.py`:

```text
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
GET  /auth/sessions
POST /auth/sessions/{session_id}/revoke
POST /auth/sessions/revoke-others
```

`get_current_user()` decodes and validates the bearer access token, resolves
the subject to a UUID, and loads the user. Protected routes depend on this
function. Optional-auth post reads use a separate optional dependency so
public posts can be read without a bearer token while private-post rules still
apply.

### JWT configuration

Defined in `api/app/config.py` and `api/app/services/security.py`:

| Setting | Current role |
|---|---|
| `JWT_SECRET_KEY` | Required signing/verification secret; no application fallback |
| `JWT_ACTIVE_KID` | Selects the active signing key ID; default is `default` |
| `JWT_KEYS` | Optional JSON map of key IDs to secrets for key rotation |
| `JWT_ALGORITHM` | Defaults to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Defaults to 30 minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Defaults to 14 days |

Access JWTs contain `sub`, `typ`, `iat`, and `exp`, plus a `kid` header. The
verification map always includes the default secret and merges configured
`JWT_KEYS`. `JWT_ACTIVE_KID` must resolve to a configured key. Changing the
active secret/key without a compatible verification key invalidates existing
access tokens immediately.

Security functions:

- `hash_password()` / `verify_password()` — bcrypt password handling.
- `create_token()` — signs typed JWTs with issue/expiry timestamps.
- `create_access_token()` — creates access JWTs.
- `classify_jwt_error()` — maps PyJWT failures to stable internal auth codes.
- `decode_token()` — verifies signature, key ID, token type, and claims.

## 2. Refresh-token and session architecture

Refresh tokens are opaque random values. The API stores only a SHA-256 hash in
`refresh_tokens`; the raw value exists only in the HTTP-only cookie and during
the request.

Login creates:

1. An `auth_sessions` row representing a browser/device session.
2. A refresh-token family linked to that session.
3. A bearer access JWT.
4. The `friink_refresh_token` cookie.

Refresh performs rotation:

1. Hash the presented cookie and lock the matching token row for update.
2. Reject missing, unknown, expired, revoked, or already-rotated tokens.
3. If a dead token is presented, revoke its entire family as reuse detection.
4. Issue a replacement token in the same family.
5. Mark the old token rotated and link it to the replacement.
6. Issue a new access JWT and replace the cookie.
7. Update `auth_sessions.last_active_at`.

Logout revokes the presented session/token family and deletes the cookie. It
does not revoke unrelated device sessions.

### Session tables

`refresh_tokens` was added by migration
`20260831_0012_create_refresh_tokens.py`.

`auth_sessions` and the nullable `refresh_tokens.session_id` link were added
by migration `20260901_0013_create_auth_sessions.py`. These migrations are
additive. The post-media migration/work does not alter either table.

Session-management functions are in `api/app/services/session_service.py`:

```text
hash_refresh_token
issue_refresh_token
get_refresh_token_for_update
get_refresh_token
create_auth_session
list_active_auth_sessions
revoke_auth_session
revoke_refresh_family_for_session
revoke_refresh_family
revoke_refresh_token
purge_expired_refresh_tokens
```

### Refresh cookie contract

Cookie name: `friink_refresh_token`

| Attribute | Development | Production |
|---|---|---|
| HTTP-only | true | true |
| Secure | false | true |
| SameSite | `lax` | `none` |
| Path | `/` | `/` |
| Max-Age | configured refresh lifetime | configured refresh lifetime |

The API sets and deletes the cookie with the same name, path, secure, and
SameSite values. Cross-site staging/production deployments require browser
credentials to be included and a compatible frontend/API CORS policy.

## 3. Web session behavior

Defined in `web/lib/auth.ts` and `web/lib/api-origin.ts`:

- `saveAuthSession()` persists the access token and user snapshot locally.
- `loadAuthSession()` reads the current local session.
- `loadPersistedAuthSession()` rejects the demo session and parses persisted data.
- `clearAuthSession()` removes local auth and increments a refresh generation.
- `refreshAuthSession()` calls `/auth/refresh` with credentials and updates the stored access token.
- Concurrent refreshes share one in-flight promise within a tab and a
  localStorage coordination lease/result across tabs.
- `requestApi()` adds JSON headers, auth-flow context, bearer auth, and
  `credentials: include`.
- A `401` with `TOKEN_EXPIRED` causes one refresh-and-retry of the original
  request.
- Only an explicit `401` from refresh clears the local session. Network errors,
  timeouts, CORS failures, 5xx responses, malformed refresh responses, and
  ambiguous failures do not prove that credentials are invalid. No authenticated
  request proactively refreshes; every request sends its current token and
  reacts only to `401 TOKEN_EXPIRED`.
- `fetchApi()` resolves exactly one configured API origin and never falls back
  across staging, production, or local environments. The direct R2 PUT never
  uses the Friink session.

## 4. Profile-picture media architecture

Profile-picture APIs remain separate from post media:

```text
POST /auth/me/profile-picture/upload-url
PUT  <profile presigned R2 URL>
POST /auth/me/profile-picture/confirm
```

Implementation:

- API storage: `api/app/services/storage.py`.
- Web orchestration: `uploadProfilePicture()` in `web/lib/auth.ts`.
- Key namespace: `profile-pictures/{user_id}/{random}.{extension}`.
- Supported source formats: JPG/JPEG, PNG, WebP; HEIC/HEIF rejected.
- Client output: square JPEG, 512px target, approximately 250KB target.
- Server confirmation ceiling: 3MB.
- Confirmation updates `users.profile_picture_url` and timestamp.
- Replacement removes the previous stored object before committing the new
  URL; legacy flat profile keys are supported for cleanup.

Profile confirmation uses the profile storage service's object verification
and replacement rules. Profile viewing reads the stored public URL returned in
user/post author data. No profile-picture API or profile business rule was
changed by the post-media work documented here.

## 5. Post-media upload architecture

Post media is submit-time only. The composer keeps files local for preview and
does not upload when a file is selected.

```text
POST /posts/media/upload-url
PUT  <post presigned R2 URL>
POST /posts/media/confirm
POST /posts/media/cleanup       failure/orphan cleanup
POST /posts                     association with the new post
```

Implementation:

- Storage service: `api/app/services/post_media.py`.
- Web orchestration: `uploadPostMedia()` and `createPost()` in
  `web/lib/auth.ts`.
- Shared PUT helper: `web/lib/media-upload.ts`.
- Key namespace: `post-media/{user_id}/{random}.jpg`.
- Client processing: aspect-preserving JPEG, 1024px maximum longest edge,
  approximately 500KB target.
- Maximum selected/associated images: eight.
- Current browser behavior: one image is planned, uploaded, and confirmed at
  a time.
- Post confirmation validates the authenticated user's key namespace but does
  not issue public `HEAD`/`GET` requests.
- Failed post creation attempts cleanup for all keys already claimed by the
  browser; post deletion removes associated R2 objects.

The post-media service requires the R2 account ID, access key, secret, and
bucket name to generate a presigned PUT. `R2_PUBLIC_URL` is optional for the
upload-plan/confirmation path and is used only to derive the returned/stored
delivery URL.

## 6. Post-media response and display architecture

Post and quoted-post responses now contain:

```json
{
  "media_count": 1,
  "media": [{"url": "https://media.example/post-media/...jpg"}]
}
```

The API loads `Post.media` and quoted-post media with SQLAlchemy eager loading
and serializes stored `PostMedia.url` values. The web maps those URLs into its
shared `PostMediaGallery`.

The gallery is rendered by `FeedPost`, which is reused by feed, post-detail,
and reply views; quoted-post blocks use the same gallery component. Layout:

- one image: portrait 4:5 frame on compact screens and a desktop frame capped at `min(70vh, 38rem)`;
- two images: two square tiles;
- three images: one large tile and two stacked tiles;
- four images: 2×2 grid;
- five through eight: first four tiles plus a `+N` overlay.

The first image loads eagerly; later images load lazily. Alt text includes the
author and image position. On mobile the gallery bleeds to the content edges.

## 7. R2 and staging evidence

The manual test used `api/.env.r2staging` and the project image
`web/public/media/profile.jpg` copied into the ignored folder
`api/tmp/media-upload-test`.

Observed results:

```text
Presigned PUT:       HTTP 200
Authenticated R2 HEAD: image/jpeg, 15292 bytes
Public r2.dev HEAD:  HTTP 403
Public r2.dev GET:   HTTP 403
Authenticated delete: succeeded
```

The user later supplied a Cloudflare dashboard screenshot showing the custom
domain `staging-media.friink.com` as Active with Access Enabled. The staging
API environment should use:

```env
R2_PUBLIC_URL=https://staging-media.friink.com
```

The supplied post URL was then checked end to end. The public API returned a
media item for post `WaptlLjG` using an object URL under that custom domain.
Fetching the exact URL failed before HTTP with:

```text
No such host is known: staging-media.friink.com
```

This identifies the current rendering failure as DNS resolution for the custom
media hostname. The R2 dashboard's Active/Enabled state did not establish that
the hostname resolves publicly. The DNS record/target generated for the R2
custom domain must exist at the authoritative DNS provider before the browser
can load returned media URLs.

The shown R2 CORS rule allows the staging origin, `PUT`/`GET`/`HEAD`, and
`Content-Type`. CORS permits browser cross-origin requests; it does not grant
object read permission.

## 8. Diagnosed upload failure and fix

The staging request log for `POST /posts/media/upload-url` showed HTTP 500 and
no outgoing external API calls. The cause was a response-model mismatch:

- `PostMediaStorageService.create_upload()` returned `PostMediaUpload`
  dataclass instances.
- The route passed them directly into `PostMediaUploadUrlResponse`.
- Pydantic expected `PostMediaUploadUrlItem` models and raised a validation
  error after presigning.

The route now explicitly maps each dataclass to `PostMediaUploadUrlItem`. A
regression test covers a successful upload-plan response.

## 9. Known limitations and risks

- The upload/confirmation path can succeed while image delivery fails if the
  stored URL returns 403 or otherwise cannot be fetched.
- Post confirmation no longer verifies object bytes through public reads. The
  client-side compressor targets the 500KB rule, but a future server-side
  content/size backstop should use signed upload constraints or authenticated
  R2 metadata, not public delivery probes.
- A post can only be visibly rendered when its response includes media URLs and
  the browser can read those URLs. Existing rows with null `PostMedia.url`
  cannot render until their URLs are repaired or resolved through another
  delivery endpoint.
- A `status 0` toast means the browser received no HTTP response. For an
  authenticated media request, inspect the original request and its reactive
  `401 TOKEN_EXPIRED` retry, then `/posts/media/upload-url`, then the R2 PUT.
- The repository cannot confirm Vercel's exact deployed commit or deploy order
  without deployment-log access. Staging should be checked for matching API
  and web deployments.

## 10. Verification status

After the latest post-media display and response changes:

- Focused post tests: 23 passed.
- API compilation: passed.
- Web TypeScript check: passed.
- `git diff --check`: passed.
- Profile auth route and profile account-screen files showed no diff during the
  post-media changes.

## Source map

| Area | Files |
|---|---|
| API auth routes | `api/app/routers/auth.py` |
| Auth service | `api/app/services/auth.py` |
| JWT/security | `api/app/services/security.py`, `api/app/config.py` |
| Session service | `api/app/services/session_service.py` |
| Session migrations | `api/alembic/versions/20260831_0012_create_refresh_tokens.py`, `api/alembic/versions/20260901_0013_create_auth_sessions.py` |
| Profile media | `api/app/services/storage.py`, `web/lib/auth.ts`, `web/components/account-screens.tsx` |
| Post media | `api/app/services/post_media.py`, `api/app/routers/posts.py`, `web/lib/auth.ts`, `web/lib/media-upload.ts` |
| Post response/serialization | `api/app/schemas/posts.py`, `api/app/services/posts.py` |
| Post display | `web/components/feed-post.tsx`, `web/components/post-media-gallery.tsx`, `web/app/globals.css` |
| Media rules/design | `RULES.md`, `packages/design/design.md`, `R2.md` |
