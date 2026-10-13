# Build 029 — Operational Asset & Equipment/Fleet Model

## Status
**FEATURE IMPLEMENTED — promotion in progress.**

## Scope

Build 029 adds campground operational facilities and infrastructure plus equipment/fleet inventory, map linkage, make/model/serial/ownership, meter snapshots and current operating-state hooks.

## Delivered

- Canonical operational asset parent with exactly one facility or equipment subtype.
- Facility types for pools, water parks, washrooms, sports fields, playgrounds, halls, beaches, docks, launches, roads, parking, gates, buildings, garbage/septic areas, utilities and similar assets.
- Equipment/fleet types for tractors, mowers, maintenance vehicles, carts, trailers, power equipment, watercraft and other equipment.
- Facility map identity requirement with automatic compatible Build 023 identity creation when no existing identity is selected.
- Optional map linkage for mobile equipment.
- Make, model, serial number, ownership type, meter kind/value and storage/home location.
- Current operating state plus status revision hook.
- Forced RLS and direct public/anon/authenticated denial.
- asset.read, asset.manage, equipment.read and equipment.manage permissions.
- Audited create/update service and optimistic row-version updates.
- Visible responsive Operational Assets & Equipment Operations Workbench.
- Contextual help and Campground Administration entry point.

## Build 030 boundary

Build 029 records the current operating-state hook and increments status_revision when that snapshot changes.

Build 030 remains authoritative for status history, transitions, holds, maintenance closures and the full accommodation/asset state engine.

## Web/mobile and SEO readiness

The earlier decision to defer a hosted interface remains unchanged.

Because iCamp will combine inward-facing operations with external web/mobile guest experiences, Build 029 adds the repository Web, Mobile, SEO & Discovery Contract and explicit noindex metadata for /workspaces/** and /auth/**.

Public pages created later must use one descriptive H1, unique titles/descriptions, canonical URLs after a real domain is selected, deliberate robots/sitemap inclusion, accurate structured data, strict media boundaries, mobile-first rendering, accessibility and performance discipline.

The facility public_candidate value is only publication readiness. It does not expose or index an operational record.

## Hosting

No Vercel, Cloudflare or other new web runtime is created. GitHub main remains the release source and Supabase remains the hosted PostgreSQL backend until the previously agreed interface-hosting checkpoint.

## Promotion requirements

- Feature PR CI, Browser E2E, database lifecycle, CodeQL and Secret Scan GREEN.
- Merge feature to dev.
- Independent dev push GREEN.
- Hosted migration 0033 applied and verified.
- Supabase Security/Performance Advisors reviewed.
- Production PR dev to main GREEN.
- Independent feature main push GREEN.
- Closeout evidence and queue advance through dev/main.
- Final independent main push GREEN.

## Next build after closeout

**Build 030 — Accommodation & Asset Status Engine**
