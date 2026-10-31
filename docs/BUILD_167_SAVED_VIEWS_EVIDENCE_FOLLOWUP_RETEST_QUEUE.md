# Build 167 — Scenario Comparison Saved Views, Escalation Evidence Gap Follow-Up & Standard Theme Owner Retest Queue

## Delivered

1. **Seasonal forecast comparisons:** The protected campground reporting page now computes all nine combinations of 2/3/5 historical months and low/weighted/high observed-rate scenarios from the **same** authorized source read. Staff can name up to eight saved combinations, reopen them with validated URL filter parameters, and compare current historical-rate estimates and actual-minus-estimate variances side by side. Only filter choices and names are stored locally, per user/campground/browser. No booking counts, predicted demand, data snapshots, or source records are persisted. A fresh page read recalculates results; absence of source data is not replaced by a saved estimate.

2. **Escalation evidence-gap follow-up:** The campground-authorized escalation board derives a prioritized manual worklist from actual source acknowledgment discrepancies (missing or invalid timestamps, unknown chronology, state conflicts). It distinguishes ordinary pending acknowledgment and verifiably recorded timestamps from gaps, highlights urgent, unassigned and unknown-age source records, offers case-specific triage links, and allows an operator to explicitly copy a text handoff. The report does not write tickets, acknowledge cases, assign a reviewer, dispatch a notification or supply independent closure evidence.

3. **Standard Theme owner retest queue:** Desktop, tablet and phone corrections appear in a filterable manual retest queue (needs attention, all flagged, owner-observed correction). An owner may explicitly save, reload or delete a browser-local retest draft; payloads are bounded and accepted values checked on load. No server-side approval or independent physical-device acceptance is implied. Existing temporary review controls, summary export, keyboard focus and contrast support remain.

## Scope and privacy

- `requireStaff` and per-campground `reports.read`, `reservation.read`, `accommodation.read` protect forecasts; escalation board retains `reports.read` plus case permissions. No staff/campground cross-scope backend reads.
- Forecast preferences use a per-user/per-campground localStorage key. Browser-local owner retest drafts are manual and should not contain customer or financial details; shared browser users should delete them after review.
- GET-only source reporting. No schema migration, external gateway request, subscription charge, SMS, calls, artificial signed evidence or owner sign-off.
- **Billing and Omnichannel stay HELD / DISCONNECTED**. Saved views and manual triage prompts do not change that gate.

## Acceptance checks

1. Sign in as authorized campground staff and open `/workspaces/management/command/forecast?window=5&scenario=high`; save a named view, switch scenario, then reopen the saved one. Reload and verify preferences return only for the same signed-in user/campground/browser and values are newly computed. Remove a view and observe the counter.
2. Open `/workspaces/management/command/escalations`; inspect discrepancy worklist, filter unassigned gaps, verify triage handoff links and source IDs. Copy text only deliberately; verify original case states remain unchanged.
3. Open `/settings/themes/acceptance`; mark a phone correction, see it in Needs attention, retest and switch the queue. Save, reload, then delete the local draft. Perform actual device/zoom/keyboard checks manually; a simulated viewport is not a genuine physical-device acceptance.
4. Anonymous GETs on protected pages must redirect to login. CI and `npm run verify` must pass, followed by `dev` preview READY and exact `main` production READY with smoke/alias/runtime-error checks.

## Next queued

**Build 168 — Scenario Saved View Recovery & Comparison Export, Escalation Follow-Up Recheck Receipts & Standard Theme Owner Accessibility Retest Summary (Billing / Omnichannel HELD).**
