# Build 022 — Map Layers, Labels & Icons

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- booking, maintenance, security, utilities, amenities and management layers;
- visibility permissions;
- labels/icons and layer order.

## Architecture
Build 022 adds a first-class campground map-layer model without binding geometry to canonical campground objects early. Build 023 remains responsible for canonical site/cottage/asset binding.

The six standard layer families are:
- Booking — default visibility permission `reservation.read`;
- Maintenance — `maintenance.read`;
- Security — `access.events.read`;
- Utilities — `campground.map`;
- Amenities — `accommodation.read`;
- Management — `campground.configuration`.

Layer visibility is evaluated on the server before a layer or its polygons are returned to the editor. Browser toggles are presentation controls, not authorization controls.

## Labels and icons
Each polygon gains:
- a required map-facing label independent of the administrative polygon label;
- an optional whitelisted icon override;
- a label-visible flag;
- a required layer binding.

A null polygon icon inherits the owning layer icon. Layer and polygon icon keys are whitelisted and rendered as application-owned SVG/text marks; no third-party icon or map service is required.

## Layer administration
Users with `campground.configuration` can:
- rename a layer;
- choose its layer icon;
- choose a curated visibility permission;
- enable/disable it by default;
- move it up/down in persistent order.

All configuration and reorder operations use optimistic row versions and append audit evidence.

## Platform impact
Build 022 uses the existing iCamp application, PostgreSQL and Supabase backend. It adds migration `0024_map_layers_labels_icons.sql` and requires no new Vercel, Cloudflare, mapping, icon or GIS provider.

## Channel support
- Web/PWA: full visual layer, label, icon, ordering and visibility controls.
- IVR/DTMF: layer configuration and map composition are graphical-only; use secure visual handoff or staff assistance.
- SMS/MMS: graphical layer composition is not text-equivalent; use secure visual handoff or staff assistance.

## Promotion evidence
- feature PR #80 final tested head `7c0fe7601c46b29f7384fd3a40d93e770621239c`: CI `38111228752`, CodeQL `38111228751`, Secret Scan `38111228756` — GREEN;
- independently verified `dev` merge `4d2f96a7b1a5b524210f152b1393fe111949803d`: CI `38111337705`, CodeQL `38111337740`, Secret Scan `38111337697` — GREEN;
- production PR #81 on the exact `dev` tree: CI `38111483308`, CodeQL `38111483465`, Secret Scan `38111483302` — GREEN;
- first production merge `f92e07539625e5aa033161a902b72dc0ac0a070c`: CI `38111598256`, CodeQL `38111598241`, Secret Scan `38111598210` — GREEN;
- hosted Supabase migration `20261011042352 / 0024_map_layers_labels_icons` applied successfully;
- hosted schema confirms the private map-layer table plus required polygon `layer_id` and `map_label`, optional icon metadata and label visibility;
- all five Build 022 layer/polygon indexes are present;
- `anon` and `authenticated` retain no direct SELECT privilege on the private map-layer table;
- Supabase Security Advisor reports zero findings after migration 0024;
- the hosted database had no campground rows at migration time, so no existing campground required layer backfill; the application lazily provisions all six defaults for future/newly used campgrounds.

## Manual action
No manual user action was required to implement, migrate, verify or promote Build 022.
