# Build 027 — Cottage Turnover & Housekeeping Model

## Status
**FULLY PROMOTED — `main` GREEN.**

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

## Hosted database verification
- Hosted Supabase project remained healthy on PostgreSQL 17.11.
- Migration 0030_cottage_turnover_housekeeping is live as version 20261013011632.
- Advisor hardening migration 0031_cottage_turnover_fk_indexes is live as version 20261013012145.
- All five Build 027 tables are present with forced RLS.
- The cottage-turnover parent revision trigger is present and its function remains SECURITY INVOKER.
- Direct anon/authenticated reads of turnover and inspection records are denied.
- A rollback-only hosted lifecycle proof verified turnover creation, checklist snapshot evidence, passing damage/security inspection and both canonical revision hooks without retaining synthetic rows.
- Supabase Security Advisor reports zero findings.
- Supabase Performance Advisor's three Build 027 unindexed-foreign-key notices were eliminated by migration 0031. Remaining new-schema notices are INFO-level unused-index observations expected before production traffic.

## Promotion evidence
Feature PR #104:
- exact feature head: edf126a566c21fc472ae46427b616363a3e19c38;
- CI 38331113701 — GREEN;
- CodeQL 38331113751 — GREEN;
- Secret Scan 38331113683 — GREEN;
- merged to dev at c35ef5d9bb3e7da46c20b0dbbb26d968a1b10235.

Hosted-advisor hardening PR #105:
- exact hardening head: 8f69e9328cb5cda407db8ba9fd7d8cc2c5415e6e;
- CI 38331567824 — GREEN;
- CodeQL 38331567788 — GREEN;
- Secret Scan 38331567784 — GREEN;
- merged to dev at 27c1a3e0805a29ff2fbc0702136357e9644c0004.

Final independent dev push:
- CI 38331755160 — GREEN;
- CodeQL 38331755210 — GREEN;
- Secret Scan 38331755173 — GREEN.

Production PR #106:
- CI 38331910997 — GREEN;
- CodeQL 38331910993 — GREEN;
- Secret Scan 38331911004 — GREEN;
- merged to main at 871b650d85311e2f62c891837f5264a11f7f96ef.

Independent feature main push:
- CI 38332092924 — GREEN;
- CodeQL 38332092896 — GREEN;
- Secret Scan 38332092913 — GREEN;
- Verify, Browser end-to-end and Database migrations all succeeded.

## Manual action
No manual user action was required to implement, verify or promote Build 027.

## Next build
**Build 028 — Site/Cottage Public Gallery: Up to 10 Images**

Status: **QUEUED — NOT STARTED**.
