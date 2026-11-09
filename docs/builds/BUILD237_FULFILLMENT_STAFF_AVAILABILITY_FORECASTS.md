# iCamp Build 237 — Fulfillment Staff Availability, Shift Conflicts & Assignment Capacity Forecasts

## Product boundary

iCamp remains the complete campground SaaS product. **Camp Rosevear** is a
sample customer campground, with its own reservations, shifts, staff, guests,
inventory and finance records. The Rosevear Sysop / Master Shell monitors
product health and evidence separately; it does not own or directly mutate
tenant work assignments.

## Implemented

1. **Private, time-zone-aware shift forecast** — the campground supervisor
   compares the next **30 local days** of active, reservation-linked add-on
   demand with Build 190's actual scheduled shifts, cancelled shifts and
   uncleared staff-unavailability events. Reads require three independent
   permissions: `reservation.modify`, `staff.manage` and `schedule.manage`.
   No cross-campground shift visibility is granted.
2. **Explicit campground planning settings** — a supervisor defines local
   morning, afternoon and evening windows, plus an optional maximum number of
   add-on units per worker and service window. Windows are ordered and
   nonoverlapping within 04:00–23:59; there are **no inferred default hours**.
   Changes are checked by forced RLS, database trigger, row-version control
   and audit event in one transaction (migration 0222).
3. **Distinguishable warnings** — unassigned work, now-ineligible staff,
   unspecified `anytime` windows, missing window configuration, declared
   unavailability, partial shift coverage, no covering shift recorded,
   demand exceeding an owner-set unit threshold, coverage without a unit
   threshold, and within-limit recorded coverage. The same warning appears
   beside relevant work cards and in the aggregated 30-day staffing table.
4. **Careful limits on truth** — forecasts describe recorded planning
   evidence, not actual attendance, performance, qualifications for a specific
   service, or guaranteed dispatch capacity. Service units are not staff
   hours. The 250-row forecast limit is flagged. The server never modifies
   shifts, accepted charges, guest communications or gate controls.

## Acceptance evidence

- Unit/static: `node --test tests/build237-fulfillment-shift-forecast.test.mjs`
- Application: `npm run verify`
- Schema: `database/migrations/0222_build237_fulfillment_shift_forecasts.sql`
  and `database/verify/0222_build237_fulfillment_shift_forecasts.sql`
- Release: require protected `dev` and `main` CI and a Vercel production READY
  deployment for the exact merged commit. CI's ephemeral database migration is
  not proof of original production database adoption or a signed-in Camp
  Rosevear field acceptance.

## Next proposed build

**iCamp 238 — Add-On Dispatch Handoff, Worker Acknowledgements & Fulfillment
SLA Evidence.** Only after the campground accepts its planning windows and
authorizes an actual dispatch workflow; continue to preserve worker and guest
privacy, tenant isolation, and manual operational control.
