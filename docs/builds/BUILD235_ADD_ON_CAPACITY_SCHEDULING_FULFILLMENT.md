# iCamp 235 — Add-On Capacity, Reservation Scheduling and Fulfillment

**Application owner:** iCamp platform shell (`icamp`, `RosevearCreations/iCamp`). Camp Rosevear and all other campgrounds remain independent child tenants, not integration source IDs.

## Delivered code

- Campground pricing managers can set or clear an optional **shared units-per-service-day** capacity for a published service. This differs from its per-booking minimum/maximum. Reducing capacity below already reserved active demand is rejected by the database.
- Guest checkout creates one reservation-linked fulfillment task for every selected optional add-on with a catalog identity. A transaction-level database guard serializes allocation by service/date and rejects exhausted capacity. The entire checkout (hold conversion, reservation, charge snapshot and queue task) rolls back together on failure.
- Campground staff with `reservation.modify` can see their campground's active pending/confirmed/checked-in add-ons; select a date within the reserved stay and a time window; schedule, begin, block, reschedule or complete service work. Stale versions, unsupported transitions and over-capacity rescheduling fail closed.
- Rows carry immutable reservation/charge scope, quantity, actor updates, optimistic versions and ordinary audit receipts. Existing guest prices and immutable charge lines are never edited by fulfillment actions.
- Historical **active** add-on reservation lines are backfilled once with an arrival-day queue entry. Cancelled or completed stays are not reopened. Cancelled reservations do not count against ongoing capacity or appear in the active queue.

## Explicit boundaries

This is not a stockroom inventory feed, staffing optimizer, refund workflow, payment authorization, automatic guest notification or access-control command. `reservation.modify` does not grant `pricing.manage`; no Sysop grant is inferred. No public guest record, contact details, payment information, original owner signer or tenant-private contents are sent to AI Data Platform or Rosevear Comms Hub.

## Verification and deployment

- `tests/build235-service-capacity-fulfillment.test.mjs` covers input limits, state transitions, edge dates, guarded checkout wiring and permission/audit structure.
- `database/migrations/0220_build235_add_on_fulfillment.sql` contains row-level security, workload indexes, history backfill, in-database identity/scope and allocation guards.
- `database/verify/0220_build235_add_on_fulfillment.sql` requires installed table/policies/triggers and denies direct queue inserts from the app role.
- Required release chain: local `npm run verify` → protected Build 235 PR to `dev` → verified exact-tree PR to `main` → production deployment READY and commit parity. Database migration **0220** must be applied and independently verified on the actual production database before accepting live add-on scheduling or checkout. Local and CI green alone do not prove installation.
- Field acceptance still needed: pricing-manager capacity editor; competing two-guest checkout same service/day; staff reschedule into full day; stale row update; cancellation release; tablet/mobile and keyboard interaction in the real campground tenant. Without live original-host evidence, report those axes as `HOLD` or `UNKNOWN`, not 100%.

## Master Shell architecture alignment

| Contract area | Build 235 disposition |
| --- | --- |
| Source identity | Reuses exactly `icamp` at the platform shell; Camp Rosevear remains a tenant. |
| Source-owned health | Existing `lib/integration-v1/ql364-source-health.mjs` is unchanged. No private connection is asserted. |
| AI Data Platform reporting | Eligible *future* aggregate: tenant-partitioned counts of queued/blocked/completed tasks and capacity failures, after shared schema/audience approval, with no guest PII. Not sent by this build. |
| Comms Hub | Eligible *future* consented reminder or escalation request. Queue transitions send no message and issue no execution permission. |
| Shared contract changes | None. Event envelopes, signer authority, recipient routing and source approval stay under the proposed Master Shell change-control process. |

**Next proposed build — iCamp 236:** Add-On Work Assignment, Staff Load and Fulfillment Exception Review. Keep any new workforce assignment and customer notification changes behind separately tested tenant permissions, consent checks and audit evidence.
