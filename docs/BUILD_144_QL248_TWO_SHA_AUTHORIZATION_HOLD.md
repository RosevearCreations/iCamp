# iCamp Build 144 — QL-247 nonproduction authorization and denial-receipt HOLD audit

Status at release: **application code deployable; external gateway DISCONNECTED / HOLD**.
No Phase B authorization, Ed25519 source proof, seven independently witnessed denial
receipts, credential issuance, authenticated health/capabilities GET or Phase C pilot
permission is asserted by this release.

## QL-248 two-SHA clarification received

The six-app Comms Hub QL-248 handoff clarifies a circular Git reference:

| Public reference | Required provenance | Build 144 handling |
| --- | --- | --- |
| `source_revision` | Earlier tested **code** commit and its exact green CI run | Optional unverified evidence field in authorization intake |
| `proofCommitSha` | **Later** GitHub commit containing the signed `docs/integration/ql246-source-proof.json` | Distinct 40-hex field, never copied into the signed JSON payload |
| `proofSha256` | SHA-256 of the precise raw proof bytes at the later commit | Optional paired digest, not a signed-proof verification claim |
| `publicKeySpkiSha256` | Independently authenticated Ed25519 public signer fingerprint | Previous QL-246 pin review; not borrowed from the proof itself |
| `ciRunUrl` | GitHub Actions run for the **earlier source revision** | URL must match exact source repository |

The clarification is **proposed and not accepted on behalf of the AI Data Platform
consumer**. A documentary agreement-reference field remains `NOT_AGREED` or
`REFERENCE_UNVERIFIED`, never automatically accepted. The app must not attempt a
Git commit self-reference loop or manufacture proof commits. A proof can only be
signed after actual Phase B tests and a fresh challenge, and must expire within an
hour. Never store a signing key or challenge nonce in this audit.

## Build 144 stages

1. **Nonproduction test authorization evidence intake:** record absent or
   nonsecret *unverified* owner approval reference. If public source proof has
   actually been retrieved, independently record distinct source/proof SHAs,
   source CI and raw digest. This is **not** a workflow to issue owner approval.
2. **Independent seven-denial receipt reconciliation:** index original nonsecret
   IDs for replay, stale request, wrong business, wrong tenant, revoked key,
   prohibited write and dispatch denials. Named receipt IDs and a separate
   independent witness index still count as **UNVERIFIED** until originals are
   checked against the gateway source-of-truth audit. Missing evidence is valid.
3. **Reversible HOLD decision watch:** log nonsecret rollback/key revocation
   references, database-observed open/overdue Build 143 exceptions, independent
   review, next 90-day due date. A separate reviewer is mandatory and records
   are immutable.

Owner-only, dual-campground finance-authorized RLS is **forced**. There are no
grants to `anon`, `authenticated` or `service_role`; there is no UPDATE/DELETE
capability for the application role. The database makes it impossible for this
documentary ledger to change these Booleans to true:

```text
phase_b_test_authorized            = false
seven_denials_independently_witnessed = false
source_proof_signature_verified    = false
two_sha_origin_verified            = false
original_gateway_receipts_verified = false
scoped_key_revocation_verified     = false
owner_pilot_authorized             = false
dispatch_enabled                   = false
connection_state                   = DISCONNECTED
gate_state                         = HOLD
```

## iCamp truthful QL-248 return

```text
Application / GitHub repo: iCamp / RosevearCreations/iCamp
Current source revision / source CI URL: see GitHub main release and CI
Separate proof-bearing SHA / raw public QL-246 JSON digest: MISSING
Public Ed25519 signer pin authenticated independently: NOT VERIFIED
QL-248 two-SHA source amendment documented: YES (proposed)
AI Data Platform QL-246 consumer amendment accepted: NOT VERIFIED
Seven genuinely witnessed gateway denials / original receipt IDs: PENDING
Durable gateway audit / HMAC key rotation / revocation / rollback: PENDING
Authentication for separately approved nonproduction GETs: NOT PROVISIONED
Owner approval for nonproduction test: NOT GIVEN
Owner Phase C narrow read-only pilot: NOT GIVEN
Actual gateway connection: DISCONNECTED / HOLD
```

### Required external steps before testing

- Independently authenticate the owner, test tenant, exact endpoint scope,
  short expiration, independent reviewer and rollback plan out of band.
- Obtain scoped *server-only* secrets for authorized nonproduction GETs from
  each app's own approved secret manager and independently pinned signer keys.
- Actually witness two read-only endpoint GETs and the seven negative denials;
  independently retrieve post-restart gateway audit, verify identity, rotation,
  revocation, and proof of rollback. No booking, gate, marketplace, payment,
  payroll, dispatch, telephony, device or vault writes.
- Only afterward obtain a new QL-246 challenge, sign the genuine proof and
  pin the **later** proof commit SHA and exact raw SHA-256 separately.
- Have the receiving AI Data Platform explicitly agree to the two-SHA
  amendment. Only separately and subsequently consider a limited owner-approved
  read-only pilot. **No approval is granted here.**

Next expected iCamp build: **Build 145 — QL-248 Two-SHA Public Proof Provenance Recheck, Seven-Denial Source Receipt Gap Aging & Independent Authorization HOLD Renewal.**
