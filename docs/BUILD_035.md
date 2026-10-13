# Build 035 — Server-Authoritative Live Availability

Status: **IMPLEMENTED — PROMOTION IN PROGRESS**

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
- database verification checks source tables, authoritative function, concurrency triggers and direct-role denial;
- hosted migration/advisor evidence will be recorded during promotion.

## Promotion
- feature branch: `build-035-server-authoritative-live-availability`
- dev: pending
- main: pending

## Next queued build
**Build 036 — Atomic Temporary Reservation Holds**
