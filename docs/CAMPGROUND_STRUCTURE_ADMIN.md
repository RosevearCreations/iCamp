# Campground Structure Administration

Build 017 establishes the first production administration workflow for a campground's structural hierarchy.

## Scope

Authorized campground managers can:
- edit campground name, timezone and active/inactive state;
- create and update multiple sections;
- create and update multiple subsections beneath a section;
- control explicit numeric ordering;
- switch sections/subsections between active and inactive;
- maintain bounded section-specific operating settings.

Section settings currently include:
- operating mode: standard, quiet or restricted;
- optional quiet-hours start/end;
- a short staff-only note.

These settings are administrative metadata. They do **not** replace the authoritative booking, pricing, access-control, accommodation status, closure or map-publication rules delivered in later builds.

## Security

All mutations require `campground.configuration` for the selected campground.

Server operations:
- re-check permission at action and domain layers;
- execute structural reads/writes under `icamp_app` with transaction-local `icamp.user_id`;
- rely on PostgreSQL RLS for the campground boundary;
- use row-version predicates for optimistic concurrency;
- append standard-risk audit evidence for configuration changes.

Build 017 grants the RLS application role only the missing INSERT capability for section/subsection creation. Delete is intentionally not granted. Historical/archive workflows remain explicit future work.

## Channel support

Web/PWA is the canonical administration surface because editing ordered hierarchical forms is visual.

IVR/DTMF and SMS/MMS do not attempt to reproduce the full editor. They use the existing secure-link/staff-assisted fallback contract, while future narrowly safe structure commands may call the same canonical domain service after verification and authorization.

## Build boundary

Build 017 does not introduce accommodation, operational-asset, overhead-image, polygon, map-object or closure models. Those remain owned by Builds 018–031.

The section-settings payload is capped in PostgreSQL and normalized by the application so a configuration screen cannot become an unbounded document store.
