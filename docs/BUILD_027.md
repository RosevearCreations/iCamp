# Build 027 — Cottage Turnover & Housekeeping Model

## Status
**FEATURE IMPLEMENTATION — promotion evidence pending.**

## Roadmap scope
- turnover templates;
- linen and housekeeping requirements;
- damage/security inspection;
- cottage inventory checklist.

## Visible integrated interface
Build 027 extends the existing Accommodation assembly instead of creating a separate operations island. Every rental cottage now has one visible operational section beneath the Build 026 physical cottage facts.

The section provides:
- reusable turnover templates;
- linen and housekeeping instructions;
- reusable categorized inventory checklist items;
- one-click turnover creation from a template;
- snapshotted per-turnover checklist evidence;
- item-level issue notes;
- damage/security readiness inspection;
- ready/blocked turnover state and latest inspection evidence.

The Build 024/025/026/027 assembly rail remains visible so the interface continues to put the accommodation system together progressively.

## Data model
Migration 0030_cottage_turnover_housekeeping adds:
- public.cottage_housekeeping_templates;
- public.cottage_inventory_checklist_items;
- public.cottage_turnovers;
- public.cottage_turnover_item_checks;
- public.cottage_damage_inspections.

Turnover creation snapshots the currently active inventory checklist so later template edits cannot rewrite the historical evidence for an already-started turnover.

Turnover lifecycle status changes advance both canonical accommodation availability_revision and status_revision. This preserves the Build 024 hook contract without prematurely implementing the full status engine.

## Readiness boundary
Build 027 owns operational turnover evidence only.

- Build 030 remains authoritative for the detailed accommodation status engine and transition rules.
- Build 034 remains authoritative for booking compatibility and reservation decisions.
- Build 027 makes readiness facts available to those later engines through normalized records and revision hooks.

## Security and audit
All five Build 027 public tables:
- enable and force PostgreSQL RLS;
- deny direct public, anon and authenticated access;
- expose only the trusted icamp_app application role;
- use campground-scoped accommodation.read / accommodation.manage policies.

Mutations enforce accommodation.manage before writes and append audit evidence for:
- turnover-template creation;
- inventory-checklist additions;
- turnover creation;
- item checks;
- damage/security readiness inspection.

## Channels
- Web/PWA: full turnover-template, checklist, turnover-run and readiness-inspection workflow.
- IVR/DTMF: later workflows may read concise readiness/status facts or route staff to a turnover; detailed checklist editing and free-form inspection notes remain staff-assisted.
- SMS/MMS: later workflows may provide concise readiness summaries or secure handoff; structural template editing and inspection evidence remain authenticated Web/PWA or staff-assisted.

## Verification plan
- PostgreSQL migration verification covers template/checklist/turnover/inspection persistence, revision-hook propagation, validation, forced RLS and direct-role denial.
- Repository tests cover migration, service, action, help-topic and roadmap boundaries.
- UI tests confirm Build 027 is integrated into the visible Accommodation assembly.
- Hosted Supabase migration, SQL verification and advisors will be recorded before production promotion.

## Platform impact
Build 027 remains on the existing Next.js/PostgreSQL/Supabase stack. It requires no new Vercel project, Cloudflare project, storage bucket, paid mapping service or paid prototype dependency.

## Promotion evidence
Pending feature, dev, hosted database, production and final closeout gates.

## Next build
After production closeout, queue advancement is expected to:
**Build 028 — Site/Cottage Public Gallery: Up to 10 Images**.
