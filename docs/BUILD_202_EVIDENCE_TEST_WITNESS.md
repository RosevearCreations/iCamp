# Build 202 — Independent Pilot Evidence Intake, Trusted Peer Enrollment Review & Scoped TEST Handshake Witness

**Tenant fixture:** Camp Rosevear. **Source:** RosevearCreations/iCamp. **Risk boundary:** code deployment is not permission to launch, enroll a peer, contact Comms Hub, charge or message guests.

## Original evidence baseline (read-only 2026-11-04)

- iCamp `icamp_private.integration_handshake_receipts`: **0 real rows**.
- QL-335 signed shell GET handlers exist at `/api/integration/v1/shell/health` and `/capabilities`, but `verifyICampShellGet()` is not wired to an original-source KMS, independent issuer/workload trust, approved TEST owner receipts or a durable nonce claim. An unauthenticated production request returned HTTP 405/HOLD at the exact Build 201 production SHA.
- Build 201's local device report is expressly not an independent real-device witness. No authentic owner acceptance or original source signer was provided for this build. Do not assert “connected,” “verified,” or “go-live” from these inputs.

## New functionality

1. `/pilot/acceptance` now offers a private Build 202 owner/I.T. evidence intake alongside the Build 201 retest. Only authenticated users with an assigned campground and new `pilot.evidence.intake` / `.review` permissions can write/read a bounded source reference and its **claimed, not independently verified** SHA-256. No guest names, screenshots, phone numbers, credentials, tokens, public upload or arbitrary narrative are accepted.
2. `/api/it/pilot-evidence` is same-origin, authenticated and per-campground scoped. GET returns authorized assignments or the campground's at-most-100 submitted reference rows; POST validates strict fields, duplicate IDs and a 4 KiB limit. Both fail closed on unavailable storage and use private `no-store` responses. The private Postgres role uses an actor-bound session (`icamp.user_id`), policy-controlled tenant access and no public Data API grants.
3. Migration `0214_build202_pilot_evidence_intake.sql` introduces append-only records in `icamp_private`, with immutable `SUBMITTED_UNVERIFIED` state, `independent_verification=false`, a database trigger denying updates/deletes, per-tenant RLS and distinct submission/review permissions. A submitted claimed digest cannot become authentic simply by saving it; there is **no** automation to change trust state.
4. `npm run build202:scoped-witness` exercises source-owned QL-335 Ed25519 signed shell health/capabilities using **ephemeral local fixture keys only**. It validates the contract, simulated atomic one-time nonce, wrong issuer, tenant query, production, missing source KMS and missing authority denials. The report is expressly `EPHEMERAL_LOCAL_FIXTURE_NOT_EXTERNAL_AUTHORITY`. It performs no hosted KMS access, nonce DB update, Hub request, live messaging or real owner acceptance.

## Authentic independent verification still needed

- Original pilot-device test artifacts and reviewer attestations must be verified out of band; user-supplied SHA-256 is a **claim**, not a proof of custody.
- Source owner must supply a signed iCamp discovery manifest, a pinned independently authenticated issuer/workload, source KMS custody, and authentic owner-/master-owner TEST approvals for an isolated nonproduction environment. Verify tenant entitlement and source/target receipt digests against independent systems.
- A genuinely signed, replay-protected GET receipt can be witnessed only after independently authorized TEST KMS and a durable per-nonce store are connected to the source route. QL-335 intentionally refuses any current request without them. No production handshake is authorized.
- No real physical-device test, trusted peer enrollment or external signed handshake is represented as completed by Build 202. `main` Production GREEN applies **only** to the software release after protected tests and exact Vercel verification.

## Proof checklist

- `node --test tests/build202-pilot-evidence-and-scoped-witness.test.mjs` — validation, self-approval forgery rejection, tenant and origin boundaries, crypto fixture and immutable database contract.
- `npm run build202:scoped-witness` — fixture-only signed TEST and rejection matrix; protected CI runs the command.
- PostgreSQL migration + `database/verify/0214_build202_pilot_evidence_intake.sql` — RLS, append-only trigger and narrow permission verification.
- Protected GitHub Verify, Browser end-to-end, Database migrations, CodeQL, Gitleaks and Vercel exact-main production readiness.

**Next proposed:** Build 203 — Independent Original-Issuer Custody Reconciliation, Owner TEST Authorization & Nonproduction Handshake Runbook. Requires authentic external records; no fake sign-off or connection switch.
