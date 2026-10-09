# iCamp Overhead Image Library

Build 018 establishes the source-image library used by the campground map.

## Supported source images

Authorized managers can upload:
- JPEG;
- PNG;
- WebP.

Animated images and GIF map sources are intentionally rejected. The source image must be at least 256×256 pixels, no side may exceed 20,000 pixels, the image may not exceed 120 megapixels, and the existing secure-media 12 MiB image limit still applies.

## Safe ingestion

The upload path reuses Build 008 secure media controls and adds map-specific processing:

1. filename, MIME type, byte size and binary signature are validated;
2. source dimensions are read from the raster header;
3. dimension/pixel limits reject unreasonable images before map use;
4. common JPEG EXIF/IPTC/comment, PNG text/EXIF and WebP EXIF/XMP metadata are removed;
5. the sanitized bytes receive a SHA-256 checksum;
6. the sanitized object is uploaded through the server-only storage adapter;
7. metadata and version state are committed transactionally;
8. if database registration fails after object upload, the storage object is deleted to avoid an orphan.

The database stores no image bytes, provider secret, signed URL or GPS metadata.

## Version model

Each campground receives a monotonically increasing map image version number.

A version records:
- label and optional management notes;
- media asset ID;
- sanitized source dimensions;
- content type and byte size;
- SHA-256 checksum;
- created timestamp;
- active state;
- published state and publication evidence;
- row version for optimistic concurrency.

Only one version per campground may be active and only one may be published.

The **active** image is the source chosen for current map editing. The **published** image is the version management has deliberately designated for publication. Build 018 records that decision; later map-publication/public-booking builds determine how the published source is rendered to customers.

## Authorization and audit

- upload/list/select-active requires `campground.map`;
- uploading also requires `media.manage`;
- publication requires `campground.map.publish`;
- upload and publication require an elevated-action reason;
- upload, activation and publication append audit evidence;
- image metadata remains tenant-scoped to the campground.

## Channel support

This is an inherently visual workflow.

- Web/PWA: full upload/version/preview/activate/publish workflow.
- IVR/DTMF: staff-assisted transfer.
- SMS/MMS: secure-link handoff to the authenticated visual editor.
- No telephone or SMS command can bypass map authorization or privileged publication control.

## Contextual help

Every Build 018 management section uses the circular ⓘ help control and links to the full `campground.map.images` help article.

## Manual configuration

Build 018 introduces **no new environment variable**. It reuses the Build 008 storage adapter.

If the management page reports **Storage status: not configured**, an administrator must:

1. Open the hosting provider's server-side environment-variable settings for iCamp.
2. Set `ICAMP_MEDIA_STORAGE_PROVIDER=supabase`.
3. Set `ICAMP_SUPABASE_URL` to the iCamp Supabase project HTTPS URL.
4. Add `ICAMP_SUPABASE_SECRET_KEY` as a **server-only secret**. Never use a `NEXT_PUBLIC_` name and never paste the secret into chat.
5. Confirm the existing Build 008 bucket migration `providers/supabase/storage/0001_media_buckets.sql` has been applied to the iCamp Supabase project.
6. Redeploy/restart the application so the server receives the variables.
7. Open **Management → Campgrounds → Overhead image library** and confirm the status shows **configured**.

Supplying the first real campground overhead/drone/site-plan image is intentionally a later real-pilot/manual-data step.
