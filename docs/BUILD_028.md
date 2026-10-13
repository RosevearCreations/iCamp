# Build 028 — Site/Cottage Public Gallery: Up to 10 Images

## Status
**FEATURE IMPLEMENTED — promotion in progress.**

## Roadmap scope
- maximum 10 active public images per campsite or rental cottage;
- hero ordering, captions and required alternative text;
- thumbnail and optimized delivery variants;
- strict separation from internal maintenance/housekeeping/security media.

## Interface decision
Build 028 also formalizes the first durable iCamp application interface direction: the **Operations Workbench**.

The global shell remains organized by role-oriented workspaces. Inside an operational area, the user works within campground/property context and then opens one canonical domain object whose facts and tasks are assembled into one workbench.

The Accommodation Assembly is the first full example. It now puts Builds 024–028 together:
- canonical accommodation identity and map linkage;
- campsite utilities, characteristics and physical fit;
- rental-cottage facilities and occupancy;
- turnover/housekeeping readiness;
- curated public site/cottage photography.

Build numbers remain useful implementation provenance inside the evolving workbench, but they are not the application navigation model. The global shell has therefore been changed from the stale Build 004 status label to a product-oriented Operations Workbench status.

See `docs/INTERFACE_DIRECTION.md`.

## Public gallery model
Migration `0032_accommodation_public_gallery.sql` adds `public.accommodation_public_gallery_images`.

Each gallery row belongs to exactly one canonical campsite or rental cottage and references three Build 008 media assets:
- validated source image;
- public thumbnail;
- public optimized display image.

The database enforces:
- only campsite/rental-cottage parents;
- same organization/campground scope;
- active, validated, public image media;
- distinct source/thumbnail/optimized asset identities;
- at most 10 active gallery images per accommodation;
- at most one active hero image;
- sort order from 1 through 10;
- required alternative text;
- bounded source/variant dimensions.

Permanent-unit gallery policy remains outside this build.

## Free-first image delivery
Build 028 deliberately avoids Supabase Storage image transformations because that feature is not required for the free development path.

The browser prepares common WebP variants before upload:
- thumbnail: maximum 360 px generated target, database ceiling 480 px;
- optimized display: maximum 1440 px generated target, database ceiling 1800 px.

The server validates WebP headers, dimensions and source aspect ratio before accepting those variants.

All three objects reuse the existing `icamp-public-media` bucket and existing provider-neutral storage adapter. No new bucket, Vercel project, Cloudflare project, worker or paid image service is introduced.

A future image-processing adapter can replace browser-side derivative generation without changing accommodation or gallery identities.

## Public vs operational media
Gallery membership is an explicit publication boundary.

Public gallery records may reference only `classification = 'public'` media. Internal maintenance, housekeeping, damage and security evidence remain in their own operational workflows and cannot become guest-facing merely because they relate to the same accommodation.

Build 038 can consume the Build 028 gallery for the later guest campsite/cottage detail and booking experience.

## Management workflow
Authorized managers can:
- upload a JPEG, PNG or WebP source;
- supply required accessible alternative text;
- optionally add a public caption;
- see hero and thumbnail previews;
- reorder images from 1–10;
- nominate another image as hero;
- remove an image from the public gallery.

The first active image becomes the hero automatically. Removing the hero promotes the next active image by gallery order.

Gallery writes require both `accommodation.manage` and `media.manage`. Read-only management rendering uses the existing accommodation read boundary.

## Security and audit
The public gallery metadata table:
- enables and forces PostgreSQL RLS;
- denies direct public, `anon` and `authenticated` table access;
- uses the trusted `icamp_app` application role for the RLS management path;
- validates media publication state again in PostgreSQL;
- uses optimistic row-version checks for metadata changes;
- uses an accommodation advisory lock while adding media to prevent concurrent requests from bypassing the ten-image maximum.

Gallery create, update and archive operations append audit evidence. Media registration/activation/archive also retains Build 008 lifecycle evidence.

Public object URLs contain provider/object paths by design, but object keys are UUID-based and filenames are not used as public object paths. Server provider credentials remain server-only.

## Channels
- **Web/PWA:** full visual gallery upload, preview, ordering, accessibility metadata and removal.
- **IVR/DTMF:** visual editing has no keypad equivalent; later flows may describe concise gallery facts or transfer to staff.
- **SMS/MMS:** later flows may provide a secure visual handoff or public detail link; administrative editing remains authenticated Web/PWA or staff-assisted.
- Public/guest consumption is intentionally deferred to the Build 038 campsite/cottage detail experience.

## Verification plan
Automated coverage verifies:
- schema constraints, gallery cap, hero uniqueness and direct-role denial;
- gallery service permission, media and audit boundaries;
- real thumbnail/optimized variant validation;
- visible integration with the Accommodation Workbench;
- responsive gallery interface primitives;
- the Operations Workbench interface source of truth;
- preservation of the Build 027 turnover workflow.

Before production promotion:
- feature PR CI, Browser E2E, database lifecycle, CodeQL and Secret Scan must be GREEN;
- independent `dev` push must be GREEN;
- hosted Supabase migration 0032 must be applied and verified;
- Security and Performance Advisors must be reviewed and current-build findings resolved;
- production PR and independent `main` push must be GREEN.

## Platform impact
Build 028 remains on the existing Next.js/PostgreSQL/Supabase stack and existing Supabase Storage media buckets.

No new paid service or hosted project is required.

## Manual action
No manual user action is currently required.

## Queue
Build 028 remains the active queued build until production closeout is complete.

After Build 028 is fully promoted, the next build is:

**Build 029 — Operational Asset & Equipment/Fleet Model**
