# Build 177 — Arrival Planner, Pre-Registration & Check-In Readiness

**Billing / Omnichannel HELD.** Source-backed web/PWA release scope. A green software deployment does not authorize provider calls, billing, SMS/voice, physical access or remote check-in.

## Guest experience

- `/guest/arrival-planner` requires a signed-in guest account and selects only reservations linked to that account. My Stay links into the exact stay.
- Current confirmed reservation dates, campground-local check-in/out times, booked party counts, confirmation evidence and published campground guidance are shown as source records, never synthesized.
- Guests may save an incomplete editable draft or explicitly submit a complete plan with estimated arrival time, arrival mode, vehicle/visitor counts, document preparation and guidance review. No reservation/charge/capacity write occurs.
- Accessibility assistance is opt-in and limited to a short practical note. Without consent, notes are discarded; no ID, medical history, licence plate or payment credentials are requested.
- A missing confirmation, arrival-time mismatch, changed counts, recorded balance or financial hold is an **office follow-up** issue, not a guest approval or readiness claim.
- A version-pinned staff-review receipt is visible to the guest and becomes stale if the plan or reservation changes.

## Staff experience

- `/workspaces/management/campgrounds/reservations/arrival-readiness` shows only the authorized property's next-14-day confirmed/checked-in arrival window, including not-started, draft and submitted plans.
- The staff queue compares proposed counts, document preparation, assistance request and arrival time with current booking records. `reservation.modify` is required to record an internal checklist result and a written reason is mandatory for `follow_up_needed`.
- The review stores the exact guest-plan and reservation revisions and is never itself a check-in, payment clearance, credential provision, gate opening, staff dispatch or external notification.
- Canonical check-in remains the existing `/workspaces/management/campgrounds/reservations/check-in` flow with independent balance, identity, rules and operational verification.

## Storage and security

- Migration `0188_build177_arrival_plans_and_staff_review.sql`, verification `0188_build177_arrival_plans_and_staff_review.sql`.
- Both tables use forced RLS; only the internal `icamp_app` role is granted access, with authenticated guest ownership and campground-scoped staff read/modify policies; anonymous/client role grants are explicitly revoked.
- A composite foreign key binds every review to the exact tenant, reservation, guest and plan. Identity columns are immutable; row-version touch triggers support stale-form rejection.
- Guest write transactions lock the owner reservation and plan, reject an expired/stale/non-confirmed source, and run DML under an app role with guest context. Staff reviews lock the source row versions and require current `reservation.modify` permission.
- `DATABASE_URL` is a Production-scoped Vercel secret; do not expose it to Preview or browser bundles. No production seed data or fabricated arrival receipts are created.

## Release verification

Run `npm run verify`, `npm run parity:verify`, CI Postgres migrations and all verification scripts, browser end-to-end, CodeQL, secret scan, Vercel preview smoke, production Supabase migration readback, exact `main` SHA and runtime errors. Browser checks without guest credentials may prove authenticated redirection, **not** an authenticated workflow receipt; never claim otherwise.
