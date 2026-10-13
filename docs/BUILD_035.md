# Build 035 — Server-Authoritative Live Availability

Status: **PRODUCTION READY — `dev` GREEN**

## Scope
Build 035 makes one server-side answer authoritative for whether an accommodation can be offered for a date window. It combines active reservations, unexpired temporary holds, Build 031 management closures/holds, unresolved Build 027 cottage turnover work and seasonal assignments.

Build 036 remains the owner of temporary-hold creation, countdown, expiry/release and idempotency. Build 035 defines the protected hold source and consumes it for availability/concurrency.

## Delivered
- protected reservation, temporary-hold source and seasonal-assignment records;
- PostgreSQL advisory-lock serialization for competing booking inventory writes;
- conflict rejection across reservations, holds, management restrictions, unresolved turnover and seasonal assignments;
- availability-revision propagation for live inventory changes;
- a single RLS-protected `icamp_private.live_accommodation_availability` server read model;
- stable `ICAMP_ACCOMMODATION_UNAVAILABLE` rejection contract;
- responsive Management → Campgrounds → Live availability workbench;
- automatic ten-second Web/PWA refresh with explicit generated-at/revision evidence;
- direct `anon`/`authenticated` table access denied.

## Channel contract
- **Web/PWA:** full live availability query and automatic refresh.
- **IVR/DTMF:** future booking workflows call the same server authority; visual inspection remains staff-assisted.
- **SMS/MMS:** future booking workflows call the same server authority; visual inspection uses secure-link/staff-assisted fallback.

## Verification
- repository unit/acceptance coverage includes all five blocker sources and the concurrency lock contract;
- feature PR #136 head `3d6eb1bb513ecf4412e5056443f6c121d167c33e`: CI `38478477745`, CodeQL `38478477734`, Secret Scan `38478477684` — all GREEN;
- feature merged to `dev` as `f9783d62a6570f68faf2cc28ed979ca36f2d7ebd` and independently cleared Verify, Browser E2E, Database migrations and Secret Scan;
- hosted Supabase migration `20261013223449` installed the authoritative availability model;
- hosted Supabase migration `20261013223746` installed nine covering foreign-key indexes after advisor review;
- hosted schema verification confirms all three source tables, authoritative function, concurrency triggers, direct-role denial and trusted `icamp_app` reads;
- Supabase Security Advisor: zero findings;
- Supabase Performance Advisor: Build-035-specific unindexed-foreign-key findings closed; only expected unused-index INFO remains immediately after index creation;
- advisor-hardening PR #137 head `a02743a37b35a8e54e7bff0d2761d9635f790c14`: CI `38478816624`, CodeQL `38478816607`, Secret Scan `38478816582` — all GREEN;
- advisor hardening merged to `dev` as `55d8b927cdea5ca1a86ebb3e82a5204e5b814179` and independently cleared Verify, Browser E2E, Database migrations and Secret Scan.

## Promotion
- feature branch: `build-035-server-authoritative-live-availability`
- feature PR: #136
- advisor hardening PR: #137
- `dev`: GREEN and production-ready
- `main`: pending production promotion

## Next queued build
**Build 036 — Atomic Temporary Reservation Holds**
