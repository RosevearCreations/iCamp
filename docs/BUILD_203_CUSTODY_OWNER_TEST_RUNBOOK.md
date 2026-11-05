# Build 203 — Original-Issuer Custody Reconciliation, Owner TEST Intent & Nonproduction Handshake Runbook

**Purpose:** Camp Rosevear pilot staff/owner can compare original evidence and second-source claims and record a narrow owner TEST request/withdrawal. These are database-backed decisions, **not** independent authentication or a live Comms Hub enrollment.

## Independent baseline

- Build 202 source evidence intake creates `SUBMITTED_UNVERIFIED` records, not original-issuer attestation. An independently authenticated original issuer, authentic master-owner TEST consent, Hub peer enrollment, durable nonce witness and source-owned KMS have **not** been established by code deployment.
- Comms Hub registry readback remains `DISCONNECTED / HOLD`; no real signed GET connection, payment, messaging, phone call or physical gate operation is within this release.
- Two self-entered matching SHA-256 claims do not constitute issuer validation. Only an independently authenticated source (original callback/out-of-band pinned signature + custodian) can resolve this.

## Owner/I.T. workflow

1. At `/pilot/acceptance`, choose an assigned campground. Build 202's private ledger lists original reference claims. **Do not upload credentials, guest identities, screenshots or raw personal data.**
2. In the Build 203 review desk, a different I.T./owner reviewer selects the original `evidence_id`, enters a bounded independently sourced reference and its **claimed** SHA-256. The database enforces that the reviewer cannot be the original submitter. It also enforces both rows belong to the same campground and organization.
3. A claimed digest match appears only as `CLAIMS_MATCH_NOT_VERIFIED`; a mismatch appears as `CLAIM_CONFLICT_REQUIRES_INDEPENDENT_RESOLUTION`. Neither becomes a verified signer, peer or approval. Custody entries are private and immutable.
4. A campground owner (new `pilot.test.authorize` permission, not an I.T.-only user) can explicitly record a one-hour `REQUEST_ISOLATED_TEST` decision against a reviewed pair, with acknowledgement that the request excludes production, outbound communications and live gate actions. Its recorded state is `LOCAL_OWNER_INTENT_ONLY`, never independent master-owner authorization. The owner can append a withdrawal event; no record is edited or deleted. TEST intent expires within 24 hours and does not activate the connection.
5. Owners and I.T. can refresh the private readback and inspect the six-step nonproduction runbook. The service never calls Comms Hub or KMS; all external steps require separate independent proof before a real signed TEST GET could be attempted.

## Technical controls

- `0215_build203_custody_owner_test.sql` adds private append-only `pilot203_custody_reviews` and `pilot203_owner_test_actions`. Both use forced RLS, per-campground permission checks, actor-bound session, foreign keys across `(organization_id,campground_id)`, immutable triggers, and no public Data API grants. Only `owner_admin` gains `pilot.test.authorize`; owner/I.T. may reconcile custody.
- `GET/POST /api/it/pilot-custody` uses authenticated role checks, same-origin/JSON/4 KiB validation, strict field allowlists, `private, no-store`, and conflict handling. Owner events include unique request IDs for replay-safe retry detection.
- `npm run build203:runbook` emits the fixed six-step manual instruction set and proves `authorizeHandshake=false`, `externalAuthorityVerified=false`, `connection_state=DISCONNECTED / HOLD`. Protected CI executes it.

## Manual, separately authorized future TEST witness (not executed by Build 203)

1. Independently verify issuer identity from original source and signed manifest, then obtain original issuer custody digest from the independent channel.
2. Resolve all conflicts; independently prove consent of the campground owner and master owner for a time-bound isolated TEST run.
3. Verify TEST environment isolation, tenant entitlement and both source/HUB workload identities. Establish source-owned KMS and atomic durable nonce/replay storage.
4. Only after all gates pass, authorize one signed health/capability GET with a new challenge in nonproduction; verify both original receipts, failure denials, cleanup and rollback.
5. Revoke the temporary TEST authority and have the owner independently review the outcome. Do not promote to real phone/SMS, payments, gate control, or production traffic without separate authorization.

**Proof:** New 6 Node contract tests + Playwright anonymous gates; SQL migration contract verifier 0215; existing 1,150+ tests, lint, typecheck, build, signed TEST fixture, branch-protected checks and exact production SHA. No real independent source or owner custody receipt is fabricated for this build.

**Next proposed (priority): Build 204 — Protected CI Workflow Consolidation, Deduplicated PR/Main Gates & Evidence-Preserving Release Cadence.** Remove duplicate runs while retaining every required check, independent trust, and immutable production evidence.
