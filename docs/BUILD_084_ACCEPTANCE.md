# Build 084 — Lifeguarded Pool & Supervised Swimming Safety Workflow

## Scope and safety boundary

Build 084 introduces campground-scoped immutable pool policy versions, credential verification/revocation decisions, supervised admissions/refusals, warnings, removals, holds and management-reviewed releases. It is an **operator register**, not a pool-access actuator, an emergency responder, proof of lifeguard qualification or legal-compliance certificate. Facility closure and reopening remain in Build 069. Campground-wide guest restrictions remain in Build 083.

## Operator acceptance walkthrough

1. Create an operational pool and its inspection/maintenance program in Aquatics (Build 069). Publish a pool rule version in Campground Rules (Build 082). Confirm the pool is operational and a guest has accepted the exact version in My Stay.
2. As assigned campground management, publish local capacity, age, supervision ratio, staffing and emergency instructions on **Campgrounds → Pool safety**. Verify the limits against the currently applicable local public-health rules, site permits and operating procedures, including supervisor minimum age. Publishing an old rule version must fail.
3. Assign the `pool_lifeguard` template role to a staff member. Management independently inspects their actual credential and records the reference plus future expiry. Self-verification, nonassigned staff and expired credentials must be rejected. Revoke the credential and confirm further events are denied.
4. As the qualified lifeguard, record an admission observation for a confirmed or checked-in reservation. Record bathers, underage swimmers, supervisors, lifeguards, age-verification attestation and admission/refusal. Admission with capacity/ratio/staff deficits, no rule acknowledgement, changed rule or closed pool must fail. A refusal is evidence, **not** physical access automation.
5. Record a swimming warning and removal. Confirm neither automatically suspends a reservation. For broader enforcement, create a separate Build 083 suspension request for independent management approval.
6. A qualified lifeguard records an immediate supervised-swimming hold. Positive admission is now blocked. **Staff must close the actual pool, follow signage and notify people on site using approved emergency/safety procedures**; iCamp does not physically close it.
7. After appropriate on-site remediation, a qualified lifeguard requests release. Canonical pool must first be operational again through Build 069's signed-inspection requirements. A different authorized manager approves the release. The hold originator or requestor cannot self-approve. Repeated release without hold, or release while the pool is not operational, must fail.
8. Verify read/attest/manage permissions and campground isolation, append-only policy/credential/event tables, lack of direct anonymous/authenticated Data API reads and immutable timestamps. Test mixed pool-policy selections and expect server-side rejection.

## Known boundaries and follow-ups

- Age and supervisor suitability are attested by qualified on-site staff; software does not independently inspect IDs, validate certificates with issuers, count live swimmers or test water quality.
- Policy supports a configured maximum number of children per supervisor; the actual range and any additional jurisdiction-specific conditions are the owner's responsibility. In particular do not assume the form's starting sample values are legally valid.
- Release records only a *swimming supervision* decision. Separately follow emergency response, signed inspections, the physical pool lock/gate protocol and required public-health notifications.
- No production guest swim/admission is automated. Acceptance with real on-site lifeguards and actual facility documents is required before operational adoption.
