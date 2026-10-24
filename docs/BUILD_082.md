# Build 082 — Versioned Campground & Facility Rule Sets

## Delivered

- Campground-scoped policy identities in seven rule categories: campground, pool, waterfront, sports, playground, event and access. Optionally link a facility-category rule to an existing facility asset in the same campground.
- Manager/owner publication screen with version history immutability, consecutive version numbering, retry-safe publication identifiers and optimistic version expectations.
- Published text (30–10,000 characters) and optional acknowledgement-required flag are snapshotted with the exact version, author and timestamp.
- My Stay presents the latest campground/facility publications to a confirmed or checked-in guest who owns the reservation. The guest must explicitly check and submit an exact-version acknowledgement when required; old acknowledgements are preserved when a rule is republished.
- Campground-specific RLS, no direct Data API grants for anon/authenticated, staff publication/read permissions, append-only DB guards and guest/reservation validation.
- New help-circle guidance, management shortcut, unit tests and database migration/verification.

## Safety and operational boundaries

- Publication alone does **not** supersede accepted checkout snapshots or enforce a waiver at the booking gate. No access suspension, automatic evacuation, capacity enforcement, facility closure, legal sign-off or replacement of trained safety supervision occurs here.
- Rules should be reviewed for correctness by campground management before publishing. Explicit guest acknowledgement confirms that a specific document was presented and accepted from an authenticated My Stay account; it is not proof of physical attendance, comprehension or legal compliance.
- Existing live access zoning and access schedules remain their own source of truth.
- Web/PWA is the authenticated guest acceptance path. IVR/DTMF and SMS should only deliver current guidance or a secure link to My Stay; unverified phone/text messages do not create acceptance records.
- Rules are visible to guests with a confirmed or checked-in reservation only. The current build deliberately does not implement public pre-booking rule discovery or unauthenticated consent.
- Published rule identities and versions are append-only by design. Future archiving/supersession workflows should be separately designed to preserve historical acceptance.

## Verification

- `database/migrations/0109_versioned_campground_facility_rules.sql`, `0110_build082_fk_indexes.sql`, `0111_build082_guest_reservation_rls.sql`, and `0112_build082_guest_rls_policy_consolidation.sql` (which preserves staff permissions and adds the signed-in guest's own active reservation without duplicate permissive SELECT policies), plus `database/verify/0109_versioned_campground_facility_rules.sql`.
- `tests/campground-rules.test.mjs`, full test suite, formatting, lint, type check, production build and production-gated GitHub workflows.

## Next

Build 083 — Warning, Suspension & Reinstatement Workflow. Requires authorized staff decisions, management review, durable history and explicit links to the rule version applicable at the time. Enforcement must not be silently inferred from a rule publication or guest acknowledgement.
