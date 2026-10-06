# Build 008 — Secure Media & Document Storage Foundation

Status: **IMPLEMENTED — PROMOTION PENDING**

## Scope

Build 008 implements the active-roadmap storage foundation:

- public/internal/confidential media classes;
- signed access for private media;
- image/document validation and limits;
- durable metadata and lifecycle evidence.

## Implementation

### Portable database model

`database/migrations/0010_secure_media_document_storage.sql` adds:

- `icamp_private.media_assets`;
- `icamp_private.media_lifecycle_events`;
- `media.read`;
- `media.manage`;
- `media.confidential.read`;
- lifecycle guards and append-only evidence.

### Validation and runtime

`lib/media/validation.mjs` validates classification, filename, MIME type, extension, size and binary signatures before upload.

`lib/media/postgres.mjs` provides permission-controlled metadata registration and lifecycle changes with transactional audit evidence.

`lib/media/storage.mjs` defines the current Supabase object-storage adapter while keeping the domain contract provider-neutral.

`app/api/media/[mediaId]/access/route.ts` returns public media URLs only for active public assets and issues short-lived private URLs only after the canonical iCamp campground permission check succeeds.

### Current development provider

`providers/supabase/storage/0001_media_buckets.sql` defines the current three-bucket Supabase layout and provider-enforced MIME/size restrictions.

## Security

- browser-facing database roles cannot read private media metadata directly;
- provider credentials are server-only;
- user filenames never become object keys;
- SVG/HTML/executable uploads are outside the allowed foundation;
- private reads require active iCamp staff authorization;
- confidential reads require a narrower permission;
- signed URLs are short-lived and never stored in durable metadata;
- lifecycle evidence is append-only.

## Automated proof

- `tests/media-validation.test.mjs`;
- `tests/media-storage.test.mjs`;
- `scripts/verify-media-lifecycle.mjs`;
- PostgreSQL migration verification;
- repository acceptance checks;
- normal Verify, database, secret-scan and CodeQL gates.

## Omnichannel

Web/PWA uses the media layer directly. IVR/DTMF and SMS do not receive raw private object access; non-visual channels use authorized asset IDs, staff assistance or secure-link handoff. Later MMS support will reuse the same validation/storage boundary.

## Promotion evidence

Promotion evidence will be recorded after the exact tested feature tree is merged through `dev` and `main`.

## Next build

**Build 009 — Omnichannel Communications Foundation**
