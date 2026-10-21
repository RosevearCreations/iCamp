# Build 068 — Versioned Inspection Templates & Sign-Off

## Status
**IMPLEMENTED — PROMOTION PENDING.**

## Queue authority
Build 068 advances the active maintenance roadmap after Build 067 and implements the historical roadmap's Build 069 versioned-inspection capability.

## Delivered scope
- stable inspection-template identities bound to exactly one:
  - operational asset;
  - campsite;
  - rental cottage;
- immutable published template-version history;
- ordered checklist items snapshotted by immutable version;
- configurable independent sign-off requirement per version;
- corrective-work category and priority snapshotted per version;
- inspection occurrences pinned to one published version and one canonical target;
- item-level Pass / Fail / Not Applicable evidence;
- inspector-only result editing while an occurrence is in progress;
- required-item completeness validation before submission;
- failed-item corrective-action generation into the canonical Build 065 work-order engine;
- append-only corrective-action linkage from inspection result to work order;
- independent sign-off/rejection evidence;
- explicit prohibition on inspector self-signoff where independent sign-off is required;
- responsive Web/PWA template/version/execution/sign-off workspace;
- audit evidence for template creation/version publication, lifecycle changes, inspection execution and sign-off.

## Versioning model
An inspection template is the stable identity for a specific asset/site/cottage.

Published versions are immutable:
1. an unpublished version row is created;
2. checklist items are inserted;
3. publication verifies at least one checklist item;
4. the version is timestamped as published;
5. the parent template points at the newly published current version.

Changing checklist content, instructions, sign-off policy or corrective-work classification therefore creates a new version. Existing inspection occurrences continue to point at the exact historical version used when they began.

## Inspection execution
- `inspection.perform` starts an occurrence from an active template's current published version;
- the assigned inspector records checklist answers while status is `in_progress`;
- required checklist items must all be answered before submission;
- failed items configured for corrective work produce canonical Build 065 work orders during submission;
- when sign-off is not required, inspector submission finalizes the inspection;
- when sign-off is required, submission enters `submitted` and waits for a different user with `inspection.signoff`;
- sign-off may approve or reject; rejection requires a note;
- signed-off/rejected inspections are terminal historical evidence.

## Corrective actions
Failed checklist items create work orders using the version's snapshotted:
- maintenance category;
- maintenance priority policy;
- target asset/site/cottage.

The corrective-action record links the exact failed inspection result to exactly one canonical maintenance work order. Build 068 does not create a second maintenance task system.

## Authorization
Existing authorities reused:
- `inspection.perform` — execute checklist items and submit inspection evidence;
- `inspection.signoff` — independently approve/reject submitted inspections;
- `maintenance.create` — required only when failed items must materialize corrective work orders.

New authority:
- `inspection.template.manage` — create template identities, publish immutable versions and activate/deactivate templates.

Default `inspection.template.manage` grants:
- Maintenance Main Foreman;
- Campground Manager;
- Owner / Administrator.

## Database/security controls
- all seven Build 068 public tables enable and **FORCE RLS**;
- direct `anon` and `authenticated` access is revoked;
- no Build 068 table grants DELETE to `icamp_app`;
- checklist items, sign-offs and corrective-action links are append-only to the application role;
- published version content is database-guarded immutable;
- checklist items cannot be added after publication;
- template target-kind validation verifies canonical active asset/accommodation type;
- occurrence identity/version/target/inspector is immutable;
- results cannot change after submission;
- only the assigned inspector can record/submit results;
- independent sign-off rejects inspector self-signoff;
- optimistic row-version checks protect template lifecycle, submission and sign-off actions.

## Omnichannel contract
- Web/PWA provides full template/version editing, detailed checklist execution, corrective-action visibility and sign-off review.
- Guided IVR/DTMF and SMS may complete structured checklist answers or report defects through canonical permission-checked commands.
- template editing, long evidence and independent review use verified secure-link or staff-assisted handoff rather than fake visual parity.

## Theme architecture decision captured with this build
The user requirement for future multi-theme visual work is now explicit in both `docs/BUILD_ROADMAP.md` and `docs/MASTER_VISION.md`.

Before any dedicated graphical/style redesign:
- a standard semantic theme ruleset/token contract must be implemented first;
- the default theme and later alternative themes must share that same contract;
- visual themes may override presentation tokens but not business/domain markup or behavior;
- operational colors remain semantic state tokens, not theme-specific arbitrary meanings;
- contrast, focus, responsive, reduced-motion and component-state rules are part of the shared standard;
- visual builds must not fork pages/components into theme-specific copies.

This requirement is intentionally documented now but does **not** pull graphical styling into Build 068.

## Boundaries
Build 068 does **not** create:
- recurring inspection schedules; Build 067 remains the scheduler authority and later builds may bind inspection occurrences to it;
- pool/water-park-specific operational checks — Build 069;
- offline inspection execution;
- arbitrary document/form-builder response types;
- a new work-order engine;
- theme implementation or visual redesign.

## Verification
- unit/static tests cover target validation, checklist versioning, sign-off rules, corrective-work linkage and the theme prerequisite;
- PostgreSQL verification checks all Build 068 tables, forced RLS, no-delete posture, append-only evidence and lifecycle guards;
- CI applies migration history on PostgreSQL 17 and performs idempotent replay;
- Browser E2E, formatter, lint, TypeScript, tests, production build, dependency audit, CodeQL and Gitleaks must be GREEN before promotion;
- hosted Supabase migration/verification and Security/Performance Advisors will be checked before `main`.

## Cost / infrastructure
No paid service, new hosted project, provider, secret, Worker, D1 database, R2 bucket or Vercel project is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 069 — Pool & Water-Park Maintenance Operations**, advancing the historical roadmap's Build 070 capability.
