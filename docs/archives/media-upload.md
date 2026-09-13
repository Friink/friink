# Media Upload Audit Report

Last reviewed: 2026-09-01

This is an evidence-based implementation and staging audit of profile-picture
and post-media upload. It records the current repository state and the manual
staging R2 tests. It is not a product specification.

## Executive finding

R2 write access is working. A direct staging test using `api/.env.r2staging`
generated a presigned post-media URL, uploaded a project JPEG, and confirmed
the object through authenticated R2 metadata. The same object returned `403`
through the configured `r2.dev` public URL for both `HEAD` and `GET`.

The staging API is independently reachable: its root returned `200`, the
post-media CORS preflight returned `200`, and an unauthenticated upload-plan
request returned `401`. Therefore the observed browser toast with status `0`
is a browser `fetch()` rejection, not proof that R2 is unreachable. The exact
authenticated browser request was not captured because the browser automation
could not attach the local test file; no upload request was generated in that
attempt.

The repository now contains a post-media confirmation change that no longer
requires public R2 `HEAD`/`GET` access. It is present on the `staging` branch at
commit `fcd468d` (`Media upload new`, 2026-09-01T07:20:57+05:00). Whether the
same commit is running in the user-visible staging deployment must be verified
in Vercel; this audit does not assume deployment success.

## Current post-media architecture

Relevant routes:

```text
POST /posts/media/upload-url
PUT <presigned R2 URL>       browser directly to R2
POST /posts/media/confirm
POST /posts/media/cleanup
POST /posts                   final association
```

The client processes selected files sequentially. For each image it:

1. Compresses/prepares the source as JPEG using the post-media preset.
2. Requests one upload item with `{"count":1}`.
3. Records the server-issued object key.
4. Performs a direct R2 `PUT` with `Content-Type: image/jpeg`.
5. Calls confirmation for that one key.
6. Continues to the next file only after confirmation succeeds.
7. Sends all confirmed keys to `POST /posts`.

The post key namespace is:

```text
post-media/{authenticated_user_id}/{random}.jpg
```

The API validates that the submitted key belongs to the authenticated user,
has the post-media prefix, has exactly the expected path shape, and ends in
`.jpg`. The request schema permits one through eight upload-plan items, while
the current browser intentionally requests one at a time.

## Current confirmation behavior

`api/app/services/post_media.py` now:

- requires the R2 account ID, access key, secret, and bucket name to create a
  client;
- does not require `R2_PUBLIC_URL` to create a presigned upload URL;
- signs a `put_object` request for `image/jpeg` with a 900-second expiry;
- returns a nullable public URL when `R2_PUBLIC_URL` is configured;
- confirms by validating the user-owned object key after the client reports a
  successful PUT;
- does not call S3 `HeadObject`;
- does not call public HTTP `HEAD` or `GET` during confirmation;
- deletes only validated user-owned keys through authenticated R2 deletion.

This removes the known public-read 403 from the upload/confirmation critical
path. It also means confirmation alone no longer verifies the actual stored
object's MIME type or byte length server-side. The client still prepares JPEG
files with an approximately 500 KB post-media ceiling, and the API still
enforces the post count and key-ownership rules. If server-side byte/type
verification is required, it must be implemented through a separate trusted
mechanism, such as signed upload constraints or authenticated R2 metadata
inspection; public delivery checks should not be used for that purpose.

## R2 configuration and manual evidence

The API configuration fields are:

| Variable | Purpose |
|---|---|
| `R2_ACCOUNT_ID` | R2 account and S3-compatible endpoint construction |
| `R2_ACCESS_KEY_ID` | S3-compatible signing credential |
| `R2_SECRET_ACCESS_KEY` | S3-compatible signing secret |
| `R2_BUCKET_NAME` | Environment-specific bucket |
| `R2_PUBLIC_URL` | Base URL returned for later browser delivery; no longer required for post presigning/confirmation |

Test setup:

- Test folder: `api/tmp/media-upload-test` (ignored by Git).
- Test source: `web/public/media/profile.jpg` copied as `test-post-image.jpg`.
- Credentials: loaded from `api/.env.r2staging`; secret values were not
  printed.
- Key namespace: a random `post-media/{random_user}/{random_file}.jpg` key.

Test result:

```text
PUT          200       15292 bytes
R2_HEAD      image/jpeg 15292 bytes
PUBLIC_HEAD  403
PUBLIC_GET   403
DELETE       succeeded
```

The test object was deleted. The test proves R2 signing, bucket selection,
write permission, authenticated metadata access, and delete permission. It
does not prove that the browser can access the public delivery URL.

Cloudflare dashboard evidence later supplied by the user showed:

```text
Public Development URL: enabled
Custom domain: staging-media.friink.com
Status: Active
Access: Enabled
```

The active custom domain should be the API Preview/staging value when used:

```env
R2_PUBLIC_URL=https://staging-media.friink.com
```

The custom-domain URL was not manually re-tested by this audit after the
dashboard screenshot was supplied. The earlier `403` test used the value from
`api/.env.r2staging`, which was the configured `r2.dev` base at that time.

The R2 CORS configuration shown by the user allows:

```text
Origins: https://staging.friink.com, https://friink.com, http://localhost:3000
Methods: PUT, GET, HEAD
Headers: Content-Type
```

That is sufficient for the current browser PUT contract. CORS does not grant
object read permission; public bucket access or signed delivery does that.

## Profile-picture flow (reference only)

Profile picture code was not changed by the post-media work. Its routes are:

```text
POST /auth/me/profile-picture/upload-url
POST /auth/me/profile-picture/confirm
```

