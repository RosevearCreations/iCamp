# iCamp Build 166 — Seasonal Forecast Scenario Filters, Escalation Handoff Evidence Readback & Standard Theme Device Correction Review

## Delivery

1. **Historical scenario filters:** The permission-checked `/workspaces/management/command/forecast` route accepts only 2, 3 or 5 completed historical months and one of three observed historical booking-rate comparisons: **Low** = the smallest observed monthly booking share, **Typical** = the site-night-weighted booking share, **High** = the largest observed monthly booking share. Each is applied to the **current partial month** site-night inventory, not future demand. A campground selector retains the chosen scenario, while the scenario form retains the chosen campground. Missing historical inventory is unavailable, never a synthetic zero. A changed scenario is a read-only GET, not a booking, occupancy approval or revenue projection.
2. **Source acknowledgment readback:** Camper escalation aging now shows source-derived evidence counts and a row-level readback with the source escalation ID, recorded acknowledgment timestamp in UTC (only when chronological and within the observation timestamp), and distinct pending/missing/invalid/unknown-sequence/state-conflict labels. A filter isolates evidence gaps. Triage acknowledgments still occur only in the existing authorized, version-checked source desk. An application timestamp is not an independently witnessed receipt, communication delivery, signature or closure.
3. **Device corrections:** The Standard owner review now gathers screen-specific correction descriptions and per-device manual retest outcomes alongside desktop/tablet/phone observations. Copyable text includes corrections and retest states. All changes are temporary in the browser session: **no automatic device detection, stored approval or legal sign-off**. Narrow screens stack scenario controls, evidence callouts and action buttons; high-contrast and focus visibility are reinforced.

## Owner walkthrough

1. Sign in as assigned Camp Rosevear staff/owner with `reports.read`, `reservation.read`, and `accommodation.read`. Open **Management → Operations Command → Seasonal capacity forecast variance**. Switch between two, three and five completed months, then Low/Typical/High. The heading, baseline month range, historical rates, estimates and variance should change while the campground remains selected. Confirm actual booked nights do not change with scenarios.
2. Open **Camper escalation aging** under the assigned campground, then **Show evidence gaps**. Review the source escalation IDs, acknowledgment event timestamps or missing/conflicting evidence. Click through to source triage only if authorized and review the current row/version there. Refresh the read-only board after a source action; no report link itself records an acknowledgment.
3. Open **Standard theme owner review** on desktop, tablet and phone. Check at 100%/200% zoom, Tab/Shift+Tab/Enter, contrast and larger text, plus long tables and touch targets. Mark each device's observed result, identify a screen and correction, and select manual retest status. Copy the summary back to the owner workflow. Never call an untested device or simulated viewport independently verified.

## Security and limitations

- This build creates no database migrations, permissions or provider secrets. The existing Postgres `icamp_app` read-only transaction and campground RLS policies remain the reporting source.
- The base inventory uses today's active accommodation records for historical periods; booking records may be revised. Observed low/high months are **sensitivity comparisons**, not statistical probability bounds or an occupancy guarantee.
- Customer billing, gateway GETs, SMS, calling, paid account activation and Omnichannel remain **HELD / DISCONNECTED**. Source timestamp readback is **not** independent custody evidence.

## Verification gates

- Focused `node --test tests/build166-scenarios-evidence-corrections.test.mjs` and full `npm run verify` must pass.
- GitHub feature → `dev` → PR → `main` required checks, Vercel PREVIEW/PRODUCTION READY at exact immutable SHA, public smoke and protected-route redirects.

## Next planned

**Build 167 — Scenario Comparison Saved Views, Escalation Evidence Gap Follow-Up & Standard Theme Owner Retest Queue (Billing / Omnichannel HELD).**
