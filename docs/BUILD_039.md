# Build 039 — Rate Plans & Dynamic Date Pricing

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope
Build 039 introduces one canonical server-side pricing model for campsite and rental-cottage stays.

## Delivered
- protected campground rate plans with accommodation-specific or accommodation-kind scope;
- nightly, weekly, 30-night monthly, seasonal-package and yearly price fields in integer cents;
- dynamic weekend, holiday, season, event and promotional adjustments;
- reuse of Build 032 weekend/holiday/season date classification;
- server-side deterministic quote calculation with accommodation-specific plan precedence;
- truthful public detail pricing: no matching plan means no fabricated amount;
- CAD-ready ISO currency storage while remaining multi-currency capable;
- public accommodation detail integration using the same server-authoritative quote result;
- FORCE RLS, actor-bound pricing management and no application DELETE privilege;
- advisor hardening with covering indexes for every Build-039 pricing foreign key;
- explicit INSERT/UPDATE write policies so pricing SELECT has one permissive policy path.

## Hosted database evidence
- Build 039 pricing migration applied to hosted iCamp Supabase as `20261014134304 / rate_plans_dynamic_date_pricing`;
- Build 039 advisor hardening applied as `20261014142429 / rate_pricing_advisor_hardening`;
- hosted verification SQL passed for both migrations;
- Supabase Security Advisor reports zero findings;
- all Build-039-specific unindexed-foreign-key and multiple-permissive-policy findings are closed;
- only expected unused-index INFO remains for newly created pricing indexes.

## Promotion evidence
- feature PR #150 passed Verify, Browser E2E, database lifecycle/idempotence, CodeQL and Secret Scan before merging to `dev`;
- advisor-hardening PR #151 passed the same gates before merging to `dev`;
- exact merged `dev` SHA `673c825034453a2d24d14408909256c68883896f` independently passed CI, Browser E2E, database lifecycle/idempotence, CodeQL and Secret Scan;
- production promotion uses that tested `dev` line plus this release record.

## Boundaries
Build 040 owns add-ons, passes and service fees. Build 041 owns checkout and quote acceptance. Build 039 prices accommodation time only and does not create a reservation, charge a card or include unconfigured fees.

## Omnichannel
- **Web/PWA:** authoritative date-specific amount and applied adjustment explanation.
- **IVR/DTMF:** concise canonical quoted total and rate-plan name after date/accommodation verification.
- **SMS/MMS:** concise canonical quoted total with secure-link handoff for detailed breakdown.
- All channels consume the same server-side pricing result.

## Platform impact
No new paid service, Vercel project, Cloudflare project, Worker, D1 database or R2 bucket is required.

## Next build
**Build 040 — Add-Ons, Passes and Service Fees**

Status: **QUEUED — NOT STARTED**
