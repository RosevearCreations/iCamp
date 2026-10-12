# Build 026 — Rental Cottage Model

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- rustic and serviced rental cottages;
- bedrooms, beds and physical sleeping occupancy;
- kitchen or kitchenette;
- private/shared washroom and shower;
- heating, cooling and appliance facts;
- accessibility and view.

## Integrated interface
Build 026 deliberately extends the existing accommodation administration surface instead of creating a disconnected cottage screen. The visible accommodation assembly now puts the completed accommodation foundation together in one interface:
- Build 024 canonical map-linked accommodation identity and shared revision hooks;
- Build 025 campsite type, service, utility and physical-fit configuration;
- Build 026 rental-cottage occupancy, facilities, climate, appliances, accessibility and view.

The campground-management surface links directly to this assembly. Historical Build 024 labels remain present for regression continuity while the active interface identifies Build 026. This gives later turnover, gallery, status, booking, pricing and compatibility builds one visible operational surface to extend.

## Data model
Hosted migration `0029_rental_cottage_model` extends `public.rental_cottages`; it does not create a second cottage inventory.

Cottage fields cover:
- rustic/serviced classification;
- bedroom, bed and maximum occupancy counts;
- none/kitchenette/full kitchen;
- none/shared/private washroom and shower;
- heating and cooling types;
- refrigerator, cooktop, oven and microwave;
- step-free access and accessible washroom;
- view classification.

Cottage changes advance the canonical parent accommodation `availability_revision`. Build 033 remains authoritative for configurable capacity rules and Build 034 remains authoritative for booking compatibility.

## Security and auditing
The Build 024 forced-RLS model remains authoritative. Structural cottage edits require `accommodation.manage` through the trusted `icamp_app` role, use optimistic cottage row-version concurrency, and append `accommodation.cottage.configure` audit evidence.

Hosted verification confirmed:
- 19 Build 026 cottage columns are present;
- `rental_cottages_touch_row` is active;
- `rental_cottages_bump_availability_revision` is active;
- direct `anon` SELECT remains denied;
- direct `authenticated` SELECT remains denied;
- Supabase Security Advisor: zero findings.

Supabase Performance Advisor reported INFO-level unused-index notices on the low-traffic/new schema; no Build 026 security or migration blocker was reported.

## Channels
- Web/PWA: full rental-cottage configuration in the integrated accommodation assembly.
- IVR/DTMF: later workflows may read concise cottage facts; structural edits remain staff-assisted.
- SMS/MMS: later workflows may read concise cottage facts or provide secure handoff; structural edits remain authenticated Web/PWA or staff-assisted.

## Hosted database evidence
- Supabase project: existing iCamp project.
- Hosted migration: `0029_rental_cottage_model`.
- Hosted migration version: `20261012231044`.
- Verification: 19/19 Build 026 columns, both triggers present, direct anon/authenticated reads denied.
- Security Advisor: zero findings.
- No new database, storage, worker, hosting project or paid prototype dependency was created.

## Promotion evidence

### Feature PR to dev
- PR: **#100 — Build 026 — Rental Cottage Model & Accommodation Assembly**
- Final exact feature head: `978f1b0959520c63d263c2a5c05f744a4c5b9a66`
- CI: `38320411198` — GREEN
- CodeQL: `38320411315` — GREEN
- Secret Scan: `38320411185` — GREEN
- CI included Verify, Browser end-to-end and Database migrations.
- Merged to `dev`: `f71f51c079cf4118786539f3b7b114a1f400e8c1`.

### Independent dev push
- CI: `38320583407` — GREEN
- CodeQL: `38320583292` — GREEN
- Secret Scan: `38320583295` — GREEN

### Production PR
- PR: **#101 — Build 026 — Promote Rental Cottage Model & Accommodation Assembly**
- Production PR head: `f71f51c079cf4118786539f3b7b114a1f400e8c1`
- CI: `38320798710` — GREEN
- CodeQL: `38320798694` — GREEN
- Secret Scan: `38320798732` — GREEN
- CI included Verify, Browser end-to-end and Database migrations.
- Merged to `main`: `d954b8885e89f8f94991811767e44498e125bee7`.

### Independent main production push
- CI: `38320978747` — GREEN
- CodeQL: `38320978713` — GREEN
- Secret Scan: `38320978755` — GREEN
- Verify: GREEN.
- Browser end-to-end: GREEN.
- Database migrations and lifecycle verification: GREEN.

## Platform impact
Build 026 remains on the existing Next.js/PostgreSQL/Supabase stack. No new Vercel project, Cloudflare project, paid mapping service, storage resource or other paid prototype dependency was required.

## Manual action
No manual user action was required to implement or promote Build 026.

## Next build
**Build 027 — Cottage Turnover & Housekeeping Model**
