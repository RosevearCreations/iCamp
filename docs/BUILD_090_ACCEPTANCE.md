# iCamp Build 090 — Spring Opening Owner Acceptance & Cross-System Operational Hold Review

## Delivered

- Read-only owner review on the existing spring reopening management page, scoped to the authenticated campground and a clearly labelled one-night availability window.
- Current closure-event pinning prevents historical spring approvals from being mistaken for current evidence.
- Independent live-availability read reconciles reservation, temporary hold, management restriction, turnover and seasonal assignment blockers with spring inspection decisions.
- Unknown/unreadable availability, inactive synthetic property, winter-closed assignment or missing current spring approval fails closed.
- No acceptance, reopening, booking, restriction cancellation, physical control or external message is performed by the report.
- Web/PWA review only; IVR/DTMF/SMS require an authenticated staff handoff.

## Owner sign-off boundary

The status **ready for owner review** is not a final acceptance or authority to open. The operator must separately verify physical safety, applicable permits, source-system restrictions, actual booking dates and all campground-specific requirements. A one-night snapshot must never be projected onto other dates. Existing canonical workspaces retain all mutation authority.

## Verification

`tests/build090-owner-review.test.mjs` checks current-closure evidence, independent blockers and fail-closed missing data. Full repository verification and CI remain required before production release.

## Roadmap reconciliation

The historic `BUILD_ROADMAP.md` labels Build 090 as Permanent Unit Ownership, while the newer active `BUILD_QUEUE.md` explicitly proposes Spring Opening Owner Acceptance after Build 089. This delivery follows that current queue. Permanent Unit Ownership must be renumbered explicitly before its implementation; it is not silently treated as delivered.
