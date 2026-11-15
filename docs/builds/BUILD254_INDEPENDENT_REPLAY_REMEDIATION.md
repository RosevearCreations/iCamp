# iCamp Build 254 — Independent Dispositions, Durable Replay and Three-Master Freshness

## Shipped code (not operational activation)

- Add original PostgreSQL migration `0234_build254_receipt_replay_remediation.sql`
  with **two tenant-private append-only tables**: `service_fulfillment_source_receipt_claims`
  and `service_fulfillment_remediation_decisions`. Both force RLS, with
  icamp_app SELECT+INSERT only and no UPDATE/DELETE privileges. Original nonce
  digest and original receipt digest are globally UNIQUE to prevent replay
  across tenant boundaries. Every claim binds the current exact Vercel SHA,
  campground owner, original source, Ed25519 signer fingerprint and issuance
  time; the database guard rejects receipts older than 15m (Master) or 24h
  (independent database provenance) or future-dated beyond 60s.
- Independent remediation decisions are limited to
  `hold`, `reject`, `request_fresh_originals`, and
  `request_independent_review`. SQL requires distinct original claimant and
  reviewing owner, same tenant, exact source and owner authority. A claim
  can be dispositioned only once. This is **not production acceptance**.
- Protected server service validates signed original Master receipt packets
  through existing Ed25519/three-distinct-custodian checks and the exact
  source revision; original independent database provenance through the
  prior Build 253 verifier. Receipt admission takes only a safe receipt-type/
  plane selector from the browser, never signing material. Verified originals
  are read from server-only protected environment settings. Once-admitted
  source claims and independent decisions are stored with audit events.
- Campground route `/workspaces/management/campgrounds/independent-review`
  requires current MFA `aal2`, owner_admin and `staff.manage` +
  `reservation.modify`. Source-only claims and two-person HOLD forms. If
  original DB migration or signing not configured, fail CLOSED; no artificial
  signers or test receipts.
- Sysop route `/sysop/security-governance` reuses the actual MFA-qualified
  platform Sysop grant, original 3-Master signature checks and the source
  checksum/provenance reports. Shows six tiers of security, separate Master
  receipt statuses and renewal horizons. All-current signing does NOT
  authorize receiver ON or Master CONNECTED. The operational source-health
  and owner approval gates stay explicitly HOLD.

## Real runtime prerequisites

On Vercel Production use the real `DATABASE_URL` and
`ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` from independent verified DB custody.
Review backup and apply migration 0234 through the canonical migration
runner to **that exact authenticated production DB** under proper change
authority. A GREEN CI migration proves only a disposable PostgreSQL
integration test. The protected private `ICAMP_MASTER_ACCEPTANCE_READBACK_JSON`,
`ICAMP_MASTER_RECEIPT_PINS_JSON`,
`ICAMP_MASTER_RECEIPT_CUSTODIAN_ENROLLED`, plus source-healthy and
DB-provenance receipt/pins must come from REAL independent source custodians,
not synthetic fixtures. Missing values intentionally HOLD.

No new public API, job scheduler, automatic database migration, owner
acceptance, provider enrollment, cross-tenant messaging, real payment or
guest data transfer. Code release and real runtime CONNECTED are separate.

## Multi-domain measurable expansion

Owner requested a material broad-based growth target. This build does not
magically advance every application by a measurable 10 percentage points.
The source-controlled **ten-build queue 255–264** assigns acceptance tests
and module-specific evidence that target at least +10 percentage points for
every measured iCamp domain, from a documented baseline. See
`docs/roadmap/BUILD254_264_SEVEN_APP_SECURITY_PRODUCT_EXPANSION.md`.
All three Master applications and the two shells plus direct brand apps are
mapped without changing tier boundaries.

## Release gates

Protected full Next.js + TypeScript/lint/format, Node unit tests, browser
harness, isolated PostgreSQL migration and idempotency, CodeQL and Gitleaks,
exact-source Vercel Preview READY, independent main release branch with
only 254 changed files, production deployment READY exact SHA, live HTTP/alias
and runtime errors check. Standard / Meadow hero/photo and Orbit theme
tokens remain unchanged. External Master signing and owner authority stay
HOLD until originals are independently verified.
