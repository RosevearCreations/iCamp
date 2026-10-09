# Build 018 — Overhead Image Library & Versioning

## Status

**IN DEVELOPMENT — feature branch verification pending.**

## Roadmap scope

Build 018 delivers:
- real overhead/drone/site-plan image upload support;
- source dimensions and immutable version metadata;
- active/published map-version selection;
- safe image processing.

## Delivered design

- protected manager route at `/workspaces/management/campgrounds/maps`;
- JPEG/PNG/WebP preflight and metadata sanitization;
- byte, dimension and pixel-count safeguards;
- SHA-256 content checksum;
- internal secure-media storage with rollback deletion on failed registration;
- monotonically increasing campground map versions;
- single-active and single-published database constraints;
- audited active-version selection and privileged publication;
- authenticated image previews;
- admin freshness integration;
- circular ⓘ help on every Build 018 section;
- full help-centre topic.

## Full-platform roadmap clarification

The same change set clarifies the already planned full campground platform so the source of truth explicitly includes:
- campground equipment/fleet registry and preventive service history;
- restricted employment/compensation administration;
- occupational safety with OSHA-style / Canadian OHS-configurable tracking;
- advanced ledger, cost centres and job/service costing;
- tax worksheets/remittance-support schedules;
- one hosted iCamp platform with isolated campground tenants;
- platform-owner administration and monthly subscription entitlements;
- paid-scale migration without changing canonical campground data.

These are roadmap clarifications, not prematurely implemented Build 018 domains.

## Security and privacy

- map upload requires `campground.map` and `media.manage`;
- publication requires `campground.map.publish`;
- map source objects use opaque scoped object keys;
- common EXIF/XMP/text metadata is stripped before storage;
- database rows never contain image bytes or storage secrets;
- active/published uniqueness is database-enforced;
- publication is auditable and elevated-risk controlled.

## Omnichannel

- Web/PWA: full visual management workflow.
- IVR/DTMF: staff-assisted fallback.
- SMS/MMS: secure-link fallback.
- Resulting versions remain addressable by stable identifiers for later non-visual operations.

## Cost and portability

No new paid provider is required. Build 018 reuses the existing provider-neutral media model and current Supabase Storage development adapter.

## Manual action

No manual action is required to promote this build.

Real image upload later requires:
- the existing Build 008 storage variables/provider buckets to be configured;
- a real campground overhead/drone/site-plan image supplied by the campground.
