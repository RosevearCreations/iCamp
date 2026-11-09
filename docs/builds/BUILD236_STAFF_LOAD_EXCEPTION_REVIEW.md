# iCamp Build 236 — Add-On Work Assignment, Staff Load & Fulfillment Exception Review

## Application boundary

iCamp is the complete campground software product. Each subscribing campground
(including the sample **Camp Rosevear**) owns its reservations, staff, guest
records, inventory and payment operations inside its own tenant workspace.
Rosevear Sysop / Master Shell oversight is a separate, read-only intelligence
and troubleshooting layer; this build does **not** introduce a privileged
cross-tenant operations path or publish guest data to that layer.

## Implemented

1. **Supervisor-assigned fulfillment** — `staff.manage` **and**
   `reservation.modify` grants are required to assign/unassign or transfer a
   reservation-linked add-on job. The worker must have an active staff account,
   an active assignment in the **same campground**, and `reservation.modify`.
   Database triggers and forced row-level security independently enforce
   scope, staff eligibility and completed-job immutability. Row versions and
   job locking protect against stale or overlapping submissions. Reassignments
   retain audit history and never modify the accepted reservation line.
2. **Campground workload view** — staff task counts, service quantities and
   blocked task counts across *all* active, non-completed work; includes
   unassigned work and work tied to departed staff. Counts are grouped by
   campground, not across customers. Service quantities are not a measure of
   staff hours or capacity, and the queue still shows at most 250 jobs, with
   blocked work first.
3. **Exception review** — a blocked job can receive append-only supervisor
   decisions (`acknowledged`, `follow_up_required`,
   `ready_to_reschedule`) with a mandatory explanation. Each review pins the
   current blocked job revision; old decisions are not carried forward to
   later blocking episodes. The three latest decisions for the active block
   appear on the work card. A review never automatically resumes work,
   bills a guest, sends a notification or operates a gate.
4. **Audit and privacy** — authorization checks at server action, service,
   forced RLS and trigger layers; both operations write audit events in their
   transaction. Staff account addresses are shown only to authorized
   campground supervisors. No guest personal data joins the queue projection.

## Acceptance evidence

- Unit/static test: `node --test tests/build236-staff-load-exceptions.test.mjs`
- Full application verification: `npm run verify`
- Database checks: `database/migrations/0221_build236_staff_fulfillment_review.sql`
  and `database/verify/0221_build236_staff_fulfillment_review.sql`
- Production release: require protected GitHub checks and commit-matched Vercel
  deployment READY on `main`; CI's ephemeral migration test does not establish
  an original production database migration or an authenticated Camp Rosevear
  field acceptance.

## Next proposed build

**iCamp 237 — Fulfillment Staff Availability, Shift Conflicts & Assignment
Capacity Forecasts.** Extend the current workload count into explicit
staff-shift availability and conflict warnings, with no inferred employee
working hours and no changes to campground tenant isolation.
