# Build 064 — Maintenance Taxonomy & Priority Model

## Status
**IMPLEMENTED — PROMOTION PENDING.**

## Queue authority
Active Build 064 advances to the next non-duplicative roadmap capability after the Build 063 security dashboard. It implements the historical roadmap's Build 065 maintenance taxonomy and priority foundation.

## Scope
Build 064 establishes the canonical campground-scoped maintenance classification model:
- standard categories for garbage/waste, fire/life safety, septic/wastewater, water systems, electrical, grounds and buildings/facilities;
- extensible custom maintenance service types;
- canonical Emergency / Urgent / Normal / Preventive priority levels;
- campground-configurable response and completion planning targets;
- active/inactive category lifecycle that preserves stable category identity;
- responsive Maintenance workspace configuration surface.

## Canonical data model
Build 064 adds:
- `public.maintenance_categories`;
- `public.maintenance_priority_policies`.

Standard taxonomy and the four priority rows are seeded for existing campgrounds. A database trigger seeds the same canonical baseline for future campgrounds.

Category codes are stable identities. Standard labels cannot be rewritten. Categories are deactivated/reactivated rather than deleted so later historical work orders can retain their classification references.

Priority policies use one row per campground and priority key. Completion targets cannot be shorter than response targets.

## Default planning targets
The initial campground baseline is:
- Emergency — response 15 minutes, completion 60 minutes;
- Urgent — response 60 minutes, completion 240 minutes;
- Normal — response 480 minutes, completion 1,440 minutes;
- Preventive — response 1,440 minutes, completion 10,080 minutes.

These are editable operational planning defaults, not legal or life-safety guarantees. Emergency services, fire/life-safety procedures, utility isolation rules and statutory requirements always take precedence.

## Authorization and security
- read access uses existing maintenance permissions and campground assignment;
- configuration changes require `maintenance.assign`;
- all public Build 064 tables enable and FORCE PostgreSQL RLS;
- direct `anon` and `authenticated` Data API access is revoked;
- `icamp_app` receives no DELETE privilege;
- priority-policy insertion is not exposed through `icamp_app`; canonical rows are seeded by the migration/database trigger;
- category creation and category/priority updates bind the actor to transaction-local `icamp.user_id`;
- category and priority mutations append Build 006 audit evidence;
- optimistic row-version checks prevent silent overwrite.

## Channel parity
- **Web/PWA:** full visual taxonomy and target configuration.
- **IVR/DTMF:** later maintenance workflows may read/choose the canonical category and priority values after staff verification, but structural configuration remains a visual administrative task.
- **SMS/MMS:** later maintenance workflows may use concise canonical values or secure-link handoff; free-form text does not redefine taxonomy or priority policy.
- All channels must call the same canonical backend rather than inventing channel-specific classifications.

## Boundaries
Build 064 does **not** create maintenance work orders, assignments, notes, media, material/labour records or completion evidence. Those belong to **Build 065 — Work Order Engine**.

Recurring hourly/daily/weekly/monthly/seasonal maintenance belongs to later scheduling scope and must reuse the Build 007 scheduler instead of creating a second background engine.

## Cost / portability
No paid service, new hosted project, external provider, secret or runtime dependency is required. The implementation uses the existing Next.js application and PostgreSQL/Supabase-compatible migration model.

## Verification
- unit/static tests cover required standard categories, custom-code validation, priority ordering, target validation and no-delete/RLS migration posture;
- migration verification checks both tables, forced RLS, Data API denial, canonical seed function/trigger and required policies;
- promotion evidence will be recorded after feature, `dev`, production PR and final `main` gates are GREEN.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 065 — Work Order Engine**, advancing the historical roadmap's Build 066 capability.
