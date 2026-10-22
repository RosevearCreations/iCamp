# Build 070 — Washroom, Shower & Laundry Upkeep

## Status
**IMPLEMENTED — PROMOTION PENDING.**

## Queue authority
Build 070 advances the active maintenance roadmap after Build 069 and implements the historical roadmap's Build 071 washroom/shower/laundry capability.

## Delivered scope
- campground-scoped upkeep programs for washrooms, showers, laundry rooms and combined comfort stations;
- reuse of canonical operational assets rather than a second facility registry;
- binding to an existing Build 067 recurring maintenance schedule and published Build 068 inspection template;
- Web/PWA controls for scheduled inspections, cleanliness/fixture/supply snapshots and corrective issue escalation;
- append-only facility status evidence for cleanliness, fixtures/machines and consumable supply posture;
- defects and supply problems escalated into canonical Build 065 maintenance work orders;
- issue resolution derived only from the linked canonical work-order status;
- existing Build 066 foreman/escalation behavior remains the responsibility authority;
- campground-scoped forced RLS and audit events on configuration, inspection, status and issue-link actions.

## Data model
Build 070 adds four narrowly scoped tables:
- `facility_upkeep_programs` — one facility-to-schedule/template binding;
- `facility_upkeep_inspection_evidence` — append-only links to canonical inspection and scheduled-work evidence;
- `facility_upkeep_snapshots` — append-only cleanliness, fixture and consumable-supply observations;
- `facility_upkeep_issue_links` — append-only links from facility issues to canonical maintenance work orders.

The build deliberately does **not** create a second scheduler, inspection engine, work-order model, asset-status model or issue-closure state.

## Facility targeting
- canonical washroom assets can be classified as washroom, shower, laundry or combined upkeep profiles;
- existing building/other facility assets may host shower, laundry or combined profiles when the property models those functions as a building;
- a washroom profile itself must target a canonical washroom operational asset;
- program templates and recurring schedules must target the exact same canonical asset.

## Scheduling & inspection
The existing Build 067 scheduler remains authoritative for when cleaning work becomes due and materializes the canonical work order.

Build 070 may link the latest unresolved scheduled occurrence to:
- a newly started Build 068 inspection occurrence;
- a recorded facility-status snapshot.

The Build 068 template version remains authoritative for checklist items and whether independent sign-off is required.

## Supplies and condition
A facility status snapshot records:
- cleanliness: Clean / Service Due / Closed for Service;
- fixtures or laundry machines: Operational / Attention / Out of Service;
- supplies: Stocked / Low / Out / Not Applicable;
- optional operational notes.

Snapshots are append-only evidence. They do not mutate or replace the canonical asset operating-state authority.

## Issue escalation and closure
Staff with `maintenance.create` can escalate a cleanliness, fixture, supply, safety, laundry-machine or other issue.

The escalation creates a normal Build 065 maintenance work order against the same canonical facility asset and records an append-only Build 070 link.

There is intentionally **no Build 070 issue-status column**. An issue is resolved only when the linked canonical work order is `completed` or `cancelled`.

## Authorization
Build 070 introduces no duplicate permission vocabulary:
- read visibility reuses existing maintenance permissions;
- configuration reuses `maintenance.schedule`;
- inspection execution reuses `inspection.perform`;
- condition/supply recording reuses `maintenance.create` or `maintenance.complete`;
- issue escalation reuses `maintenance.create`;
- work assignment, escalation and completion continue through the existing maintenance authorities.

## RLS and evidence integrity
All Build 070 tables:
- enable and FORCE PostgreSQL RLS;
- deny direct public/anon/authenticated access;
- prohibit direct DELETE access for `icamp_app`.

Inspection evidence, status snapshots and issue links are append-only.

Database guards enforce:
- same campground/organization scope;
- same canonical asset across program, template, schedule and evidence;
- exact schedule occurrence/work-order pairing;
- work-order issue links targeting the same facility;
- request-actor identity for evidence writers.

## Web/PWA workflow
The maintenance workspace now exposes **Washroom, Shower & Laundry Upkeep** ahead of the lower-level maintenance tools.

Operators can:
1. choose a campground;
2. bind an eligible facility to a published inspection template and recurring cleaning schedule;
3. start a scheduled/ad-hoc facility inspection;
4. record current cleanliness, fixture/machine and supply status;
5. escalate a defect into a canonical work order;
6. review snapshot, inspection and corrective-work history.

## Channel boundary
Web/PWA is the full rich interface. Verified IVR/DTMF or SMS workflows may report a facility defect or request supported status facts through existing communications/identity controls. Rich checklist configuration and evidence review use secure-link or staff-assisted handoff.

iCamp records operational upkeep. It does not replace required public-health, accessibility, electrical, plumbing, laundry-equipment, occupational-safety or emergency procedures.

## Visual/theme prerequisite
Build 070 does not add an independent visual system. The standard multi-theme semantic-token prerequisite established by Build 068 remains binding for future graphical/style work.

## Verification required before promotion
- formatter, lint, TypeScript, unit/static tests and production build GREEN;
- Browser E2E GREEN;
- PostgreSQL 17 full migration history and idempotent replay GREEN;
- exact Build 070 hosted verification SQL GREEN;
- CodeQL and Gitleaks GREEN;
- dependency audit GREEN;
- Supabase Security Advisor with zero findings;
- no Build 070 unindexed-foreign-key findings;
- independent `dev` and `main` verification after merges.

## Cost / infrastructure
No paid service, new hosted project, Worker, D1 database, R2 bucket, Vercel project or new secret is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 071 — Baseball, Sports, Playground & Hall Maintenance**, advancing the historical roadmap's Build 072 capability.
