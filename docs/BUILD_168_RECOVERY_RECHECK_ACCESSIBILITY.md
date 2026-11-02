# Build 168 — Scenario Saved View Recovery & Comparison Export, Escalation Follow-Up Recheck Receipts & Standard Theme Owner Accessibility Retest Summary

## Delivered

1. **Saved view recovery and CSV:** Authorized forecast staff can explicitly download a JSON backup containing only named historical filter preferences, inspect a proposed recovery and confirm replacement in their current browser. Recovery checks the saved user ID and campground ID against the signed-in scope, rejects unsupported filters, duplicates, oversized files and malformed JSON. A separate CSV download recalculates the saved view comparisons from the current authorized historical source, escapes spreadsheet cells and neutralizes formula-like labels. The CSV is a historical-rate sensitivity snapshot, not a future-demand forecast or booking decision.

2. **Escalation source recheck observations:** The authorized campground escalation board now offers a source refresh, explicit operator-captured readbacks and a session-only list of recheck receipts. Each local receipt identifies the source escalation, source observation timestamp, operator capture time, evidence status and whether a subsequent source read has changed. A second receipt for the same snapshot is refused. Follow-up links open the existing authorized triage desk. Receipts are **operator observations, not independent signatures or server-issued proof**. No case assignment, acknowledgment, closure, SMS or dispatch is written by this board; copying is explicit.

3. **Standard Theme accessibility retest summary:** The owner review now includes explicit keyboard/focus, 200% zoom/reflow, high-contrast/larger-text and reduced-motion/touch checks, with manual outcomes, bounded notes and passed/issues/untested counts. Its copyable owner feedback summary includes these results. Explicit browser-local retest draft saving now uses format version 2, retaining read compatibility for version 1 device-only drafts. No physical-device acceptance or WCAG certification is inferred automatically.

## Verification and boundaries

- Forecast: `requireStaff` and per-campground `reports.read`, `reservation.read`, `accommodation.read`; escalation: `requireStaff`, `reports.read` plus triage/operations permission. Only original source reports; no new database schema or integration gateway.
- Browser-local saved view backups contain user/campground scope IDs; keep them private. CSV contains authorized historical figures and is downloaded only when requested. No automatic external sharing.
- Recheck receipts are session-only, user-captured and **not** durable independent acknowledgment evidence. A missing active escalation after refresh requires triage investigation, not a fabricated closure claim.
- Owner accessibility retest outcomes are manually entered; owner approval and formal accessibility certification remain separate.
- **Billing and Omnichannel remain HELD / DISCONNECTED.** No live charges, calls, SMS or authenticated integration GETs were enabled.

## Manual acceptance

1. Authorized campground user: save a forecast view, download JSON, remove the view, select backup and confirm recovery. Test a wrong-campground backup rejection and a second-browser recovery with the same account/campground. Export CSV and verify source observation time and excluded-category counts.
2. Open the escalation source board, record a gap readback, attempt a duplicate capture (refused), refresh original source and capture again. Compare unchanged/changed observations and follow triage links. Verify no case writes or notifications occur.
3. On `/settings/themes/acceptance`, manually check keyboard, zoom, contrast and motion on appropriate devices; enter outcomes and notes. Save version 2, reload and delete the local draft. Check the generated owner summary. Actual accessibility sign-off requires independent owner review.
4. Full CI gates, `dev` preview READY, promotion PR checks and exact `main` production READY, public smoke and protected redirect/runtime-error checks must all pass.

## Next queued

**Build 169 — Scenario Comparison Export Integrity & Recovery History, Escalation Source Recheck Delta Prioritization & Standard Theme Owner Accessibility Acceptance Follow-Up (Billing / Omnichannel HELD).**
