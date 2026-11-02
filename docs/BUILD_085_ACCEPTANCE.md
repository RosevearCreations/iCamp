# Build 085 — Beach, Lake/Ocean Swimming & Waterfront Safety Rules

## Scope and separation of authority

The campground safety register at `/workspaces/management/campgrounds/waterfront-safety` records manual, operator-attested swimming zone controls for **registered beach facilities**, not the Build 084 pool module. A beach may contain multiple distinct zone codes and immutable operating versions. A zone's swimming status is separate from the canonical operational status of its physical beach.

### Controls delivered

1. **Zone versions:** management publishes a physically described, signed-off-by-operator swimming boundary; opening days and same-day hours in the campground's own timezone; capacity; age and supervision policies; written emergency/hazard instructions; exact current waterfront guest-rule version. Changes create immutable version history.
2. **Guest admission:** assigned, independently training-verified staff record real-time swimmer/child/adult counts, age checks, observed hazards, and the account-linked reservation. A *positive* admission is database-blocked outside local opening hours, without required guest acknowledgement, above numeric limits, with an active swim closure, with a non-operational beach, without verified staff, or when the event explicitly reports caution/unsafe conditions. A negative admission may be recorded outside those limits.
3. **Hazard and closure:** monitors may record incidents or immediately close swimming even before management has verified their qualifications. Incident entries are **not** automatic closures; the operator must make a distinct closure record where warranted and physically close/warn the area.
4. **Independent reopening:** a verified waterfront monitor requests reopening after correcting conditions. An owner/manager then references separate evidence and may reopen only when the physical beach is canonically operational. The manager cannot be the closer or requester; closure and reopening history remains immutable.
5. **Access and tenancy:** owner/manager roles can manage safety; waterfront attendants can read and monitor, but cannot approve reopenings or verify their own training. Forced RLS, context-bound database validation, composite tenant foreign keys and non-public Data API grants restrict access. Guest-specific warnings/removals do not create Build 083 suspensions.

## Real-world owner acceptance (required before operating)

- Register the beach as an operational facility, agree and visibly post its marked boundaries, and publish the applicable current **waterfront** guest rule with acknowledgement as needed.
- Review local laws, accessibility provisions, supervision age/ratios, rescue equipment, daily water sampling, weather alerts, currents, wildlife, signage, contingency plans and life-saving certifications with the competent local authority. The software's example starting values are **not** legal defaults or legal advice.
- Independently inspect actual staff training and expiry, verify a second manager is available for reopen reviews, and confirm shift coverage.
- With test reservations and staff, exercise refusal when the rule acknowledgement is missing; a positive check during permitted local hours; denial for caution/unsafe observations; above-limit refusal; closure amid an emergency; denied reopening by the closer/requester; and independent approval only after physical and documentary clearance.
- Check a second campground cannot view or mutate the first campground's zones, training, reservations or events. Verify expired training and revoked training both block positive admissions.
- Perform a tabletop emergency drill with real physical controls and the campground's official emergency instructions. **iCamp will not notify authorities, summon rescue personnel, inspect water or operate physical gates.**

## Automated release verification

- `node --test tests/build085-waterfront-swim.test.mjs` validates normalization and critical rejected payloads.
- `database/verify/0116_waterfront_swimming_safety.sql` verifies forced RLS, append-only DB privileges, no public access, minimum triggers and restricted attendant role.
- Main CI + CodeQL + secret scanning must pass on the exact promoted commit. Live migration status and the deployed app still require verification; developer tests cannot substitute for real beach acceptance.
