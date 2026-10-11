# Build 022 — Map Layers, Labels & Icons

## Status
**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action
No manual user action is expected unless the connected Supabase project rejects migration 0024 for an external configuration reason.
