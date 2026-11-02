# iCamp Build 148 — QL-253 immutable publication retest, custody-pin challenge renewal & owner TEST-only HOLD reconciliation

The QL-252 handoff was supplied again for QL-253. Its requirement is **genuine** public source proof and two distinct independent *private* attestations, never a simulated approval. Build 148 adds the QL-253 three-stage owner-only, append-only review chain and a public GitHub-only immutable retest. It cannot generate or privately authenticate the original Ed25519 proof, custodian nonce, witness, owner identity, or seven original gateway denial receipts. Production application release is independent from the six-app integration gate.

## Independently retrieved public source proof at start of build

The inspected iCamp `main` commit was `92316c576f8031ffb4889565f0421a5bd6aa138b`, with the required public path `docs/integration/ql246-source-proof.json` returning **HTTP 404**. This file is intentionally **not** replaced with a sample signature. The previously GREEN original source commit **A** remains `5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9`, original CI run `https://github.com/RosevearCreations/iCamp/actions/runs/40794126949`. At audit time **B was not published**, so the B SHA, immutable B URL, raw proof SHA-256, public signer SPKI SHA-256, authenticated custody and distinct witness receipts remain `NOT_AVAILABLE`.

The separate owner TEST-only decision is `NOT_GIVEN`, `actual_gateway_test=NOT_RUN` and `connection_state=DISCONNECTED`. No private gateway requests are scheduled or performed. `main` release/CI GREEN does not mean connected.

## Live-source retry (public GitHub only)

By default, this command makes **zero** network calls:

```sh
npm run audit:ql253-public-proof
```

To independently check immutable GitHub `main`, original source A CI and the signed proof only when it really exists:

```sh
npm run audit:ql253-public-proof -- --public-get --source-sha-A 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9 --source-ci-run-url https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
```

If a genuine signed proof is later committed as distinct descendant **B**, append `--proof-commit-sha-B <actual_full_B_SHA>`. The validator checks original A CI `head_sha`, canonical Ed25519 bytes, short-lived challenge, immutable B raw-byte SHA-256, public key SPKI pin and GitHub A→B→current-main ancestry. The returned cryptographic result is only a **candidate** until real out-of-band signer/witness trust is separately verified. Never infer private receipts from public metadata.

## Operator three-stage HOLD review

1. **Immutable public retest** — 404 with A/CI only; real 200 with distinct A/B, original CI, raw digest, public SPKI and source audit index; or an independently indexed mismatch. No B/digest on 404.
2. **Independent five-minute custody-pin challenge** — safely record *nonsecret* opaque custody/witness receipt IDs and the nonce digest, issued/expiry UTC and public SPKI pin **only if genuine originals exist**. Require distinct witness and custodian, challenge lifespan at most five minutes. These entries remain UNVERIFIED; no private keys, raw nonce, identities or private attestation content is stored.
3. **Separate owner TEST-only HOLD** — distinguish `NOT_GIVEN`, `REQUESTED_PRIVATE_REVIEW`, and an **unverified** approval-claim reference. Claim/request scope requires a nonproduction campground ID, future UTC window of at most 30 minutes, `GET` and exactly `/api/integration/v1/health` and `/api/integration/v1/capabilities`. The UI and SQL always enforce HOLD, no gateway GET, no pilot release and no dispatch.

The new `0178` PostgreSQL table roots each first QL-253 review in an existing same-campground Build 147 independent owner HOLD stage, checks reviewer separation, chains proof→custody→owner→retest, derives aging/overdue counters, applies forced RLS for both campground owners and prevents UPDATE/DELETE. No original source records are mutated. The SQL verification contract confirms role grants, forced RLS, append-only triggers and all six false release gates.

## Genuine handoff fields only

```yaml
application_name: iCamp
repository: RosevearCreations/iCamp
source_sha_A: 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9
source_ci_run_url: https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
proof_commit_sha_B: NOT_AVAILABLE
immutable_public_proof_url: NOT_AVAILABLE
exact_proof_bytes_sha256: NOT_AVAILABLE
public_spki_sha256: NOT_AVAILABLE
out_of_band_custody_receipt_id: NOT_AVAILABLE
distinct_witness_receipt_id: NOT_AVAILABLE
owner_test_decision: NOT_GIVEN
owner_test_receipt_id: NOT_AVAILABLE
actual_gateway_test: NOT_RUN
connection_state: DISCONNECTED
```

**Next queued:** Build 149 — QL-254 Original Immutable Proof Evidence Refresh, Custody/Witness Exception Aging & Private Owner TEST Decision Continuity (HELD).
