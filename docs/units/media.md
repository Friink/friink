# Media

Media covers image selection, preparation, cropping, upload, confirmation,
storage, delivery, cleanup, and deletion for posts and profile pictures.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-12T16:20:00Z  
**Platforms:** Web and API

## Canonical ownership

This document owns media-transfer and processing behavior. [Posts](./posts.md)
and [Profiles](./profiles.md) own the product meaning of attached media.

## Related units

- [Posts](./posts.md) — owns post attachment limits and association.
- [Profiles](./profiles.md) — owns profile-picture meaning and fallback.
- [Design System](../design-system.md) — owns gallery and cropper presentation.

## Rules

- **MEDIA-R-001:** Post images remain local until submit; up to eight JPEG images
  may be selected and reordered.
- **MEDIA-R-002:** Post preparation targets a 1024px maximum longest edge,
  preserved aspect ratio, JPEG output, and approximately 500KB.
- **MEDIA-R-003:** Profile pictures accept JPG/JPEG, PNG, and WebP, require a
  minimum 128px shorter edge, and normalize to a square JPEG preset.
- **MEDIA-R-004:** The API validates authenticated ownership and key namespace;
  client upload success alone does not associate media with content.
- **MEDIA-R-005:** Failed post submission cleans up uploaded objects and does
  not leave a half-created post.
- **MEDIA-R-006:** Successfully associated media is rendered through the shared
  gallery; a single image preserves natural aspect ratio.
- **MEDIA-R-007:** The last confirmed profile image remains visible until the
  complete processing, transfer, and confirmation flow succeeds.

## UX and flows

Selecting a post image opens the fixed crop flow; Apply saves the crop for
submission and Reset restores the crop view. Upload actions show processing,
transfer, confirmation, success, and actionable failure states. Crop and upload
surfaces are accessible modal interactions.

## Technical contract

Browser preparation uses `image-compression.ts` and `crop-image.ts`. Post
uploads use presigned R2 PUTs and API confirmation through `posts.py` and
`storage.py`. Profile uploads use the corresponding auth endpoints. Media keys
are environment-specific and are never cross-environment shared.

## Acceptance criteria

- [ ] **MEDIA-AC-001** Invalid type, size, and dimension inputs are rejected clearly.
- [ ] **MEDIA-AC-002** Upload failure preserves retryable user state.
- [ ] **MEDIA-AC-003** Failed post submission cleans up objects.
- [ ] **MEDIA-AC-004** API ownership and namespace validation cannot be bypassed.
- [ ] **MEDIA-AC-005** Confirmed media renders with the shared gallery contract.

## Known limitations

Post crop bounds and final crop aspect ratio are not persisted. Freeform crop
bounds and carousel-ratio locking are not implemented.
