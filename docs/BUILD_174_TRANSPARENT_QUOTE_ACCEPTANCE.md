# Build 174 — Transparent Booking Total, Fee Breakdown & Policy Preview

## Customer-facing implementation

- Public campsite/cottage detail now includes a **fresh, server-priced, 10-minute estimate** derived from the existing canonical rate plan, date adjustments, mandatory service fees and up to three guest-selected optional add-ons/passes. All optional quantities are bounded, unique and revalidated by `quoteBookingCharges`; unavailable selections fail closed and the returned estimate excludes invalid lines.
- Night-by-night rows allocate the exact canonical base (including discounted weekly/monthly rates) and display date adjustments separately; base, adjustment, floor correction, stay subtotal, automatic fees, selected extras and known subtotal reconcile in integer cents. Currency derives from the configured rate plan, not from client input.
- Server queries the campground's existing configured deposit schedule and cancellation/refund policy, when available and same-currency. An absent or incompatible policy is marked **not configured**; it is never replaced with an invented default. Deposit estimates are explicitly based on the known pre-tax subtotal. Security deposits are separately shown rather than hidden in the stay amount.
- The current schema does **not** contain a canonical tax-rate calculation. Taxes therefore display as **unpriced / not configured** and the UI refuses to advertise a final tax-inclusive amount or claim zero tax. A campground must confirm the actual all-in amount until authorized, source-configured tax calculation is implemented. Per-person/vehicle exceptions not represented in the charge catalogue are similarly not invented.
- Public and print/staff-assisted routes render the **same shared quote component**. Print re-queries current data and carries no guarantee from an older snapshot. Both show a quoted-at timestamp, 10-minute expiry, date window, current live availability/revision, and clear reprice prompts. Checkout still performs server-side availability/hold/charge revalidation before creating a pending reservation; this preview does not reserve or charge anything.
- Public detail and print routes display an honest accessible unavailable state when `DATABASE_URL` is missing; no fabricated price or 500 from that known deployment configuration gap.

## Contracts and safety boundaries

| Dimension | Contract |
| --- | --- |
| Canonical data | Existing `rate_plans`, `rate_rules`, `booking_calendar_periods`, `booking_charge_catalog`, `campground_booking_rules`, `campground_payment_policies`, `campground_cancellation_refund_policies` and live availability. No migration or new data mutation. |
| Access and privacy | Published campground accommodation readback, campground-scoped policies only; no guest record, payment instrument, customer identity or protected booking is returned. No server-side writes or audit events introduced. |
| Staleness | New server estimate on each GET, issued and expiring timestamps, live availability and revision, visible refresh action; no client-generated cents, quote token, permanent price promise or hold. |
| Billing | **HELD / DISCONNECTED** — no payment, collection, settlement, refund or external financial action. |
| Web/PWA | Source-backed current quote, itemized breakdown, policy card, keyboard-accessible GET options and expiry. |
| Print and staff-assisted | Server-generated `/booking/accommodations/[accommodationId]/quote/print` uses the same quote component and current source; staff can verbally summarize documented itemizations. |
| IVR/DTMF/SMS/MMS | **HELD / DISCONNECTED**. Future adapters may consume a separately approved canonical summary; no outbound messages. |
| Operational dependency | Vercel's `i-camp` project did not have `DATABASE_URL` at Build 173 promotion. The no-data fallback is deliberate and does not certify source connectivity. |

## Acceptance tests

`tests/build174-transparent-quote-preview.test.mjs` covers selection validation/duplicates, canonical quote and fee reconciliation, configured deposit/cancellation policy, unconfigured tax and policy failure modes, zero floor adjustment, 10-minute expiry and shared public/print presentation. Existing Build 038/039/040/042/045 suites remain regression gates; full local and remote CI, browser, migration, CodeQL, Secret Scan and production exact-commit tests are required before calling the code release GREEN.

## Next build

**Build 175 — Booking Draft Save-and-Resume & Safe Cross-Device Recovery (Billing / Omnichannel HELD).** Time-limited signed-in/secure-link drafts with consent, expiry, idempotent writes and inventory/price revalidation upon return; no automatic reservation, charge or outbound message.
