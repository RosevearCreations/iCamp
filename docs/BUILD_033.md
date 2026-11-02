# Build 033 — Capacity, Guest & Vehicle Limit Rules

## Status

**FULLY PROMOTED — `main` GREEN.**

## Canonical roadmap scope

Build 033 owns:

- maximum occupants;
- maximum visitors;
- maximum vehicles;
- rules by campground, section, accommodation type and individual accommodation;
- site-size-aware configurable limits.

## Delivered design

### Layered rule model

`public.capacity_limit_rules` stores append-preserved capacity rules at four levels:

1. campground;
2. accommodation type;
3. campground section;
4. individual accommodation.

Each rule can set any combination of:

- maximum occupants;
- maximum visitors;
- maximum vehicles.

Unspecified values inherit from broader matching rules. Resolution precedence is campground → accommodation type → section → individual accommodation.

A scope can have one active default rule plus optional non-overlapping campsite-area bands. A matching size band applies after the default at the same scope and may override only the fields it sets.

### Site-size-aware limits

Build 025 already stores campsite length and width. Build 033 derives site area from those physical facts and applies optional inclusive minimum/maximum square-metre bands.

If a campsite does not have both physical dimensions, area-banded rules do not apply; ordinary non-area rules still resolve normally.

Rental cottages continue to respect Build 026's physical `max_occupancy`. The capacity evaluator clamps any broader configured occupant limit to the cottage's physical sleeping capacity.

### Capacity evaluator

`lib/capacity-rules/core.mjs` provides a provider-independent evaluator that:

- validates rule shape and limit bounds;
- calculates campsite area;
- resolves matching rule layers;
- applies same-scope area-band overrides;
- preserves partial inheritance;
- applies physical cottage occupancy as a hard ceiling;
- evaluates proposed occupant, visitor and vehicle counts;
- returns effective limits, rule sources and user-facing issues.

### Visible management interface

Management → Campgrounds → **Capacity, guest & vehicle limits** provides:

- campground selection;
- capacity-rule readiness summary;
- campground/type/section/accommodation rule creation;
- optional campsite-area bands;
- occupant/visitor/vehicle limits;
- append-preserved archive controls;
- a proposed-count preview against a selected accommodation;
- visible physical cottage occupancy and measured campsite area where available.

The Campground Administration page links directly to the Build 033 workbench.

## Security and data integrity

The new public-schema table:

- enables and FORCEs PostgreSQL RLS;
- denies direct `public`, `anon` and `authenticated` access;
- grants only SELECT/INSERT/UPDATE to the trusted `icamp_app` role;
- intentionally grants no DELETE privilege;
- allows reads to relevant campground/accommodation/reservation permissions;
- requires `campground.configuration` for writes;
- binds create/archive writes to the transaction-local `icamp.user_id`;
- includes explicit foreign-key/query indexes;
- prevents more than one active default rule in the same exact scope;
- prevents overlapping active campsite-size bands in the same exact scope;
- serializes same-scope rule creation with a PostgreSQL advisory transaction lock;
- preserves rule content after creation; managers archive and replace instead of rewriting historical evidence.

Create and archive operations append audit evidence.

The design continues to account for Supabase's 2026 Data API exposure changes by using the trusted direct PostgreSQL application role rather than relying on automatic browser/API exposure.

## Build boundaries

Build 033 does **not** own:

- equipment length, utilities, accessibility, pets or broader accommodation fit — **Build 034**;
- reservations, temporary holds, closures, turnover conflicts or server-authoritative live inventory — **Build 035**;
- atomic reservation holds — **Build 036**;
- public booking-map selection — **Build 037**;
- extra-guest, visitor, vehicle or pass fees — **Build 040**;
- visitor registration lifecycle — **Build 055**.

## Channel support

- **Web/PWA:** full authenticated manager configuration and capacity-preview support.
- **IVR/DTMF:** later reservation workflows may evaluate these rules server-side, but structural rule editing remains a Web/PWA management task with staff-assisted fallback.
- **SMS/MMS:** later reservation workflows may receive safe capacity results, but free-form messaging cannot structurally edit capacity rules.
- No public guest booking surface is introduced by this build.

## Infrastructure

Build 033 adds **no new paid service**, hosting project, worker, storage bucket, mapping provider or external runtime dependency.

## Production promotion evidence

- Feature PR #130 validated the Build 033 feature branch with fresh Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan GREEN.
- Feature head after formatting/type correction: `10adb9eef7ed6af57bb44076d1404741e9583797`.
- Feature merge to `dev`: `a8a217018ee494359143f7b9d8bd9246ff3493a8`.
- Independent `dev` push evidence: CI `38438235223`, CodeQL `38438234956`, Secret Scan `38438234886`, all GREEN.
- Hosted Supabase migration `0041_capacity_guest_vehicle_limit_rules` is live as version `20261013172550`.
- Hosted repository verification passed. `capacity_limit_rules` has RLS enabled and FORCE RLS, `icamp_app` has SELECT/INSERT/UPDATE and no DELETE, and the read/insert/archive policies plus guard/ambiguity/touch triggers are present.
- Supabase Security Advisor reported **zero findings** after migration 0041.
- Supabase Performance Advisor reported only expected `unused_index` INFO for fresh Build 033 indexes; there was no Build-033-specific security, missing-FK, RLS or policy regression requiring hardening.
- Production PR #131 passed fresh Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan gates.
- Production feature merge to `main`: `048dd3fb874f6404b99d0c8ebfba91fd8bc51e31`.
- Independent production `main` evidence: CI `38438995955`, CodeQL `38438995877`, Secret Scan `38438996078`, all GREEN.
- No manual user action was required to promote Build 033.

## Next build

**Build 034 — Accommodation Compatibility Engine**.
