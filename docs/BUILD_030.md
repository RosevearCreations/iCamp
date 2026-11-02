# Build 030 — Accommodation & Asset Status Engine

## Status
**FULLY PROMOTED — `main` GREEN.**

## Scope

Build 030 turns the shared status hooks from Builds 024 and 029 into the authoritative current-state engine for accommodation and campground operating assets.

Delivered scope:

- accommodation states: available, held, reserved, arriving, occupied, departing, inspection, maintenance, winterized and closed;
- operational asset states: unknown, operational, limited, inspection, maintenance, unavailable, seasonal, winterized and closed;
- PostgreSQL-authoritative transition rules for both state machines;
- append-only accommodation and operational-asset status history;
- actor, timestamp, transition reason and status-revision evidence;
- accommodation status changes advance both status and availability revisions;
- optimistic row-version protection for status commands;
- RLS-protected history with direct anon/authenticated access denied;
- audited server commands for accommodation and asset transitions;
- one responsive Management → Campgrounds → Status control centre that combines accommodation, facility, equipment and fleet state in one operational view;
- existing operational-asset state controls remain compatible with the expanded Build 030 state vocabulary.

## Boundary

Build 030 owns **current state, transition validity and durable state history**.

Build 031 — Management Closures, Holds & Map Publication remains authoritative for:

- dated closures and reopening windows;
- bulk accommodation/asset/section blocks;
- management override semantics;
- safe map publication/version switching.

No dated closure scheduler or bulk hold system is hidden inside Build 030.

## Security and database design

The database is the source of truth. The web interface can request a transition, but PostgreSQL rejects any edge that is not present in the private transition-rule tables.

Status-history tables are public-schema data with ENABLE + FORCE RLS, explicit application grants and explicit denial of direct anon/authenticated access. Trigger functions are SECURITY INVOKER.

No new Vercel, Cloudflare, storage bucket, worker, paid service or public runtime is introduced.

## Promotion evidence

- feature PR #118 merged to `dev` after CI, Browser E2E, database lifecycle, CodeQL and Secret Scan were GREEN;
- Supabase advisor hardening PRs #119 and #120 merged cleanly to `dev`;
- independent `dev` SHA `d01c613ccd6f0abaf75474417b21733d89b5de70` passed Verify, Browser E2E, database lifecycle/idempotence, CodeQL and Secret Scan;
- hosted Supabase migrations `0035_accommodation_asset_status_engine`, `0036_status_history_rls_initplan` and `0037_status_history_rls_initplan_scalar` applied successfully;
- hosted Supabase Security Advisor returned zero findings;
- Build 030-specific Supabase RLS performance warnings were closed; only generic unused-index INFO notices remain for the young project;
- production PR #121 passed its own GREEN CI, Browser E2E, database lifecycle, CodeQL and Secret Scan gates;
- production merge SHA `50d0e05fe6c75efb620b8909aebdbad291076b86` passed independent post-merge Verify, Browser E2E, database lifecycle/idempotence, JavaScript/TypeScript analysis and Secret Scan checks;
- no manual user action was required.

## Next build after closeout

**Build 031 — Management Closures, Holds & Map Publication**

Status: **QUEUED — NOT STARTED**
