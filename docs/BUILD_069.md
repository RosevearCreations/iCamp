# Build 069 — Pool & Water-Park Maintenance Operations

## Status
**FULLY PROMOTED — `main` GREEN.**

## Queue authority
Build 069 advances the active maintenance roadmap after Build 068 and implements the historical roadmap's Build 070 pool/water-park operational capability.

## Delivered scope
- one operating-program record per canonical Pool or Water-Park operational asset;
- explicit reuse of:
  - Build 067 recurring maintenance schedule;
  - Build 068 published inspection template;
  - Build 065 maintenance work order;
  - Build 030 operational-asset status/history;
  - Build 066 maintenance leadership permissions/escalation;
- recurring aquatic check visibility from the linked maintenance schedule;
- signed aquatic inspection execution tied to the configured inspection template;
- optional linkage from an aquatic inspection to the latest unresolved materialized recurring schedule occurrence/work order;
- open / limited / closed management presentation mapped to canonical asset states:
  - Open → `operational`;
  - Limited → `limited`;
  - Closed/restricted → canonical non-open states, with Build 069 direct closure using `closed`;
- append-only aquatic inspection evidence;
- append-only operating restriction/reopen decisions tied to exact canonical status-history revisions;
- high-risk reopening guard requiring fresh independently signed inspection evidence;
- reopening blocked while failed inspection corrective work remains unresolved;
- responsive Web/PWA aquatic operations workspace and management visibility.

## Program contract
An active aquatic program binds exactly one Pool/Water-Park asset to:
1. one active Build 067 maintenance schedule targeting that same asset; and
2. one active Build 068 inspection template targeting the same asset whose current published version requires independent sign-off.

The program does **not** copy schedule recurrence fields or inspection checklist content. Those existing authorities remain canonical.

A configurable reopening freshness window defaults to **240 minutes (4 hours)** and may be set from 15 minutes through 7 days. It governs how recent the independently signed inspection must be for a reopening decision.

## Recurring checks
Build 067 remains the scheduler authority.

When its linked schedule materializes, Build 067 still creates the canonical Build 065 work order. Starting an aquatic inspection:
- pins the inspection to the program's current published signed template version;
- assigns the current authenticated inspector;
- links the inspection to the latest unresolved materialized schedule occurrence/work order when one is available;
- otherwise records a valid ad-hoc aquatic safety inspection.

This preserves one scheduler, one work-order engine and one inspection engine.

## Operating state
Build 069 does not add a competing state column.

The canonical `public.operational_assets.operating_state` remains authoritative and Build 030 status-transition rules/history remain active. Build 069 operating decisions execute through the same table/triggers and record additional aquatic decision evidence against the resulting canonical status revision.

Public management presentation:
- `operational` = Open;
- `limited` = Limited;
- any non-open safety/maintenance/inspection/unavailable/seasonal/winterized/closed state presents as Closed/restricted unless a later specialized public status build defines a narrower label.

## Safety-sensitive reopening
Pool/Water-Park reopening is deliberately fail-closed.

A reopen decision requires:
- `aquatics.reopen` high-risk permission;
- canonical `asset.manage` permission;
- an active aquatic operating program;
- an aquatic inspection occurrence linked to that program;
- inspection status `signed_off`;
- the program's exact inspection template;
- inspection sign-off within the configured freshness window;
- inspection sign-off after the most recent Build 069 Limited/Close restriction;
- every failed inspection result to have corrective work;
- every linked corrective work order to be `completed` or `cancelled`.

The database trigger independently revalidates these conditions when the append-only reopen decision is written.

This is an operational evidence/control workflow only. iCamp does **not** replace certified pool/water-park safety systems, legally required water testing, trained operators, lifeguards, public-health requirements or emergency procedures.

## Authorization
New permissions:
- `aquatics.read` — standard operational visibility;
- `aquatics.manage` — elevated program configuration and Limited/Close decisions;
- `aquatics.reopen` — **high-risk** reopening authority.

