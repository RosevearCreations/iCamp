# Build 008 — Secure Media & Document Storage Foundation

Status: **FULLY PROMOTED — `main` PRODUCTION GREEN**

## Scope

Build 008 delivers the active-roadmap secure media/document foundation:

- public/internal/confidential media classes;
- signed access for private media;
- image/document validation and limits;
- durable metadata and lifecycle evidence.

## What was delivered

### Portable database model

`database/migrations/0010_secure_media_document_storage.sql` adds:

- `icamp_private.media_assets`;
- `icamp_private.media_lifecycle_events`;
- `media.read`;
- `media.manage`;
- `media.confidential.read`;
- lifecycle guards and append-only evidence.

The canonical metadata model is provider-neutral PostgreSQL. Object bytes are not stored in PostgreSQL.

### Validation and runtime

`lib/media/validation.mjs` validates:

- media classification;
- safe plain filenames;
- approved MIME type;
- matching filename extension;
- byte-size limits;
- binary file signatures for JPEG, PNG, WebP, GIF and PDF.

Application limits are 12 MiB for images and 25 MiB for PDF documents. SVG, HTML, executable and arbitrary file formats are rejected by this foundation.

`lib/media/postgres.mjs` provides permission-controlled registration and lifecycle changes with transactional audit/lifecycle evidence.

`lib/media/storage.mjs` defines the current Supabase object-storage adapter while preserving a provider-neutral domain boundary.

`app/api/media/[mediaId]/access/route.ts`:

- serves a public URL only for active public assets;
- requires an active iCamp staff session for private assets;
- requires `media.read` for internal media;
- requires `media.confidential.read` for confidential media;
- issues only short-lived private provider URLs after canonical campground authorization succeeds.

### Current development provider

`providers/supabase/storage/0001_media_buckets.sql` defines:

- `icamp-public-media` — public read;
- `icamp-internal-media` — private;
- `icamp-confidential-media` — private.

All three enforce the approved MIME set and a 25 MiB provider ceiling. No browser upload/update/delete policies were added; those operations remain trusted-server responsibilities.

### I.T. & Analysis

The protected I.T. workspace now exposes only safe aggregate media health:

- registered assets;
- active assets;
- quarantined assets;
- active public/internal/confidential counts.

Object paths, original filenames, signed URLs, provider credentials, media bytes and document contents remain private.

## Security and privacy

- browser-facing database roles cannot read private media metadata directly;
- iCamp authentication/authorization remains authoritative instead of Supabase Auth;
- provider credentials are server-only;
- user filenames never become storage object keys;
- object keys use canonical UUID scope/asset identifiers;
- private signed URL lifetime is bounded to 60–900 seconds, default 300 seconds;
- signed URLs are not persisted in durable metadata;
- lifecycle events are append-only;
- only validated assets may become active;
- deleted is terminal;
- object deletion is the emergency access-cutoff mechanism when an already issued signed URL must be invalidated immediately rather than relying only on URL expiry.

## Omnichannel coverage

- **Web/PWA:** direct use of the canonical media layer.
- **IVR/DTMF:** no raw binary transfer; flows use authorized asset IDs plus staff-assisted or secure-link handoff.
- **SMS/MMS:** later MMS intake reuses the same validation/storage boundary; private reads use secure authenticated handoff rather than durable provider URLs.
- **Staff-assisted call:** uses the same iCamp authorization and lifecycle controls.

No channel-specific path bypasses the canonical campground permission engine.

## Automated proof

CI verifies:

- Prettier/format integrity;
- lint;
- TypeScript;
- repository/unit tests;
- Next.js production build;
- high/critical production dependency audit;
- PostgreSQL migrations and verification;
- authentication lifecycle;
- authorization lifecycle;
- audit/privileged-action lifecycle;
- background-job lifecycle;
- Build 008 media lifecycle;
- migration-history idempotency;
- Secret Scan;
- CodeQL.

The Build 008 lifecycle proof verifies unauthorized rejection, registration, activation, quarantine, restore, archive, deletion, terminal deletion, append-only lifecycle events and aggregate media health.

## Supabase hosted verification

The connected RosevearCreations iCamp project has canonical migration:

- `0010_secure_media_document_storage`.

Hosted verification proved:

- both private media tables and required indexes exist;
- `anon` and `authenticated` have no `icamp_private` schema usage;
- neither browser-facing role has direct media-table SELECT access;
- the public/internal/confidential bucket visibility is correct;
- bucket MIME restrictions and 25 MiB provider limits are correct;
- rollback-only lifecycle verification exercised registered → active → archived and append-only rejection;
- rollback proof retained zero media assets, zero lifecycle events and zero synthetic organizations;
- Supabase Security Advisor reports **zero security lints**;
- Performance Advisor has only INFO-level unused-index observations expected on the new/empty development dataset and no Build 008 release-blocking finding.

## Promotion evidence

Feature implementation:

- feature branch: `build-008-secure-media-document-storage`;
- PR #26 → `dev`;
- exact tested feature head: `c4fbc9eaa8c97d61c2eff39f4bd96884b2bbe779`;
- exact tested tree: `a26d9dde2c1f117f068ca06d5dd27322ae1fd499`;
- PR checks: CI GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Development promotion:

- `dev` merge SHA: `40c7e195732b1886bc9c771c5730a07ad53e34aa`;
- `dev` tree: `a26d9dde2c1f117f068ca06d5dd27322ae1fd499`;
- independent `dev` push proof: CI GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Production candidate:

- PR #27 → `main`;
- exact `dev` head: `40c7e195732b1886bc9c771c5730a07ad53e34aa`;
- PR merge candidate: `5ca02dfe40723bf7d1a20ef2557e2df97f7c6b5b`;
- candidate tree: `a26d9dde2c1f117f068ca06d5dd27322ae1fd499`;
- PR checks: CI GREEN, Database GREEN, Secret Scan GREEN, CodeQL GREEN.

Production implementation:

- `main` SHA: `64576f79f7e86a1578e77f2ed3e793227e2386c0`;
- production tree: `a26d9dde2c1f117f068ca06d5dd27322ae1fd499`;
- independent `main` push proof:
  - CI / Verify — GREEN;
  - Database migrations and all lifecycle checks — GREEN;
  - Secret Scan — GREEN;
  - CodeQL — GREEN.

The exact Git tree is unchanged from the tested feature head through `dev`, the production candidate and the production implementation.

## Cost and portability

The current development provider is Supabase Storage. No new paid service is required for this foundation.

The canonical media IDs, classification, authorization, validation and lifecycle model remain independent of Supabase. A later S3-compatible, R2, self-hosted or other storage adapter can replace the provider without rewriting campground business workflows.

## Manual action

**None.**

No manual dashboard action, secret entry or provider setup is required to complete Build 008 promotion. A server-side storage secret will be required later when real upload/private-read runtime deployment is connected; that is intentionally not required for this foundation build.

## Next build

**Build 009 — Omnichannel Communications Foundation**
