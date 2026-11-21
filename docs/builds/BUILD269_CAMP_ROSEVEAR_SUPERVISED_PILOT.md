# iCamp Build 269 — Supervised Camp Rosevear Pilot / Release Acceptance

Source of Value requirement owners: iCamp IC06–IC15 / IC21–IC25. The
**Yard Workers and iCamp Shell Review** controls the platform/tenant boundary.

## Current source baseline (verified in repository)
- Build 043 creates **one** booking confirmation per reservation and idempotent
  dispatch; this does not guarantee arrival in a real guest's inbox.
- Build 267 accepts opted-in signed source telemetry, but does not split
  guest booking traffic from staff actions.
- Build 268 adds local booking recovery cases, original migration readback,
  private guest follow-up, an SLA notification queue, and simulation-only
  decision tests. The deployment evidence does not establish real bank
  settlement or live restoration.
- Original production Vercel was independently found READY on main
  `1e3cb39ea246bf3073cb12c16c80cd6c06aca632` before this build.
  Environment listing showed `DATABASE_URL` but not the independent
  database-host pin, authenticated cron, live telemetry secret or Comms
  delivery authentication. Re-check them after deployment.

## Scope added by Build 269
1. Migration 0244: append-only scoped performance samples by **guest search,
   guest checkout, staff action, health probe**; explicit campground consent
   inherited from Build 267; strict event nonce, age and numeric bounds;
   FORCE RLS, immutable triggers and unique replay controls.
2. HMAC-protected private inbound `/api/internal/traffic269`, with
   `ICAMP_TELEMETRY269_HMAC_SECRET` plus explicitly pinned
   `ICAMP_TELEMETRY269_PILOT_CAMPGROUND_ID` and
   `ICAMP_TELEMETRY269_PILOT_SOURCE_ID` installed server-side only after
   original Camp Rosevear source and credential custody are accepted.
3. Signed downstream receipt `/api/internal/sla-delivery269`, requiring
   `ICAMP_SLA269_ACK_HMAC_SECRET`, `ICAMP_SLA269_ACK_SOURCE_ID`, an existing
   queued outbox item, matched source, verified previously attempted outbound notice, unique provider event and nonce.
   Updates a notice to **acknowledged** only after an authenticated
   *delivered* receipt. No sending occurs unless a real independently
   connected Comms sender is enrolled. Receipt is not proof of guest reading.
4. Private campground witness ledger ties one original recovery case to a
   SHA-256 artifact digest for processor check, site allocation, delivery
   evidence and guest follow-up. No raw guest names, emails, payment tokens
   or provider credentials leave the campground.
5. Rosevear Sysop page `/sysop/pilot269`: scoped tenant signal freshness,
   fifteen-minute counts and probe/guest separation, original source gates,
   signed receipt counts, and a two-person witnessed restore chain.
6. Recovery witness chain needs original backup hash, isolated restore and
   second **distinct verified** platform operator. These are custody assertions
   only. Successful real restoration must still be witnessed independently.

## Camp Rosevear supervised acceptance
1. Identify the **original** Vercel `DATABASE_URL` host through the securely
   pinned `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` without exposing secrets.
   Query original migration history for 0241–0244, matching checksums, role
   policies and private records. Never run migrations against an unrelated
   project merely because it is named iCamp.
2. Identify and authorize **Camp Rosevear** tenant. A separately inspected
   connected Supabase project showed a Camp Rosevear row with lifecycle
   `inactive`. Do not flip state in a possibly unrelated database. Obtain
   owner acceptance for an active test tenant on the original source.
3. Using an authorized guest, make a **test-mode processor payment** for an
   original hold and site-night. Inspect the provider's transaction, original
   payment event ID, reservation, site capacity and one confirmation receipt.
   Do not reuse real funds or create a second charge to prove retries.
4. Suppress the first original notification only in supervised test
   conditions, then retry the **same idempotent message**. Check provider
   delivery status and guest-side evidence. Record private follow-up and
   tenant-staff acceptance. A synthetic mock is not this acceptance.
5. Send an enrolled real first-stage traffic sample, reject replay, check
   guest/search vs staff/probes separation, interrupt the source to observe
   STALE, then restore source and verify FRESH. If the tenant is seasonally
   inactive, label as seasonal pause rather than outage.
6. Send a genuine authorized overdue SLA notice through Comms Hub and
   observe source-signed downstream provider receipt. Neither queued nor
   attempted is delivered. Confirm correct recipient and no duplicate.
7. Restore a protected original backup to an isolated target (never overwrite
   production); verify data integrity, tenant isolation, attachment/case
   linkage and hashes. Capture two *independent* human observations, and
   check original production availability afterward.
8. Protect unrelated tenants, guest details, campground books and unchanged
   paid transactions throughout. A payment-dispute decision stays with the
   campground; platform IT handles the technical incident.

## Fail-closed states
- Missing original database pin, migration, consent, season activation,
  HMAC secrets, outbound provider enrollment, external payment settlement
  or original independent restore proof = **HOLD** for that subsystem.
- Test-only CI/Playwright passes = code and simulation GREEN, not external
  acceptance. A Vercel READY deployment = code promotion, not revenue truth.

## Future priority
**Build 270 — Original-Host Camp Rosevear Source Enrollment, Authenticated
Comms Outbound Delivery Worker, Provider-Side Payment/Booking Trace, and
Independent Restored-Source Certification**. This needs actual original
credentials and approved test-mode provider account; no sham GREENs.