The profile flow uses `api/app/services/storage.py`, the
`profile-pictures/{user_id}/...` namespace, a profile-specific image preset,
and a 3 MB server ceiling. Confirmation updates the user record and handles
replacement cleanup. The profile client uses the existing auth/session path.

Profile viewing reads the stored `profile_picture_url` from user/post author
responses and the browser fetches that URL. This is separate from post-media
association and rendering. The following files showed no diff during the
post-media verification:

```text
api/app/routers/auth.py
web/components/account-screens.tsx
```

No profile API, profile storage method, profile schema, or profile business
rule was intentionally altered by the post-media implementation.

## Viewing post media

The post response now includes URL items alongside `media_count`, and the web
client maps them into the shared `PostMediaGallery`. Feed posts and post-detail
posts (including replies) render the same responsive gallery. Quoted-post
blocks also render their associated media when the quoted response includes it.

The gallery uses one portrait frame for a single image; two and four square
tiles; one large tile plus two stacked tiles for three images; and a four-tile
preview with a `+N` overlay for five through eight images. The browser loads
the first image eagerly and the remaining images lazily.

Successful storage and confirmation still do not guarantee that an image can
be fetched: the URL in each `PostMedia` row must be readable by the browser.
The current delivery URL is derived from `R2_PUBLIC_URL`; a private-bucket
deployment would require replacing those URLs with signed download URLs.

There are two independent requirements for viewing:

1. The post response must expose media URLs or an endpoint that can resolve
   media objects.
2. Those URLs must be readable by the browser.

The public-domain option is an active readable R2 custom/public domain. The
private-bucket option is an API-generated signed R2 `GET` URL. Upload does not
need to use the same URL mechanism as viewing: upload can remain a presigned
R2 `PUT`, while viewing uses short-lived signed `GET` URLs.

## Error and session behavior

Post-media API calls use the normal authenticated request helper. The direct
R2 PUT does not carry or mutate the Friink session. A `status 0` toast is
created in `web/lib/auth.ts` when `fetchApi()` rejects before receiving an HTTP
response. That can represent a browser/CORS/network/timeout failure; it is not
an HTTP status returned by the API.

For authenticated requests, `requestApi()` sends the current access token and
reacts only to a `401 TOKEN_EXPIRED` response by coordinating one refresh and
retrying the original request once. There are no post-media refresh exceptions;
all authenticated requests follow the same model. A definitive session
diagnosis requires the actual browser Network entry or API deployment log for
the original request and any reactive `/auth/refresh`.

## Deployment and release evidence

Repository branch state at audit time:

```text
staging -> origin/staging
HEAD: fcd468d Media upload new
```

Relevant history:

| Commit | Time (+05:00) | Change |
|---|---:|---|
| `78e7f5e` | 2026-09-01 03:39:04 | Session management added |
| `e5558e6` | 2026-09-01 04:06:53 | Initial post-media upload added |
| `807af1a` | 2026-09-01 04:16:06 | Failed-fetch handling change |
| `4c9978e` | 2026-09-01 04:39:00 | Image upload fix |
| `70b819c` | 2026-09-01 05:42:25 | Additional media upload attempt |
| `249cb51` | 2026-09-01 06:10:44 | New media APIs |
| `92fc7fc` | 2026-09-01 06:27:43 | Post-media complete rewrite |
| `fcd468d` | 2026-09-01 07:20:57 | Removed public-read confirmation dependency |

The repository documents the safe order as migrate, deploy API, verify, then
deploy web. This audit has no Vercel deployment event/log access and therefore
cannot confirm whether that order was followed for `fcd468d`, or whether the
currently served web and API deployments contain matching commits. This is an
explicit unresolved item, not an assumption.

## Current conclusions

- R2 credentials and direct post-media writes are functional.
- R2 authenticated metadata and delete operations are functional.
- The previously tested public `r2.dev` read path returned 403.
- The user’s screenshot shows an active custom domain, but that domain still
  needs an exact-object read test if public delivery is retained.
- CORS is not the same as public object permission.
- The API root, CORS preflight, and unauthenticated route are reachable from
  outside; the status-0 toast remains an authenticated browser-path issue that
  was not fully reproduced here.
- Post confirmation no longer depends on public reads in commit `fcd468d`.
- Post media still requires a separate response/rendering design for viewing.
- Profile-picture APIs and implementation were not touched by the post-media
  changes.

## MVP profile-picture key storage checkpoint

New profile-picture confirmations now store `users.profile_picture_key` rather
than persisting the environment-specific public host in the new record. The API
continues to return `profile_picture_url` for the existing frontend contract by
combining the stored object key with the active environment's `R2_PUBLIC_URL`.
Legacy `profile_picture_url` rows were intentionally left untouched for this MVP
shortcut and may stop rendering if their old delivery host is disabled.

This removes wrong-host persistence for new uploads but does not make a shared
database safe with separate staging and production buckets: both environments
can still read the same key while only one bucket contains its object. Separate
databases remain required before production and staging media are isolated.

## Recommended verification sequence

1. Confirm Vercel API Preview is running `fcd468d` and Vercel web Preview is
   running the matching client commit.
2. In the browser Network panel, click upload and record whether
   `/auth/refresh` appears and its status.
3. Record `/posts/media/upload-url` status, response body, and
   `X-Friink-Post-Media-Stage` / `X-Friink-Request-Id` headers.
4. If upload planning succeeds, record the R2 PUT status and then confirmation
   status.
5. Test one exact object URL through `https://staging-media.friink.com/...`.
6. Separately implement/verify post-media URL exposure in post responses before
   treating successful upload as visible media.
