# Build 031 — Management Closures, Holds & Map Publication

## Status

**FULLY PROMOTED — `main` GREEN.**

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

Build 031 completed the full protected promotion path:

- feature PR #123 passed Verify, Browser E2E, Database migrations/idempotence, CodeQL/JavaScript analysis and Secret Scan before merge to `dev`;
- the feature merged to `dev` and the resulting dev commit passed an independent full GREEN validation;
- hosted Supabase migration `0038_management_closures_holds_map_publication` is live as version `20261013141614`;
- hosted advisor hardening migration `0039_management_controls_advisor_hardening` is live as version `20261013142221`;
- hosted FORCE RLS, no application DELETE privilege, overlap trigger and append-only map-publication evidence were verified;
- Supabase Security Advisor reports zero findings;
- all Build-031-specific Performance Advisor findings were closed: six missing foreign-key covering indexes and three duplicate permissive SELECT policies; only expected young-database unused-index INFO remains;
- advisor-hardening PR #124 passed the full gate set, merged to `dev`, and the resulting dev commit passed an independent full GREEN validation;
- production PR #125 passed fresh Verify, Browser E2E, Database migrations/idempotence, CodeQL/JavaScript analysis and Secret Scan gates;
- production merge SHA `7f5161a722ef4e9b9196405361f087b719ee27b7` passed independent post-merge `main` validation.

No manual user action was required to promote Build 031.

## Next build after closeout

**Build 032 — Booking Calendar & Date Rules**

Status: **QUEUED — NOT STARTED**
