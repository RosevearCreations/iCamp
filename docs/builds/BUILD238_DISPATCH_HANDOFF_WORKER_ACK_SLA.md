# iCamp Build 238 — Add-On Dispatch Handoff, Worker Acknowledgements & Fulfillment SLA Evidence

## Campground product boundary

iCamp is the complete multi-campground SaaS service; Camp Rosevear is a
customer/sample campground with its own reservations, workers, inventory,
payments and operational decisions. Rosevear Sysop and the proposed Master
Shell remain monitoring-only. Build 238 does not give the Master Shell,
Comms Hub or AI Data Platform access to a campground's worker records.

## Implemented workflow

1. **Manual supervisor dispatch:** On a currently scheduled or in-progress,
   reservation-backed add-on job, a campground supervisor with both
   `reservation.modify` and `staff.manage` may record a single immutable
   handoff to the currently assigned authorized staff member. Job and
   assignment versions are checked with locked rows and forced-RLS guards;
   stale or duplicate dispatches fail closed.
2. **Campground-defined service-level targets:** The supervisor must enter an
   acknowledgement deadline between 5 minutes and 7 days. The authoritative
   clock starts at the database dispatch timestamp; a completion target in UTC
   is optional and never invented. These are measured targets, not automatic
   guarantees or financial penalties.
3. **Worker-only receipt:** The current assigned staff member can acknowledge
   receipt or request support, with a required reason for support. The receipt
   is append-only, unique per handoff, guarded by the active task/assignment
   version and actual worker identity; supervisors cannot sign for the worker.
4. **Evidence:** The private queue shows response timestamps, on-time/late/
   overdue status, optional completion target status based on the existing
   authoritative completion timestamp, and recent superseded handoff history.
   The server-side read model restricts workers to their own dispatches while
   authorized supervisors may review campground-wide status. Counts warn when
   truncated; no absence is converted into a successful acknowledgement.
5. **Audit and isolation:** Migration 0223 adds two append-only tables, dual
   tenant-key foreign keys, explicit RLS/role grants and database guards.
   Every dispatch and receipt appends a scoped audit event. No guest, payment,
   shift, reservation, inventory, device, external message or shell mutation.

## Acceptance evidence

- `node --test tests/build238-fulfillment-dispatch-sla.test.mjs`
- `npm run verify` (full lint/typecheck/unit/build)
- `database/migrations/0223_build238_fulfillment_dispatch_sla.sql`
- `database/verify/0223_build238_fulfillment_dispatch_sla.sql`
- Required protected GitHub PR and post-merge checks, then exact-revision Vercel
  production READY. Ephemeral CI database success must not be confused with
  original hosted campground database adoption or human field acceptance.

## Operational acceptance still required

Camp Rosevear must first approve actual target times and make a supervised
dispatch to a real authorized worker. Neither a local test nor a synthetic
receipt asserts that a real staff member accepted work, that a live database
is migrated, or that Comms Hub has an authenticated connection.

## Next proposed build

**iCamp 239 — Fulfillment Reassignment, SLA Exception Follow-Up & Worker
Mobile Inbox.** Prepare accessible, paginated worker task handoffs and
supervisor re-dispatch escalation, still campground-owned and opt-in.
