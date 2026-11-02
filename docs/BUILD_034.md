# Build 034 — Accommodation Compatibility Engine

## Status

**FULLY PROMOTED — `main` GREEN.**

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

Hosted verification confirmed:
- three campsite compatibility columns and two rental-cottage pet columns;
- both compatibility availability-revision triggers;
- direct `anon` campsite SELECT denied;
- direct `authenticated` rental-cottage SELECT denied;
- trusted `icamp_app` campsite SELECT and rental-cottage UPDATE retained;
- Supabase Security Advisor: **zero findings**;
- Performance Advisor: existing `unused_index` INFO findings only, with no Build-034-specific security or missing-index regression.

## Build boundaries

Build 034 does **not** own reservations, temporary holds, closures, turnover conflicts, seasonal assignments or live concurrency. Those remain **Build 035 — Server-Authoritative Live Availability** and later builds.

## Infrastructure

Build 034 adds no paid service, hosting project, worker, storage bucket, mapping provider or external runtime dependency.

## Production promotion evidence

- Feature PR #133 validated the final feature head `ede3d2522e4ef0e8a7caa2378f5c5a9bbe58e7d1` with CI `38468896283`, CodeQL `38468896248`, and Secret Scan `38468896419` GREEN.
- Feature merge to `dev`: `8b7b4ecadc3a849f53c923667d2bbd47cdb67b27`.
- Independent `dev` push evidence: CI `38469271299`, CodeQL `38469270632`, Secret Scan `38469271251`, all GREEN.
- Hosted Supabase migration `accommodation_compatibility_engine` is live as version `20261013204945`.
- Hosted schema, privilege and trigger verification passed; Security Advisor reported zero findings.
- Production PR #134 passed fresh CI `38469821931`, CodeQL `38469822145`, and Secret Scan `38469822119` GREEN.
- Production merge to `main`: `be04c5b7fbb15e9292124b7a3b70af8e5a95d4bf`.
- Independent production `main` evidence: CI `38470159106`, CodeQL `38470159077`, Secret Scan `38470159045`, all GREEN.
- No manual user action was required to promote Build 034.

## Next build

**Build 035 — Server-Authoritative Live Availability**.
