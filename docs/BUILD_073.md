# Build 073 — Departure Campsite Cleanup

Status: **FULLY PROMOTED — `main` GREEN**

Build 073 advances historical Build 074 by turning the Build 050 campsite checkout handoff into automatic, auditable departure cleanup and inspection work without creating a second booking-state, checklist or corrective-work system.

## Delivered

- automatic campsite cleanup task creation from canonical `reservation_check_outs`;
- safe backfill for existing campsite checkout evidence;
- one departure cleanup program per canonical campsite with exact `tent`, `rv` or `mixed` type matching;
- active published Build 068 `site` inspection template required for the same campsite;
- configurable rebooking block, defaulting to blocked when cleanup configuration is absent;
- physical checkout remains complete even when cleanup configuration is missing;
- Build 068 inspection occurrences/results/sign-off remain the checklist authority;
- failed inspection items continue through Build 065 canonical maintenance work orders;
- cleanup cannot clear while corrective work remains outside `completed` / `cancelled`;
- Build 030 canonical accommodation status remains the only availability authority and releases `inspection -> available` only after required cleanup clearance;
- database guard prevents manual bypass of an uncleared configured rebooking block;
- Web/PWA cleanup program and departure queue;
- IVR/DTMF and SMS/MMS concise status support with secure Web/PWA fallback for visual checklist/evidence decisions;
- forced RLS, direct public/anon/authenticated revocation, minimum `icamp_app` grants, actor validation and audit evidence;
- Build 050 cottage handoff comparison corrected to canonical `rental_cottage`;
- Build 068 standard multi-theme semantic-token prerequisite remains binding for future visual/style work.

## Authority boundaries

Build 073 owns the checkout-to-cleanup handoff, campsite cleanup configuration and clearance evidence only.

It deliberately reuses:

- Build 050 for immutable physical checkout evidence;
- Build 030 for canonical accommodation status / availability;
- Build 065 for maintenance work orders and corrective-work closure;
- Build 068 for versioned inspection templates, checklist results and sign-off.

No Build 073 table stores duplicate checklist-item results, work-order closure state or an independent booking availability state.

## Promotion evidence

- feature PR #272;
- final feature head `8375b5f504fbcb0b1c5d3a690edb8df5d8ebacf1` passed Verify, Browser E2E, database lifecycle, JavaScript/TypeScript analysis, CodeQL and Gitleaks;
- feature squash merge to `dev`: `c72b9f6084e259929797bc81e255f6b1036f09bd`;
- advisor-hardening PR #273 added the three hosted-advisor covering indexes;
- exact independently verified production-candidate `dev` SHA: `3fea3b34cf38464ed9445c5f574cdb34dba249d2`;
- hosted migrations `20261022150031 / departure_campsite_cleanup` and `20261022152556 / build073_advisor_hardening`;
- exact repository verification SQL for both Build 073 migrations passed on hosted Supabase;
- Supabase Security Advisor: zero findings;
- the initial three Build 073 composite unindexed-foreign-key INFO findings were resolved; final Build 073 unindexed-FK findings: zero;
- remaining Build 073 Performance Advisor notices are expected INFO-level unused-index notices on newly introduced indexes;
- clean main-based production PR #274 isolated the 17 Build 073 files/edits and preserved Build 072 closeout history;
- production candidate head `bd8dfd76e1e528d19e77095f26057461ca523772` passed all production PR gates;
- production feature `main` SHA: `34b0cbbb68f62dbe459de69bcfbd0aede83030f9`;
- exact production jobs GREEN: Verify #119918118390, Database migrations #119918118249, Browser end-to-end #119918117981, Analyze JavaScript and TypeScript #119918117050 and Gitleaks #119918117581;
- Verify includes formatter, lint/typecheck, unit tests, telephone/SMS parity, production build and production dependency audit;
- database verification includes full migration/lifecycle checks and migration-history idempotence.
