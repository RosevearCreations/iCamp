# Build 289 — Campground creation and tenant onboarding

Initial slice: the authenticated platform shell can prepare and export a
nonbinding new-campground draft. An assigned campground manager can follow
the setup wizard using existing authorized editors for property, sections,
accommodation, map publication, policies, amenities and services. Readiness
is derived from the canonical records and unknown sources fail closed.

The platform shell remains read-only with respect to tenant records. Actual
organization/campground creation and first-owner assignment require an
independently approved, transactional, audited provisioning service with
tenant isolation, duplicate prevention, backup and recovery verification.
This slice intentionally does not implement that mutation or claim full
onboarding, billing, branding, tax or operating-season configuration.
No original database, account or subscription is modified.

Acceptance: invalid draft values rejected; drafts cannot activate tenants;
scope must match the current authenticated staff assignment and configuration
permission; missing or incomplete map sources are not called ready. Actual
authenticated multi-tenant rehearsal and first owner access remain HOLD.
