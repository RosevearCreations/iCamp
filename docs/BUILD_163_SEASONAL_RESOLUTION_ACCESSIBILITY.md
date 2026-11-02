# iCamp Build 163 — Seasonal Utilization, Camper Resolution & Standard Accessibility

## Included in this release

1. **Seasonal site-night utilization:** Protected `/workspaces/management/command/seasonal` shows six consecutive property-local months ending today, including booked coverage, noncancelled seasonal assignments and reservation nights. Booking/seasonal overlap is counted only once in the booked total. The current month is partial. A complete exact-count table accompanies accessible graphical bars.
2. **Camper resolution timeline:** Protected `/workspaces/management/command/resolutions` reads the existing authorized camper assistance queue and recorded case events. Shows real submission, triage, assignment, escalation and closure history, urgent/unresolved counts, closure evidence mismatch and mean resolution hours where both timestamps are valid. The interactive list displays up to 60 recent matching cases; summary totals are from the full queue. The view is read-only and links to the existing privileged triage desk for actions.
3. **Accessibility follow-up:** Display options in the global Standard theme header toggle high contrast and reduced motion; both are keyboard-operable, persist *only on the current device* and have accessible pressed states. `prefers-reduced-motion` is honored. New charts have exact readable tables; timelines provide semantic ordered events and time elements. The owner walkthrough now covers the two new screens, keyboard navigation, 200% zoom and display preferences, without treating review notes as an approval.

## Role and source boundaries

- Seasonal data requires `reports.read`, `reservation.read` and `accommodation.read` for the selected campground; the database read is restricted to `icamp_app` with the current user's RLS identity.
- Seasonal history is derived from current reservation/seasonal records against **today's active site inventory**. It is a retrospective utilization estimate, not a time-travel audit of inventory changes, a revenue forecast, a physical camper census or live bookability proof. Cancelled records are excluded. `completed`, `confirmed` and `checked_in` reservations count for nights they cover; active and ended seasonal assignments count within assignment dates.
- Resolution data requires `reports.read` plus an assistance permission or `campground.operations.manage`, and reuses `listAssistanceQueue`. Unavailable sources do **not** turn into synthetic zero counts; closed cases with missing closure evidence are flagged. This view does not send messages or mutate a case.
- Tenant subscription billing, owner legal approval, authenticated Omnichannel connection testing and live outbound communications stay **HELD**. Neither new screen nor local theme preference enables them.

## Checks

- `node tests/build163-seasonal-resolution-accessibility.test.mjs`
- `npm run verify` (format, lint, typecheck, complete tests and optimized production build)
- CI `dev` + PR checks, merged `main` checks, exact SHA Vercel READY, production smoke and unauthenticated route protection.

## Owner walk-through

1. Sign in as an authorized Camp Rosevear manager.
2. Navigate **Management → Operations Command → Seasonal site utilization**; switch 3/6 months and confirm data table and denominators.
3. Open **Camper resolution timeline**; try filters, a closed and an urgent case, inspect actual event timestamps and the existing action link.
4. Open header **Display options** and toggle both preferences; use Tab, Enter and Space and browser zoom 200%; refresh to check local preference persistence.
5. Open **Theme management → Standard owner review**. Check each actual screen and copy feedback. Those notes are not a persisted formal approval.

## Next queued build

**Build 164 — Seasonal Utilization Segment Comparisons, Camper Escalation Aging & Standard Theme Owner Accessibility Corrections (Billing / Omnichannel HELD).**
