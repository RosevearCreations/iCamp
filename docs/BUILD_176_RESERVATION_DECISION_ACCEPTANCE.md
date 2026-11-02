# Build 176 — Reservation Change/Cancellation Preview & Guest Decision Controls

## Customer experience

- Signed-in guests open **Reservation options** from **My Stay**, select only their own booking, and see its current dates/state, recorded payable, captured funds, and outstanding balance. Every read is owner-scoped and server-generated; no private contact detail appears in a link.
- **Keep** returns to My Stay without any mutation. **Explore dates** verifies calendar dates and reprices the same accommodation from published availability and canonical current fees/policies, with a visible warning that existing occupancy can block overlapping amendments and a newly quoted stay is *not* a calculated amendment total. No change to a reservation, availability hold or price promise occurs.
- **Cancellation review** reads the current campground policy and successful captured payment/refund history. An illustrative policy recommendation is derived from the already-tested Build 045 engine only when policy, currency, pre-arrival state, captured sums and financial status reconcile. Missing policy, currency conflicts, pending provider operations, existing financial review, invalid refunds, or check-in causes a clear **manual review required**, not a fabricated amount.
- With explicit confirmation, a guest may submit an **internal staff-review request** for changed dates or cancellation. The page lists the submitted request; guests can withdraw it. Server actions recheck reservation ownership, row version and policy version, deduplicate repeated posts and never call the canonical cancellation, management, refund or messaging actions.
- A new permission-scoped staff worklist shows submitted/withdrawn guest intentions and links the real canonical management reservation. **No outbound notification** occurs; staff must open the worklist. This is an internal handoff record, not staff acceptance or permission to execute held operations.

## Source and security contracts

| Boundary | Contract |
| --- | --- |
| Reservation | Existing `public.reservations`, `reservation_checkout_details`, `reservation_management_state`, `reservation_payment_schedules`, read through `getMyStayDetail` and `guest_user_id` owner predicate. |
| Cancellation | Configured `campground_cancellation_refund_policies`, actual captured `reservation_payments`, succeeded `reservation_refunds`, and unsettled state. No fallback default policy or invented tax. |
| Date changes | Fresh `getPublicAccommodationDetail` with candidate dates and no optional extras; no automatic change fee or binding availability result. |
| Internal intent | New `guest_reservation_review_requests` table, composite tenant/reservation FK, consented decision kind, optional proposed dates, source row versions, idempotency, single-active-per-kind constraint and withdrawal-only guard. |
| Authorization | Server guest session and verified reservation owner; forced `icamp_app` RLS allows guest-own read/insert/withdraw and permission-scoped staff read. Direct `anon`/`authenticated` table grants revoked. |
| Channels | Web/PWA, keyboard-accessible forms, staff worklist and existing office assistance. Billing, charge/refund execution, SMS/MMS, voice/DTMF and outbound dispatch remain **HELD / DISCONNECTED**. |
| Production dependency | The Vercel `i-camp` project is missing `DATABASE_URL`; source-backed guest/staff operation cannot be called GREEN until a protected production connection is added and redeployed. |

## Acceptance and promotion

- New test `tests/build176-reservation-options.test.mjs` verifies invalid dates, request kinds, actual refund recommendations, missing/mismatched policy, unsettled money, prior refunds, staff/guest access contracts, and no financial/external mutation.
- Migration 0187 + database verifier establish forced RLS, tenant FK, idempotent and unique active intentions, direct API denial and withdrawal integrity. GitHub's PostgreSQL 17 CI run must apply/verify them before the production merge. The linked Supabase project migration is applied separately after preproduction gates.
- Full local verify + parity, remote CI, browser and security checks, preview routes, exact merged SHA in production and runtime error scan are required before declaring the **code release** GREEN. This does not falsely assert live data operation without `DATABASE_URL`.

## Next build

**Build 177 — Arrival Planner, Pre-Registration & Check-In Readiness (Billing / Omnichannel HELD).** A guest-accessible pre-arrival checklist for arrival windows, occupants/vehicles, required acknowledgements, directions and readiness, with office handoff and no automatic gate/key or provider activation.
