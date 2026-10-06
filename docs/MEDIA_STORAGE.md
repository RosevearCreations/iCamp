# iCamp Secure Media & Document Storage

## Purpose

Build 008 establishes the reusable storage boundary used by later map imagery, accommodation galleries, maintenance evidence, incident evidence and document-management builds.

The canonical iCamp media model is deliberately provider-neutral. PostgreSQL stores secure metadata and lifecycle evidence; object bytes live in an object-storage provider behind an adapter.

## Classification

Every media asset is explicitly classified as one of:

- **public** — content intentionally suitable for unauthenticated retrieval, such as later published accommodation imagery;
- **internal** — operational content available only to assigned staff with `media.read`;
- **confidential** — sensitive operational/document content requiring the narrower `media.confidential.read` permission.

Classification is server-authoritative. A client cannot convert a private object into public media merely by constructing a URL.

## Storage layout

The current development adapter is Supabase Storage with three buckets:

- `icamp-public-media` — public reads, server-controlled writes;
- `icamp-internal-media` — private;
- `icamp-confidential-media` — private.

Provider configuration is versioned in `providers/supabase/storage/0001_media_buckets.sql`.

The portable domain schema never depends on Supabase bucket internals. A future S3-compatible, R2, self-hosted or other object-storage adapter can preserve the same iCamp asset IDs, classification and lifecycle semantics.

## Authorization and signed access

iCamp authentication and campground authorization remain authoritative.

For internal/confidential reads:

1. the application resolves the iCamp session;
2. it verifies the staff member is assigned to the asset's campground;
3. it checks `media.read` or `media.confidential.read`;
4. only then does the trusted server request a short-lived provider URL.

Signed URLs default to 300 seconds and are bounded to 60–900 seconds.

The storage provider's identity system never substitutes for iCamp authorization. Provider secret/service credentials are server-only and are never exposed through `NEXT_PUBLIC_*` configuration.

## Validation and limits

The application validates before upload:

- JPEG — 12 MiB maximum;
- PNG — 12 MiB maximum;
- WebP — 12 MiB maximum;
- GIF — 12 MiB maximum;
- PDF — 25 MiB maximum.

Validation requires all of:

- approved classification;
- plain filename without path/control characters;
- approved MIME type;
- matching filename extension;
- size within the application limit;
- matching binary file signature/magic bytes.

SVG, HTML, executable formats and arbitrary uploads are rejected by this foundation.

Object keys use iCamp UUIDs rather than user filenames, preventing path traversal and avoiding sensitive filenames in storage URLs.

The current Supabase buckets also enforce a 25 MiB provider-level ceiling and the same allowed MIME set. Application-side limits remain the stricter source for image size.

## Metadata and lifecycle

`icamp_private.media_assets` records:

- organization/campground scope;
- classification and media kind;
- provider/bucket/object identifier;
- original filename;
- MIME type and byte size;
- optional SHA-256 checksum;
- validation state;
- lifecycle state;
- creator and lifecycle timestamps.

Lifecycle states are:

`pending -> active / quarantined / deleted`

`active -> quarantined / archived / deleted`

`quarantined -> active / archived / deleted`

`archived -> active / deleted`

`deleted` is terminal.

Only validated assets may become active.

`icamp_private.media_lifecycle_events` is append-only evidence of registration, activation, quarantine, restore, archive and deletion.

## Diagnostic privacy

I.T. & Analysis may expose aggregate counts only. It does not expose:

- object keys or signed URLs;
- provider credentials;
- original filenames;
- document contents;
- media bytes;
- confidential descriptions.

Signed URLs must not be written to audit logs, queue payloads, analytics, support bundles or long-lived database metadata.

## Omnichannel contract

- **Web/PWA:** later visual/media workflows use this storage foundation directly.
- **IVR/DTMF:** no raw binary transfer; canonical domain records may reference authorized asset IDs and staff-assisted/secure-link handoff.
- **SMS/MMS:** later MMS intake may feed this same validation and storage boundary; private reads use a secure authenticated link rather than exposing provider URLs in durable message history.
- **Staff-assisted call:** staff uses the same iCamp authorization and asset lifecycle controls.

Media storage never creates a channel-specific authorization bypass.

## Free-first and scale path

Supabase Storage is the current development adapter. Core media semantics remain portable.

Scale/migration path:

1. export/copy objects to the replacement object store;
2. implement the provider adapter;
3. update provider/bucket/object references through a controlled migration;
4. retain iCamp asset IDs, classifications, permissions and lifecycle history.

No business workflow should depend directly on a Supabase-specific object ID.
