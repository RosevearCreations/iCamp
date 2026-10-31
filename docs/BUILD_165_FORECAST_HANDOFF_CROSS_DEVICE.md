# iCamp Build 165 — Seasonal Capacity Forecast Variance, Camper Escalation Acknowledgement Handoff & Standard Theme Cross-Device Verification

## Delivered

1. **Seasonal capacity baseline versus actual:** The protected `/workspaces/management/command/forecast` route reuses the existing tenant-scoped, read-only segment source and permission checks (`reports.read`, `reservation.read`, `accommodation.read`). The **current partial month** is compared to the weighted booked-site-night rate from the **prior three completed months**, separately for campsites, cottages and permanent units. Actual, estimate and signed variance are visible as exact site-night counts. Types without current inventory or historical baseline are excluded from the comparable total and explicitly named as unavailable; no false zero forecast is generated. The estimate is a simple historical-rate planning baseline, **not** a future-month capacity forecast, revenue forecast or booking approval.
2. **Acknowledgement handoff:** The existing camper escalation aging screen now shows a source-derived pending/urgent/unassigned/unknown-age/24-hour handoff. A single button filters the acknowledgement queue. Each row deep-links to the existing case in the permission-checked triage desk, where the original server action verifies the latest escalation ID and row version. The report **does not acknowledge** or resolve records itself; any changed source record must be refreshed.
3. **Cross-device review:** The Standard owner review includes an explicit desktop, tablet and phone status for actual/manual tests, with recommended screen sizes, keyboard/zoom/contrast and touch tasks. Notes are copied into a review summary; they are browser-session observations, **not** device telemetry or persisted owner/legal approval. Layout adapts to narrow screens without clipping the new KPI summary or review selectors.
4. **Navigation:** Permission-filtered Management Command offers the forecast route; segment comparisons link directly to it.

## Owner verification

1. Sign in to Camp Rosevear as an assigned campground owner/staff member with reporting, reservations and accommodation read permissions. Open **Management → Operations Command → Seasonal capacity forecast variance**. Select the campground and compare estimates with the prior three completed months in **Segment comparisons**.
2. Verify a true zero-inventory category says **No active inventory** (or **No historical inventory**) rather than inventing an estimate. Check site-night variance signs and the excluded-type count.
3. Open **Camper escalation aging**, choose **Show acknowledgment queue**, then **Open triage to acknowledge**. The source triage desk will decide if an acknowledgement is still possible using current case version and role access. Do not assume a link click is an acknowledgment.
4. Open **Standard theme owner review**, test desktop, tablet and phone layouts (real devices preferred), high contrast, larger text, reduced motion, focus order, 200% zoom, and long tables. Mark each device **Looks good**, **Needs correction** or **Not yet tested**, enter notes and copy the summary. There is no background device verification and no stored sign-off.

## Guardrails and production gates

- Today’s active inventory is also used for the historical denominator. Seasonal effects, special events and weather make the three-month planning rate unreliable for financial, staffing or booking decisions. Current month is partial; seasonal and reservation booking coverage is deduplicated in the underlying source.
- Billing / Omnichannel remain **HELD / DISCONNECTED**. No charges, messages, gateway GETs, live dispatch or purported legal owner approvals.
- Verify `npm run verify` and `node --test tests/build165-forecast-handoff-device-review.test.mjs`, then green GitHub checks for `dev`/PR/`main`, exact immutable `main` deployment READY in Vercel, public smoke and protected-route anonymous redirect.

## Next recommended build

**Build 166 — Seasonal Forecast Scenario Filters, Escalation Handoff Evidence Readback & Standard Theme Device Correction Review (Billing / Omnichannel HELD).**
