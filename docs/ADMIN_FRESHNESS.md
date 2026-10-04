# iCamp Admin Freshness & Refresh Source of Truth

## Purpose

Administrative and analytical data can become misleading when operators cannot tell whether it is current.

iCamp therefore treats data freshness as a visible operational state.

## Required states

- idle;
- refreshing;
- fresh;
- stale;
- failed.

## Visible metadata

Where appropriate, admin/analysis sections should show:
- rendered-at time;
- last refresh request;
- last successful refresh;
- last failed refresh;
- source watermark/version;
- stale-after threshold;
- refresh-in-progress state;
- safe failure reference.

## Manual refresh

A reusable refresh control triggers a server data refresh/re-render rather than requiring the user to guess whether the browser is current.

The interface must show that refresh is occurring.

## Persistence

When backed by the database, refresh-state records store metadata only. They do not duplicate sensitive business payloads.

## Future realtime/automatic refresh

Later modules can supplement manual refresh with:
- realtime events;
- scheduled refresh;
- background jobs;
- provider/webhook updates.

Even with realtime enabled, operators should still be able to see when the data was last confirmed and when an upstream source last advanced.
