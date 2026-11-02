# Build 024 — Unified Accommodation Model

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- canonical accommodation parent model;
- campsite/cottage/permanent-unit subtype linkage;
- shared availability/status hooks.

## Architecture boundary
Build 024 creates one canonical accommodation identity shared by booking, map, availability and future operational workflows. Every accommodation links to exactly one Build 023 canonical map object and exactly one subtype shell:
- campsite;
- rental cottage;
- permanent unit.

The common parent owns only cross-subtype identity and lifecycle fields. Build 025 owns campsite types/utilities/dimensions, Build 026 owns cottage-specific facilities/occupancy, Build 028 owns public galleries, and Build 030 owns detailed status history and transition rules.

## Shared hooks
The parent includes monotonic `availability_revision` and `status_revision` counters plus application-level hook contracts. Build 024 exposes lifecycle-aware shared hook payloads without inventing the later reservation/status engines early.

## Map identity
- campsite -> Build 023 `site` map object;
- rental cottage -> Build 023 `cottage` map object;
- permanent unit -> Build 024-supported `permanent_unit` map object.

The accommodation and map object must share organization, campground and section. One map object can belong to only one accommodation.

## Authorization
The public accommodation tables use forced RLS through the trusted `icamp_app` role:
- `accommodation.read` or `accommodation.manage` can read;
- `accommodation.manage` is required to create/update;
- no direct `anon` or `authenticated` table access is granted.

## Channel support
- Web/PWA: full accommodation registry and common-field administration.
- IVR/DTMF: accommodation codes/names can be used in future non-visual flows; structural administration remains staff-assisted.
- SMS/MMS: accommodation codes can be referenced; administration uses authenticated Web/PWA or staff assistance.

## Platform impact
Build 024 remains on the existing Next.js/PostgreSQL/Supabase stack. No new Vercel, Cloudflare, paid mapping or external inventory resource is required.

## Promotion evidence
- Final feature head: `028e062b8c58f914835c35df14665767185a3d7b`.
- Feature PR #92 passed CI `38251817785`, CodeQL `38251817772` and Secret Scan `38251817919`; Verify, Browser end-to-end and Database migrations all succeeded.
- Feature merge into `dev`: `029b7e771ab8d0cc99c972e22d5864b6dd7673ba`.
- Independent `dev` proof: CI `38252020975`, CodeQL `38252020986` and Secret Scan `38252020883` all succeeded.
- Hosted Supabase migration `0027_unified_accommodation_model`: version `20261012125624`.
- Supabase Security Advisor returned zero findings after migration 0027.
- Supabase Performance Advisor reported no Build 024 unindexed-foreign-key finding; only expected unused-index INFO was present on the empty prototype database.
- Production PR #93 passed CI `38252297013`, CodeQL `38252297188` and Secret Scan `38252297196`.
- First production merge on `main`: `27bd1223f098c4b6d6a48be9d830791ec91bcbd7`.
- Production push proof: CI `38252538101`, CodeQL `38252538144` and Secret Scan `38252538111` all succeeded; Verify, Browser end-to-end and Database migrations were GREEN.

## Manual action
No manual user action was required to promote Build 024.
