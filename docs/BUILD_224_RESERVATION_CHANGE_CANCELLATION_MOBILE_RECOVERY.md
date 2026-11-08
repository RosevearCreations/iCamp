# iCamp Build 224 — Reservation change clarity, cancellation preview and mobile guest recovery

## Guest experience

- The existing signed-in, guest-owned reservation options page now begins with
  three clearly explained choices: keep the reservation, compare new dates, or
  read cancellation terms. In-page links are keyboard accessible and collapse
  to single-column touch-sized navigation on smaller screens.
- A date-change comparison still requests current accommodation pricing and
  availability server-side. It **does not** calculate an amendment balance,
  promise new availability, or mutate the existing reservation.
- An available cancellation estimate now separates captured payments, refunds
  already recorded and the **illustrative** policy refund. The values are shown
  only when the existing source-backed cancellation recommendation is valid.
  Missing, stale or unsettled financial evidence remains an explicit staff
  review requirement.
- A guest can **opt in** to storing an unfinished review reason for up to 30
  minutes in the current browser tab. Recovery is scoped to the authenticated
  guest ID, reservation ID and review kind. Expired or malformed data are
  removed; successful requests clear the saved reason. No reason is saved by
  default, and the UI warns against use on shared devices.

## Security and behaviour retained

- Authentication and guest ownership are enforced by existing server-side
  session and data access rules. Review actions keep reservation/policy revision
  checks and idempotency validation.
- Neither the date comparison nor the cancellation preview changes a
  reservation, issues a refund, communicates with a customer, or operates a
  private receiver. The only authorized mutation is an internal staff review
  request or withdrawal, as before.
- Browser storage is optional tab-local draft convenience, never a trusted
  source for pricing, payment, ownership or actual review requests.

## Verification

Run `node --test tests/build224-reservation-options-mobile-recovery.test.mjs`
and the project's full `npm run verify` pipeline. Protected `dev` and `main`
checks and the deployed production commit must also match before marking
production GREEN.
