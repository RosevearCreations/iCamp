# Build 034 — Accommodation Compatibility Engine

## Status

**IMPLEMENTED — PROMOTION IN PROGRESS.**

## Canonical roadmap scope

Build 034 owns:
- tent/RV/cottage compatibility;
- RV equipment length/width/height and utility fit;
- accessibility, pet, occupancy and feature compatibility;
- server-side rejection of incompatible booking choices.

## Delivered design

The engine reuses Build 025 campsite facts, Build 026 cottage facts and Build 033 capacity rules instead of duplicating them. Build 034 adds only missing compatibility facts: campsite accessibility plus explicit campsite/cottage pet policy.

`lib/accommodation-compatibility/core.mjs` is provider independent and returns deterministic eligibility plus user-facing incompatibility reasons. `assertCompatibleBookingChoice` exposes a stable throwing contract with code `ICAMP_ACCOMMODATION_INCOMPATIBLE` for booking commands.

The PostgreSQL service loads only campground-scoped authorized accommodation facts, folds in the Build 033 capacity evaluator, exposes a management preview and provides an audited optimistic-concurrency update for pet/accessibility policy.

## Server-authoritative rejection

Later booking commands can call `assertServerCompatibleBookingChoice` before creating or modifying a reservation. A failed fit is rejected before a booking choice can proceed.

## Channel support

- **Web/PWA:** full authenticated compatibility preview and policy management.
- **IVR/DTMF:** later reservation flows may submit structured tent/RV/cottage and utility requirements to the same server evaluator; structural compatibility editing remains Web/PWA with staff-assisted fallback.
- **SMS/MMS:** later reservation flows may receive compatibility results from the same server evaluator; free-form messages do not bypass server validation.

## Security and data integrity

- existing Build 024 FORCE RLS, direct-role revocation and `icamp_app` authorization remain authoritative for campsite/cottage rows;
- no new public Data API grants are introduced;
- compatibility policy writes require `accommodation.manage`;
- compatibility changes advance the parent accommodation availability revision;
- optimistic row-version checks prevent silent overwrites;
- changes append Build 006 audit evidence.

## Build boundaries

Build 034 does **not** own reservations, temporary holds, closures, turnover conflicts, seasonal assignments or live concurrency. Those remain **Build 035 — Server-Authoritative Live Availability** and later builds.

## Infrastructure

Build 034 adds no paid service, hosting project, worker, storage bucket, mapping provider or external runtime dependency.

## Promotion evidence

Pending feature, `dev` and `main` verification.

## Next build

**Build 035 — Server-Authoritative Live Availability**.
