# Build 031 — Management Closures, Holds & Map Publication

## Status

**IMPLEMENTED ON FEATURE BRANCH — PROMOTION PENDING.**

## Scope

Build 031 adds management-controlled date restrictions and safe map publication on top of the current-state engine from Build 030.

Delivered scope:

- bulk all-day closures and holds for one or many accommodations, operational assets or campground sections;
- inclusive start/end operating dates and required management reasons;
- database-level overlap protection per target;
- explicit audited replacement of an overlapping restriction instead of silent edits;
- cancellation-only mutation semantics after a restriction is created;
- ENABLE + FORCE RLS with a dedicated campground.operations.manage permission;
- direct anon/authenticated access denied and no application DELETE grant;
- responsive Management → Campgrounds → Status controls for scheduling, reviewing and cancelling restrictions;
- canonical-map publication readiness counts for active map objects;
- publication blocked when map objects are unbound or still bound to another image version;
- explicit audited override for deliberately publishing with binding gaps;
- append-only published-map switch evidence with monotonically increasing campground publication revisions;
- map-version UI now exposes readiness, override controls and publication history.

## Boundary

Build 031 owns management restriction records, overlap/supersession semantics, cancellation evidence and published-map version switching.

Build 032 — Booking Calendar & Date Rules remains authoritative for:

- check-in/check-out time rules;
- booking windows;
- minimum/maximum stay rules;
- weekend, holiday and season calendars.

Build 035 remains authoritative for resolving reservations, holds, management restrictions, turnover and seasonal assignments into live availability.

Build 031 does not silently rewrite Build 030 current status when a future-dated restriction is scheduled.

## Security and database design

Management restrictions are public-schema records protected by FORCE RLS. The campground.operations.manage permission is granted to campground managers and owner/admin roles. Created restrictions cannot be edited in place: they may only be cancelled with an actor and reason, then replaced when necessary.

The database overlap trigger takes a target-scoped transaction advisory lock before checking date overlap, protecting direct writes from same-target races. Server-side bulk commands add optimistic row-version checks for cancellation and append privileged audit events.

Published-map history is kept in the private schema and protected by an append-only trigger. A map switch records the previous version, new version, readiness counts, override use, actor, reason and publication revision.

No new paid service, hosting project, worker, storage bucket or external runtime is introduced.

## Promotion evidence

Promotion evidence will be recorded here after the feature branch passes CI, dev passes independent post-merge checks, hosted Supabase migration/advisors are verified, and main passes independent production checks.

## Next build after closeout

**Build 032 — Booking Calendar & Date Rules**

Status: **NOT STARTED UNTIL BUILD 031 IS FULLY PROMOTED**
