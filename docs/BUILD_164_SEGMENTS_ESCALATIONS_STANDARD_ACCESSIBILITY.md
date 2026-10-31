# iCamp Build 164 — Segment Comparisons, Camper Escalation Aging and Standard Accessibility

## Functional delivery

1. **Seasonal utilization by accommodation segment:** `/workspaces/management/command/segments` compares real campsite, rental-cottage and permanent-unit site-night coverage for the current partial month plus five completed months. It supports three- and six-month views, an accommodation-type filter, exact accessible monthly totals and weighted booked percentages. Its source requires `reports.read`, `reservation.read` and `accommodation.read` in the chosen campground. The query executes under `icamp_app` RLS in a read-only PostgreSQL transaction.
2. **Camper escalation aging:** `/workspaces/management/command/escalations` uses the existing authorized camper-assistance case and escalation source. It reports active (open/acknowledged) escalations, acknowledgment state, assignment, severity, actual age since raised, 24-hour and 72-hour attention bands, unknown timestamps and concurrent-active anomalies. Source case links lead to the existing staff triage desk. No escalation is acknowledged, resolved, messaged or changed by the report.
3. **Standard theme owner accessibility:** Header Display options now has a local **Larger text** switch alongside High contrast and Reduced motion. Escape closes the details control and returns keyboard focus. Segment cards, scrollable tables, long text, mobile layouts and high-contrast content have additional visual rules. The owner-review checklist links to both new screens and explicitly remains feedback, not an official sign-off.
4. **Navigation:** Both new routes are linked from Management Command subject to the full required permission sets. Seasonal Trends links to Segment Comparisons; the Camper Resolution Timeline links to Escalation Aging.

## Interpretation and limitations

- Booked nights represent unique booked **site nights**, not physical overnight guests, sales, occupancy headcount, or a booking-eligibility decision. Seasonal assignment and reservation counts **may overlap**. Historical denominators use **today's active inventory**, not an immutable historical snapshot of accommodation availability.
- The current month is incomplete and property-local dates determine month boundaries. A legitimate zero is displayed as zero; unavailable source data produces an explicit unavailable panel, not fabricated metrics.
- The 24/72-hour thresholds are internal review bands, **not a contractual response SLA**. Acknowledged escalation records remain active until resolved; unknown or future timestamps are not treated as age zero.
- Display preferences persist on the **current device only**. The owner review is not persisted as a signed acceptance artifact.
- Tenant subscriber **billing and Omnichannel are HELD / DISCONNECTED**. This build does not make payments, send messages, activate gateways or change an integration gate.

## Owner walkthrough

1. Sign in with an assigned Camp Rosevear staff/owner account that has the needed campground permissions.
2. Open **Management → Operations Command → Accommodation segment comparisons**, choose the campground, compare three versus six months and each accommodation type, and verify card percentages against the exact table.
3. Open **Camper escalation aging**, select the 24/72-hour and acknowledgment filters, and choose **Review case** to reach the existing authorized triage desk. Verify unknown-date and anomaly notices if your data contains them.
4. Open **Display options** in the header. Test larger text, high contrast, reduced motion, keyboard Tab/Shift+Tab and Escape at 100% and 200% browser zoom. Inspect on desktop, tablet and phone if possible.
5. Open **Standard theme owner review** and copy the walkthrough observations. No checkbox here is a legal approval.

## Verification before promotion

- `node --test tests/build164-segments-escalations-accessibility.test.mjs`
- `npm run verify` (format, lint, types, all tests and optimized production build)
- GitHub `dev` checks, PR checks and merged `main` checks must pass.
- Vercel `i-camp` production deployment must be READY at the immutable `main` SHA; public smoke must pass and protected screens must redirect anonymous visitors to sign in.

## Next recommended build

**Build 165 — Seasonal Capacity Forecast Variance, Camper Escalation Acknowledgement Handoff & Standard Theme Cross-Device Verification (Billing / Omnichannel HELD).**
