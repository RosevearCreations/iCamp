# Camp Rosevear — Synthetic Acceptance Data

This sample belongs to iCamp Build 085 acceptance, **not** to a real campground or guest account. It is intentionally isolated under its own organization and remains `inactive`. Every facility is canonically `unavailable` and internal-only; no physical infrastructure, inspection, water sampling or lifeguard certification is asserted.

## Contents

- 1 inactive campground in `America/Toronto`, 4 sections and 4 subsections.
- 4 unavailable facilities with canonical map objects: North Beach, pool, washroom and gate.
- A facility-specific synthetic waterfront rule with mandatory acknowledgement (no guest has accepted it).
- Two swimming zones: North Shore v1 + v2 to test immutable rule history; East Shore v1 for an independent zone.
- Two synthetic staff identities, disabled with **no password, session, MFA enrolment, or real contact**. One sample manager and one waterfront attendant are assigned only within this synthetic campground.
- One fake training marker, one hazard observation, one immediate North Shore swimming closure and a pending reopening request. The beach remains unavailable, so positive admission and reopening are correctly blocked.
- **No reservations, live payments, real people, bookable accommodation, outgoing communications or hardware controls.**

## Seed and verification

`database/fixtures/camp_rosevear_build085.sql` is a **manual, idempotent DML fixture**, not an automatic database migration. It refuses a database containing any unrelated campgrounds or user accounts. Run it only against an explicitly approved, isolated development/test Supabase project. Do not add it to CI migration auto-apply or the generic Build 016 seeder, which intentionally disallows production.

Confirm with the SQL in `database/fixtures/verify_camp_rosevear_build085.sql`. Re-run both in the isolated test database to prove idempotence without changing existing immutable event history.

The sample is not visible in iCamp's authenticated management UI until an actual owner registers and is *explicitly* assigned to it in a separate authorized administration workflow. Do not create a known-password test account or grant anonymous access to make it visible. Users can inspect it through the Supabase Table Editor meanwhile.

## Safety and maintenance

Never turn the synthetic site into a customer-facing campground or interpret a sample observation as real safety evidence. For real operations, create a new campground and complete licensing, water testing, staff qualification, signage, emergency procedures and on-site inspection. The fixture remains intentionally unavailable after seeding.
