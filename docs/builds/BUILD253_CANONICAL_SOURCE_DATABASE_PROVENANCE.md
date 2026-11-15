# iCamp Build 253 — Canonical Checksum Reconciliation, Independent Database Provenance & Supervised Review

## Scope and source

Build 253 follows successfully promoted Build 252. The canonical migration registry binds three reviewed GitHub SQL files with byte-level SHA-256 values:

- `0231_build247_device_calibration_dossier_continuity.sql`
- `0232_build249_original_device_witness.sql`
- `0233_build250_owner_supervised_ceremony.sql`

The registry records release-verified SHA-256 and Git blob SHA-1 separately. **Every protected unit run re-reads and SHA-256 hashes the actual canonical SQL bytes** to reject a stale registry. The code does not confuse Git's object SHA-1 and SQL file SHA-256.

`/sysop/provenance-review` requires the existing MFA-qualified `requireSysop` and uses a read-only PostgreSQL query against the live process's `DATABASE_URL` only if the hostname matches the separately configured `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST`. It reconciles the exact recorded `icamp_meta.schema_migrations` versions, names and SHA-256 to the known SQL bytes. The public response hides the hostname, raw checksum, keys, secrets and tenant data. A matched host *configuration* and ledger checksum are **not** independent authentication of the production DB, and a missing row does not trigger an automatic migration.

## Optional independently signed production database provenance

These **server-only Vercel Production** values must be issued by real, independent operators; leave absent if unavailable:

- `ICAMP_DB_PROVENANCE_REVIEWER_ENROLLED`: literal `true` only after actual independent custody enrollment.
- `ICAMP_DB_PROVENANCE_REVIEWER_PIN_JSON`: separately verified Ed25519 reviewer `keyId`, SPKI base64 public key and independently authenticated SHA-256 public fingerprint. The reviewer must be distinct from the original iCamp source signer.
- `ICAMP_DB_PROVENANCE_RECEIPT_JSON`: signed JSON with `schema=icamp.database.provenance-receipt.v1`, `sourceId=icamp`, exact `sourceRevision`, `databaseHostnameSha256`, `migrationManifestSha256`, `reviewerKeyId`, `observedAt`, unique `nonce`, `decision=DATABASE_TARGET_AND_MIGRATION_CHECKSUMS_OBSERVED` and `signatureBase64`. The Ed25519 signature covers the domain-separated canonical array defined by `databaseProvenanceReceiptMessage`.
- Existing `ICAMP_SOURCE_HEALTH_PIN_JSON` and `ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED` must already represent independent ORIGINAL source custody. Do not invent or reuse development signing material.

The signed receipt is valid for at most 24 hours, is source-bound and **does not consume nonce uniqueness**; no replay-resistant DB ledger is created in this read-only build. It is a source observation, not an owner production signature, migration approval or receiver activation. A fresh main SHA invalidates older receipts.

## Supervised remediation evidence

The protected page shows scoped evidence and five operator assignments: canonical SQL bytes, distinct source and database custody, verified schema/backup, original signer and three-Master receipts, and separate formal owner decision. It is **not** a new database mutation channel. On missing data it fails closed with HOLD and recovery guidance. No RLS change, new table, guest data, contract payment, SMS/voice call, booking mutation or gate side effect.

Web/PWA: protected Sysop read-only. IVR/DTMF/SMS: intentionally unavailable for privileged private evidence; authenticated staff-assisted alternative only. App theme: Standard / Meadow + green hero remain unmodified; Orbit Command selectable.

## Release gate and queue

Require protected GitHub Verify, PostgreSQL migrations, Chromium, security scans, code analysis and Vercel exact-SHA READY, first `dev` then independently source-pinned `main`. Release GREEN is **code deployment only**; independent operational gates remain HOLD until actual external proof.

The repository's current `docs/BUILD_QUEUE.md` does not define a finite sequence beyond Build 253. The next **proposal**, not already-authorized build, is Build 254: independently recorded remediation reviewer decisions, signed-proof freshness/replay ledger and three-Master source receipt continuity. Remaining formally enumerated future builds after Build 253: **0 recorded**; the ongoing product roadmap is open-ended, so no reliable total completion count can be claimed.

See `docs/integration/BUILD253_SEVEN_APP_HANDOFF.md` for owner-ordered connectivity handoff.
