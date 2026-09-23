# Media

Media covers image selection, preparation, cropping, upload, confirmation,
storage, delivery, cleanup, and deletion for posts, chat messages, and profile
pictures.

**Status:** Active  
**Tier:** Standard  
**Last edited:** 2026-09-23T01:20:00Z
**Platforms:** Web and API

## Canonical ownership

This document owns media-transfer and processing behavior. [Posts](./posts.md)
and [Profiles](./profiles.md) own the product meaning of attached media.

## Related units

- [Posts](./posts.md) — owns post attachment limits and association.
- [Chat](./chat.md) — owns chat-message attachment limits and association.
- [Profiles](./profiles.md) — owns profile-picture meaning and fallback.
- [Design System](../design-system.md) — owns gallery and cropper presentation.

## Rules

- **MEDIA-R-001:** Post images remain local until submit; up to eight JPEG images
  may be selected and reordered.
- **MEDIA-R-002:** Post preparation targets a 1024px maximum longest edge,
  preserved aspect ratio, JPEG output, and approximately 500KB.
- **MEDIA-R-008:** Chat images use the same 1024px maximum longest edge,
  preserved aspect ratio, JPEG output, and approximately 500KB preparation
  preset as post images; a chat message may include up to eight images.
- **MEDIA-R-003:** Profile pictures accept JPG/JPEG, PNG, and WebP, require a
  minimum 128px shorter edge, and normalize to a square JPEG preset.
- **MEDIA-R-004:** The API validates authenticated ownership and key namespace;
  client upload success alone does not associate media with content.
- **MEDIA-R-005:** Failed post or chat submission cleans up uploaded objects and
  does not leave a half-created content record.
- **MEDIA-R-006:** Successfully associated post and chat media is rendered
  through its shared surface; a single post image preserves natural aspect
  ratio.
- **MEDIA-R-007:** The last confirmed profile image remains visible until the
  complete processing, transfer, and confirmation flow succeeds.

## UX and flows

Selecting a post or chat image opens the fixed crop flow; Apply saves the crop
for submission and Reset restores the crop view. Upload actions show
processing, transfer, confirmation, success, and actionable failure states.
Crop and upload surfaces are accessible modal interactions. Published post
images use the responsive gallery and full-screen lightbox defined by the
Posts and Design System units; chat images render inline in the conversation.

## Technical contract

Browser preparation uses `image-compression.ts` and `crop-image.ts`. Post and
chat uploads use the shared `postMedia` JPEG preset, presigned R2 PUTs, and API
confirmation through their respective routers. Profile uploads use the
corresponding auth endpoints. Media keys are environment-specific and are
never cross-environment shared.

## Acceptance criteria

- [ ] **MEDIA-AC-001** Invalid type, size, and dimension inputs are rejected clearly.
- [ ] **MEDIA-AC-002** Upload failure preserves retryable user state.
- [ ] **MEDIA-AC-003** Failed post submission cleans up objects.
- [ ] **MEDIA-AC-004** API ownership and namespace validation cannot be bypassed.
- [ ] **MEDIA-AC-005** Confirmed media renders with the shared gallery contract.

## Known limitations

Post crop bounds and final crop aspect ratio are not persisted. Freeform crop
bounds and carousel-ratio locking are not implemented. The native browser file
chooser cannot expose a reliable maximum-file attribute; the composer enforces
the eight-image limit after selection. A pre-selection helper/counter that
communicates remaining image slots is planned but not yet implemented.
