# Build 039 — Rate Plans & Dynamic Date Pricing

Status: **IMPLEMENTED — promotion in progress.**

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
- FORCE RLS, actor-bound pricing management and no application DELETE privilege.

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
