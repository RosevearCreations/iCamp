# iCamp Build 145 — QL-248 two-SHA provenance, seven-denial source receipt gap aging and independent authorization HOLD renewal

Status: **iCamp application release deployable; external six-app gateway DISCONNECTED / HOLD**.
This build does not publish or claim a QL-246 signed proof, test permission,
independently observed original denial receipts, live connection or Phase C pilot.

## Three independent, append-only review stages

The owner-only Build 145 queue starts from a completed Build 144 reversible HOLD
review, not an unrelated source or campground. It sequences:

1. **Two-SHA public proof provenance recheck.** Record *absent* proof or an
   actually retrieved, nonsecret public proof index. When supplied together,
   the earlier tested `source_revision` code SHA, distinct later
   `proofCommitSha`, precise raw JSON `proofSha256`, and original source-commit
   GitHub Actions CI URL must match the six-app repository mapping. An
   independently obtained Ed25519 SPKI SHA-256 pin requires its *own* evidence
   index; an AI Data Platform consumer agreement index remains unverified.
   This metadata does not prove ancestor relationship, valid signature, true
   source CI status, out-of-band pin authenticity or genuine gateway tests.
2. **Seven-denial source receipt gap aging.** Accept zero through seven distinct
   nonsecret original receipt IDs for nonce replay, stale request, cross
   business, cross tenant, revoked key, attempted write, and dispatch denial.
   The database records `observed_denial_gap_count = 7 - provided IDs` and
   `observed_gap_age_days` since the Build 144 root HOLD decision. Even seven
   IDs plus a purported witness index remain **UNVERIFIED** until an independent
   original source-of-truth gateway audit is actually inspected after restart.
3. **Independent authorization HOLD renewal.** Record only missing or
   unverified nonsecret owner Phase B references and genuine rollback/key
   revocation indexes. Renew the reversible HOLD and schedule the next
   independent review within 90 days. No approval is created here.

The database enforces distinct reviewers for consecutive stages, prohibits the
Build 144 author from self-reviewing, serializes same-pair inserts with an
advisory lock, and observes open/overdue Build 144 leaf exceptions. All stages
are immutable, with forced RLS, dual-campground finance-owner isolation,
app-role SELECT/INSERT only, no public/Auth/service-role grants and no updates
or deletes.

## Exact source/proof separation

| Field | Required meaning |
| --- | --- |
| `source_revision_sha` | Earlier audited and tested code SHA |
| `proof_commit_sha` | Later immutable commit that actually contains `docs/integration/ql246-source-proof.json` |
| `proof_sha256` | Hash of exact raw public JSON bytes in that later commit |
| `source_ci_run_url` | Original green Actions run for the **earlier** source SHA |
| `signer_pin_sha256` | Ed25519 public SPKI fingerprint obtained independently, never trusted merely from proof contents |
| `consumer_agreement_reference` | Documentary AI consumer amendment index, not acceptance |

Do not produce a self-referential signed Git SHA, fabricate proofs/negative
receipts, store signing keys, or treat a placeholder `np-` index as evidence.

## Immutable fail-closed release gates

```text
public_source_origin_verified       = false
independent_signer_pin_verified     = false
seven_denials_independently_witnessed = false
original_gateway_receipts_verified = false
phase_b_test_authorized             = false
owner_pilot_authorized              = false
dispatch_enabled                   = false
connection_state                   = DISCONNECTED
gate_state                         = HOLD
```

**No independently verified QL-248 proof or owner authorization exists merely
because Build 145 application CI is GREEN.** No real gateway GET, live customer
records, booking write, finance/payment, telephony, dispatch, gate control,
credential provisioning, database export or automatic message can be enabled.

## iCamp QL-248 truthful source return

```text
Application: iCamp / RosevearCreations/iCamp
Earlier source SHA and CI: current release code SHA/Actions CI only; no signed QL-246 binding
Later proof-bearing SHA and raw JSON digest: MISSING
Independent signer SPKI pin: NOT VERIFIED
AI consumer two-SHA amendment: NOT VERIFIED
Original seven denial source receipts: MISSING / UNVERIFIED
Independent gateway audit and restart persistence: PENDING
Owner Phase B test permission: NOT GIVEN
Owner Phase C pilot permission: NOT GIVEN
External gateway: DISCONNECTED / HOLD
```

Before any actual Phase B exercise: obtain separate, explicit real-owner
nonproduction authorization, accepted AI consumer amendment, genuine signed
one-hour proof with two distinct public Git SHAs and original CI identity,
fresh operator challenge, independently pinned signer, server-only secrets,
two authorized read-only health/capabilities GETs, seven separately witnessed
negative tests and durable post-restart audit, plus revocation/rollback proof.
Then re-evaluate; do **not** infer Phase C authorization.

Migration: `0175_ql248_provenance_denial_gap_authorization_hold.sql` with
matching verification SQL. No external source receipt IDs or approvals were
inserted by this build.

Next expected iCamp build: **Build 146 — QL-248 Original Source Receipt Escalation Follow-Up and Independent HOLD Exception Reassessment**.