Default grants:
- Maintenance crew: `aquatics.read`;
- Maintenance Foreman: `aquatics.read`;
- Maintenance Main Foreman: `aquatics.read`, `aquatics.manage`;
- Campground Manager: read/manage/reopen;
- Owner / Administrator: read/manage/reopen.

Existing permissions still apply:
- `inspection.perform` to start and complete inspection evidence;
- `inspection.signoff` through Build 068 independent sign-off;
- `asset.manage` for canonical operating-state changes;
- maintenance permissions for recurring work and corrective-action completion.

## Database/security controls
- all three Build 069 public tables enable and **FORCE RLS**;
- direct `anon` / `authenticated` access is revoked;
- no Build 069 table grants DELETE to `icamp_app`;
- inspection evidence and operation decisions are append-only;
- program target validation accepts only canonical `pool` / `water_park` facilities;
- program validation requires same-asset signed inspection template and recurring schedule;
- operating-decision validation requires exact matching Build 030 status-history evidence;
- reopen evidence is validated again in PostgreSQL using trusted security-definer integrity guards;
- optimistic row-version protection applies to program update and asset status change;
- audit evidence is written for program changes, aquatic inspection start, canonical asset transition and aquatic operating decision.

## Omnichannel contract
- Web/PWA provides full program setup, rich checklist evidence, corrective-work context and reopen review.
- IVR/DTMF and SMS may report defects, query supported status facts, or initiate supported restricted-state commands only after the existing staff verification/re-authentication flow.
- High-risk reopening never downgrades its authorization/evidence requirements for a phone/text channel; when the evidence review is too visual/complex, the channel uses a verified secure-link or staff-assisted handoff.

## Theme architecture
Build 069 adds functional layout only and does not begin visual redesign. The Build 068 roadmap requirement remains binding: a standard semantic theme/token ruleset must be implemented before dedicated graphical/style work, and future multiple themes must consume that common ruleset.

## Boundaries
Build 069 does **not** create:
- lifeguard staffing/capacity enforcement — later Build 084;
- detailed statutory water chemistry fields or jurisdiction-specific regulatory thresholds;
- a second work-order, scheduler, inspection or asset-state authority;
- washroom/shower/laundry upkeep — Build 070;
- visual/theme implementation.

## Verification
- core tests cover Pool/Water-Park types, public-state mapping, program validation and operating-decision reason rules;
- static tests verify reuse of Build 030/065/067/068 authorities and safety guards;
- PostgreSQL verification checks forced RLS, high-risk reopening permission, no-delete posture and append-only evidence;
- final feature head `145b879c44322ec6e676c206df601851bd8e61ec` passed CI #39599664955, CodeQL #39599665076 and Secret Scan #39599664924;
- feature PR #256 merged to `dev` at `6231e7eafa29913647e3dedd9ba241c714838be1`;
- independent `dev` push passed CI #39599993034, CodeQL #39599992990 and Secret Scan #39599992980;
- hosted migration `20261021123137 / pool_waterpark_maintenance_operations` applied successfully and exact Build 069 verification SQL passed;
- Supabase Security Advisor returned zero findings;
- Build 069 had zero unindexed-foreign-key findings; Performance Advisor reported only expected INFO-level unused-index notices on newly created aquatic indexes;
- production PR #257 passed CI #39600377554, CodeQL #39600377505 and Secret Scan #39600377755;
- production feature `main` SHA `94856870eb9139f5a9fc2fb400b6451ed1a82783` independently passed CI #39600722731, CodeQL #39600723132 and Secret Scan #39600722794;
- Verify, Browser E2E, PostgreSQL migration/lifecycle/idempotence, production build, dependency audit, CodeQL and Gitleaks were GREEN at the production feature checkpoint.

## Cost / infrastructure
No paid service, new hosted project, queue provider, Worker, D1 database, R2 bucket, Vercel project or new secret is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 070 — Washroom, Shower & Laundry Upkeep**, advancing the historical roadmap's Build 071 capability.
