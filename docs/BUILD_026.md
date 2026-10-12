# Build 026 — Rental Cottage Model

Status: **FEATURE IMPLEMENTED — PROMOTION PENDING.**

## Roadmap scope
- rustic and serviced rental cottages;
- bedrooms, beds and physical sleeping occupancy;
- kitchen or kitchenette;
- private/shared washroom and shower;
- heating, cooling and appliance facts;
- accessibility and view.

## Integrated interface
Build 026 deliberately extends the existing accommodation administration surface instead of creating a disconnected cottage screen. The visible accommodation assembly now shows:
- Build 024 canonical map-linked accommodation identity and shared revision hooks;
- Build 025 campsite type, service, utility and physical-fit configuration;
- Build 026 rental-cottage occupancy, facilities, climate, appliances, accessibility and view.

The campground management page links directly to this assembly interface so future turnover, gallery, status, booking and compatibility builds have one visible operational surface to extend.

## Data model
Migration 0029 extends public.rental_cottages. It does not create a second cottage inventory.

Cottage fields cover:
- rustic/serviced classification;
- bedroom, bed and maximum occupancy counts;
- none/kitchenette/full kitchen;
- none/shared/private washroom and shower;
- heating and cooling types;
- refrigerator, cooktop, oven and microwave;
- step-free access and accessible washroom;
- view classification.

Cottage changes advance the canonical parent accommodation availability revision. Build 033 remains authoritative for configurable capacity rules and Build 034 remains authoritative for booking compatibility.

## Security and auditing
The existing Build 024 forced-RLS model remains authoritative. Structural cottage edits require accommodation.manage through the trusted icamp_app role, use optimistic row-version concurrency, and append accommodation.cottage.configure audit evidence. Direct anon/authenticated table access remains revoked.

## Channels
- Web/PWA: full rental-cottage configuration in the integrated accommodation assembly.
- IVR/DTMF: later workflows may read concise cottage facts; structural edits remain staff-assisted.
- SMS/MMS: later workflows may read concise cottage facts or provide secure handoff; structural edits remain authenticated Web/PWA or staff-assisted.

## Platform impact
Build 026 remains on the existing Next.js/PostgreSQL/Supabase stack. No new Vercel project, Cloudflare project, paid mapping service, storage resource or other paid prototype dependency is required.

## Promotion evidence
Promotion evidence is recorded here after exact-tree feature, dev and production gates are GREEN and the hosted 0029 migration is verified.

## Next build
After production closeout, the queue advances to **Build 027 — Cottage Turnover & Housekeeping Model**.
