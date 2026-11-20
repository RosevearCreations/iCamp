# iCamp Build 267 — Owned Support, Consent-Gated Signed Telemetry & Original DB Acceptance

## Delivered code
- Migration **0242**: persistent platform-operator support assignment, optimistic versioning, append-only assignment/escalation receipts, role/actor database checks and no destructive deletion.
- MFA-protected platform Sysop may assign unresolved original support cases to **active** verified platform staff and escalate up to three levels; other campground customer details stay outside the Sysop aggregate. No unattended alert paging.
- Local campground owners control explicit enrollment/revocation of their own telemetry source. Enrolment requires campground.operations.manage.
- Internal ingestion accepts a **small bounded payload**, HMAC-SHA256 signed against environment secret `ICAMP_TELEMETRY267_HMAC_SECRET`, fresh within one minute, source currently enrolled, and unique nonce. Counters are checked and persist in private FORCE RLS records. Never accept customer text, personal data or unverified providers.
- Sysop dashboard reports **actual accepted samples** aggregated over the last hour, or `NO_ORIGINAL_SAMPLES`, never synthetic zero-traffic trends.

## Independent release acceptance and limitations
1. Test ephemeral migration 0242 with database CI and test HMAC acceptance/denials.
2. Inspect **original** production schema migration history, checksum and `to_regclass` for all 0242 tables; access to production `DATABASE_URL` is essential. Runtime presence does not prove independent historical custody or completeness.
3. Enroll a real campground's telemetry source explicitly through the local management screen. Configure the signing credential securely with both service and source. Never expose the signing secret to browsers or logs. Verify a real provider signed sample and replay denial.
4. Verify both `dev` and `main` CI + CodeQL + Secret Scan, and exact protected main-SHA Vercel production READY.
5. Confirm newly connected original telemetry is from a real source rather than CI or staged fixtures. Without those receipts, external live-telemetry activation remains HOLD.
6. Staffed 24/7 response, automatic SLA paging, assignment notifications, case comments, complex ownership routing, independently witnessed database restoration and the seven peer live topology are **not** certified by code-only tests.

## Completion score discipline
Material support management and ingestion contracts are new functional source, not independently witnessed external activation. Increase completion only where tested feature scope justifies it; physical/provider onboarding remains 0 until proof exists.

## Follow-on
Build 268 — Supervised Production Enrollment, Real Signed Traffic Pilot, Durable SLA Notification Delivery, and Independent Restore/Recovery Witness.
