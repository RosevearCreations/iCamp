# iCamp Build 261 — Production Migration Provenance, Independent Provider Enrollment & Financial Assurance

## Implementation
Build 261 extends the protected Build 260 review with a read-only owner
assurance page at /workspaces/management/command/finance-assurance261
and a fail-closed check **inside the existing Build 260 owner-approval action**.
It does not invent a payment processor, migration receipt or original signature.

### Exact production database checks
- Use the actual production DATABASE_URL only when VERCEL_ENV=production,
  VERCEL_GIT_COMMIT_SHA is a valid full commit SHA and the connection's
  hostname matches ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST.
- In a read-only repeatable-read transaction, inspect original
  icamp_meta.schema_migrations version 0238 and compare the ledger's
  checksum_sha256 against the protected source SQL bytes:
  7cec224311959280b6199fa3ed373bc86c2a08678807e4a6d2795ae11280def3
- Check the original Build 260 owner ledger's FORCE RLS, two scoped policies,
  immutable UPDATE/DELETE privileges and database approval trigger.
- A merely typed host pin is NOT independent original-host attestation; no
  host identity, backup or signed migration receipt is fabricated. The readback
  is useful technical proof but cannot stand alone for a financial release.
- CI database migration success means a CI test database passed: it must not
  be reported as an independently verified production database migration.

### Provider key enrollment
The app expects protected Vercel Production configuration, enrolled only after
verifying the **real provider's identity out of band**:
- ICAMP_SETTLEMENT260_PROVIDER, ICAMP_SETTLEMENT260_KEY_ID,
  ICAMP_SETTLEMENT260_PUBLIC_KEY_PEM: provider-issued Ed25519 public key.
- ICAMP_SETTLEMENT261_REVIEWER_PUBLIC_KEY_PEM: separate, independently
  authenticated reviewer Ed25519 public key.
- ICAMP_SETTLEMENT261_REVIEWER_ENROLLED=true: only after actual separate
  reviewer identity and key custody are confirmed.
- ICAMP_SETTLEMENT261_ENROLLMENT_JSON: JSON
  {payload,issuerSignatureBase64,reviewerSignatureBase64}.
  The payload must have schema=icamp.provider-enrollment.v1, provider, keyId,
  issuerFingerprintSha256, reviewerFingerprintSha256, sourceRevision (the
  current production SHA), migrationVersion="0238",
  migrationChecksumSha256, independentReviewReference, issuedAt, expiresAt.
  Both original parties sign exactly JSON.stringify(payload) UTF-8 bytes.
  Enrollment is bounded to 30 days and must be renewed after a source update.
  Never use a test/private key generated in ChatGPT as a production issuer.
- These are **public verification keys** and signed enrollment statements,
  not payment API keys. Private signing keys must never enter the app or chat.

### Settlement/close boundary
- A cryptographically matched enrollment is evidence of control of two keys,
  not conclusive proof of provider legal identity, settlement or bank clearing.
- The Build 260 owner approval action requires the Build 261 technical
  assurance gate before append-only, non-posting approval.
- No actual external payment adapter is installed. Live capture/refund and
  production settlement activation remain HOLD, regardless of any signed
  envelope or code deployment.
- Do not set an acceptance result to GREEN by faking source data, supplying
  self-signed statements, skipping production migration checks or changing
  review decisions.
- Actual bank settlement statements, accounting/tax advice, HST treatment and
  statutory financial close remain separate human-controlled processes.

## Release verification
Protected PR formatting, lint, typecheck, unit tests, CI PostgreSQL migration
tests, browser checks, CodeQL, Gitleaks, source-exact dev promotion, protected
main merge and exact-SHA Vercel production READY. Operational activation is a
different status from a code release, and stays HOLD until genuine receipts.
