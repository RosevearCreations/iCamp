# Build 029 — Operational Asset & Equipment/Fleet Model

## Status
**FULLY PROMOTED — `main` GREEN.**

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

## Promotion and hosted evidence

Feature PR **#113** reached exact head
`b96c773677f15c28723068bfcdff5cfec2ed97d7` with:

- CI `38345216761` — GREEN;
- CodeQL `38345216741` — GREEN;
- Secret Scan `38345216751` — GREEN.

PR #113 merged to `dev` as
`94f27a739a82a616fb3df3be337e719ad668e7b7`.

Independent feature `dev` push evidence:

- CI `38345465763` — GREEN;
- CodeQL `38345465691` — GREEN;
- Secret Scan `38345465753` — GREEN.

Hosted Supabase migration **0033** is live as
`20261013041752`.

Supabase Performance Advisor identified three Build 029 composite foreign-key indexes. Hardening PR **#114** added migration **0034 — operational_asset_fk_indexes** and reached exact head
`c3fb63c470f4b01150e6708ded3bf9034821d20f` with:

- CI `38346259879` — GREEN;
- CodeQL `38346259827` — GREEN;
- Secret Scan `38346259839` — GREEN.

PR #114 merged to `dev` as
`1b65d47382ee07b892883e5833d4c348fb850f28`.

Independent hardened `dev` push evidence:

- CI `38346422414` — GREEN;
- CodeQL `38346422421` — GREEN;
- Secret Scan `38346422404` — GREEN.

Hosted Supabase migration **0034** is live as
`20261013042811`.

Hosted verification confirms:

- `operational_assets`, `operational_facilities` and `operational_equipment` all have RLS enabled and forced;
- direct `anon` and `authenticated` reads are denied;
- `asset.read`, `asset.manage`, `equipment.read` and `equipment.manage` exist;
- subtype, touch-row and status-revision triggers are present;
- the status-revision function is SECURITY INVOKER;
- all three advisor-requested FK indexes are live.

Supabase Security Advisor returns **zero findings**. Performance Advisor now reports only INFO-level unused-index notices for this low-traffic development schema; there is no remaining Build 029 missing-FK-index finding.

Production PR **#115** (`dev` → `main`) passed:

- CI `38346618072` — GREEN;
- CodeQL `38346617858` — GREEN;
- Secret Scan `38346617752` — GREEN.

PR #115 merged to `main` as
`b5d16ac6872e81d21a3a46fc3417ffc8f42a28f1`.

Independent production `main` push evidence:

- CI `38346799657` — GREEN;
- CodeQL `38346799629` — GREEN;
- Secret Scan `38346799630` — GREEN;
- Verify — SUCCESS;
- Browser end-to-end — SUCCESS;
- Database migrations/lifecycle — SUCCESS.

## Closeout

Build 029 is fully implemented, hosted, hardened, promoted and independently verified GREEN on production `main`.

The deferred-hosting decision remains unchanged: no new Vercel, Cloudflare or other public runtime was created. The SEO/web-mobile contract is now part of the repository so public discovery work can be activated later without exposing internal operational routes.

No manual user action is required.

## Next build

**Build 030 — Accommodation & Asset Status Engine**

Status: **QUEUED — NOT STARTED**
