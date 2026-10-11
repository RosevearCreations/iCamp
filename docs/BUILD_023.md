# Build 023 — Canonical Map Object Binding

## Status
**IN DEVELOPMENT — feature branch verification pending.**

## Roadmap scope
- bind polygons/points to canonical sites, cottages, pools, washrooms, gates, docks, roads, buildings and assets;
- prohibit orphan/duplicate bindings;
- object inspector.

## Architecture boundary
Build 023 introduces canonical **map identity anchors** in `icamp_private.campground_map_objects`. This gives the map a stable identity for a site, cottage or facility before later domain builds add booking, accommodation, status, equipment and maintenance fields.

Builds 024–030 still own the richer accommodation and operational-asset business records. Those future records will attach to the Build 023 identity rather than creating a second map identity.

Supported object kinds are:
- site;
- cottage;
- pool;
- washroom;
- gate;
- dock;
- road;
- building;
- asset.

## Geometry binding contract
`campground_map_object_bindings` allows exactly one current geometry binding per canonical object:
- **polygon** — references an existing Build 020 polygon; or
- **point** — stores the Build 019 canonical source-pixel plus normalized 0–1 point.

A polygon may also belong to at most one canonical object.

Database scope foreign keys tie the object, image version, layer and polygon to the same organization/campground. The binding trigger canonicalizes polygon image/layer metadata from the polygon itself. This means a binding cannot silently point at a polygon from another campground, another image version or another layer.

## Authorization and audit
- `campground.map` is required to bind/unbind map geometry;
- layer visibility permission is re-checked on the server before a binding is exposed or changed;
- `campground.configuration` is required to create canonical map identities before the richer domain editors arrive;
- create, polygon bind, point bind and unbind operations append audit evidence;
- direct `anon` and `authenticated` access to the private tables is revoked.

## Object inspector
The protected map editor receives a permission-filtered object inspector that shows:
- object type, code and display name;
- current binding type;
- layer;
- polygon label or exact point coordinate;
- bind/unbind controls;
- pointer-based point placement using the same Build 019 coordinate contract.

## Platform impact
Build 023 remains on the existing Next.js/PostgreSQL/Supabase stack and existing overhead imagery. It introduces migration `0025_canonical_map_object_binding.sql` and requires no new Vercel, Cloudflare, paid map, icon or GIS resource.

## Channel support
- Web/PWA: full visual object inspector, polygon binding and point placement.
- IVR/DTMF: map geometry remains graphical-only; staff can identify canonical objects by code and use secure visual handoff for placement.
- SMS/MMS: canonical object codes can be referenced non-visually, but geometry creation/placement uses secure visual handoff or staff assistance.

## Manual action
No manual user action is expected unless the connected Supabase project rejects migration 0025 for an external configuration reason.
