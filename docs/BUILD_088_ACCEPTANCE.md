# iCamp Build 088 — Cold-Weather Winter-Readiness Compliance

## Deliverable

For accommodation sites **not** subject to mandatory seasonal/yearly shutdown, an explicitly inspected and independently reviewed cold-weather operating-readiness path:

1. Publish an immutable campground-specific policy with four mandatory evidence domains: water-line insulation/approved heating or a physically verified no-water arrangement; safe heat/power/failure contingency; wastewater and drainage freeze protection; winter vehicle access and emergency egress. Local optional or required steps may be added and are version-pinned.
2. Create one assessment per accommodation and winter operating year, with optional non-shutdown long-term assignment linkage, observed water mode and local operating restrictions.
3. Record append-only, source-linked inspection observations for each domain. An unresolved defect must link an existing maintenance work order. Required safety steps cannot be marked "not applicable." New evidence supersedes the prior step observation without editing it.
4. Independent management/lead/foreman reviewer may approve only the current winter year's active site with all acceptable latest step evidence and no shutdown-required or already winter-closed active assignment. The reviewer must not have started or recorded the assessment. Rejection permits corrective follow-up; approval is terminal.
5. Private FORCE RLS, campground-scoped permission checks, immutable evidence and guarded database triggers. Human-readable ⓘ help throughout a dedicated Management winter-readiness workspace.

## Operational and legal boundary

- **Not a substitute for Build 087.** Any active seasonal/yearly assignment requiring winter shutdown must still complete water shutoff, draining and independent maintenance sign-off. An already winter-closed assignment is not reopened by this workflow.
- Approval is *documented staff attestation*, not proof that a heater is running, a line is insulated, roads have been plowed, environmental temperature is safe, or the property meets all local codes.
- No automatic booking availability, winter package activation, reservation acceptance, site opening, payment, equipment/gate control or emergency dispatch. Build 089 handles independent spring re-opening and return-to-service.
- Camp Rosevear is inactive synthetic test data. Templates, assessments and observations may be practiced there, but an approval claiming actual inspected physical readiness is blocked.
- Real operation requires trained local staff, inspection evidence, site- and jurisdiction-specific requirements and actual restrictions applied outside this record. IVR/DTMF and SMS only hand off to the authenticated Web/PWA operator workflow; they cannot submit or approve field-safety evidence.

## Verification and release

- `database/migrations/0120_cold_weather_winter_readiness.sql` passes rollback-only SQL dry-run against the connected Supabase project, then is applied with matching `database/verify/0120_cold_weather_winter_readiness.sql` and advisor checks.
- `tests/build088-cold-weather-readiness.test.mjs` tests mandatory domains, water mode, evidence, defects, future/past years, SQL safety gates and integrated help UI.
- `npm run verify` passes Prettier, lint, typecheck, unit tests and optimized Next production build.
- Feature PR → `dev` → production PR → `main`. At each gate, require green CI including browser and database tests, CodeQL and Secret Scan. Confirm exact `main` SHA and three successful production push runs before announcing GREEN.
