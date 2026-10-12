# Build 024 — Unified Accommodation Model

## Status
**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action
No manual user action is expected unless the connected Supabase project rejects the Build 024 migration for an external configuration reason.
