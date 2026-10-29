# iCamp Build 149 — QL-254 original immutable proof evidence refresh, private registry witness aging & owner TEST-only HOLD

This build implements the supplied Comms Hub **QL-253 six-app proof origin/pin registry/owner TEST-only action sheet** in iCamp. Its public proof, independent private key custody and actual owner identity/decision remain **separate security gates**. Neither ordinary GitHub CI GREEN nor a Vercel production deployment means the six applications are connected.

## Verified original public source evidence

At the supplied QL-253 snapshot (**28 October 2026, 10:43 p.m. Eastern**), iCamp `main` was `4397a1d74a7a058b64cc9a991fd3ccfd42c02d39` and exact path `docs/integration/ql246-source-proof.json` returned actual **HTTP 404**. An independent GitHub fetch at that immutable commit reconfirmed 404 before Build 149. The original tested source **A** is `5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9`, with matching successful [CI run 40794126949](https://github.com/RosevearCreations/iCamp/actions/runs/40794126949). There is **no authentic signed proof commit B**; it cannot be substituted with a sample, self-signed fixture or a green application deployment.

## Public-only retest (no integration / home requests)

The default command is fully offline:

```sh
npm run audit:ql254-public-proof
```

Only explicit `--public-get` enables public GitHub origin checks:

```sh
npm run audit:ql254-public-proof -- --public-get --source-sha-A 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9 --source-ci-run-url https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
```

If a genuine B is later published, add `--proof-commit-sha-B <actual_40_hex_B>` to verify the original signed JSON, its raw bytes, A→B→current-main ancestry, exact A CI and the Ed25519 signature. Even cryptographic validity remains **UNTRUSTED** without separately authenticated private registry and witness custody. A public-fetch network error is reported as unavailable/HOLD, never mistaken for a 404 or original proof.

## QL-254 three-stage append-only owner ledger

1. **Original immutable source-proof refresh:** record an actual full `main` SHA, original source A and exact green CI, and honest 404; or a verified-from-source 200 candidate with distinct B, exact raw digest, public SPKI and source audit ID. No B/pin fields permitted on 404.
2. **Independent private registry/custodian/witness exception aging:** record original *opaque nonsecret* receipt IDs for three separately authenticated roles, registry snapshot SHA-256, public signer SPKI digest and the **digest** of a maximum five-minute nonce challenge. Separate authenticated private registry contents, contact data and signatures remain outside GitHub/database. A provided ID is an **unverified claim**, not trust. The database tracks original proof gap age, private receipt index gaps and overdue follow-up.
3. **Private owner TEST-only decision continuity:** distinguish `NOT_GIVEN`, private `REQUESTED` and an unverified claimed receipt. A requested window must name one nonproduction campground tenant, be future UTC, last at most 30 minutes, use only `GET` with exactly `/api/integration/v1/health` and `/api/integration/v1/capabilities`. **No real request is scheduled or executed** and no claimed receipt unlocks dispatch or pilot.

Migration `0179` enforces the append-only chain, separate reviewers, owner-only forced RLS for both campgrounds, fixed GET-only scope and permanent `DISCONNECTED / HOLD`, `NOT_RUN`, `owner_test_authorized=false`, `dispatch_enabled=false`. Source review roots in a same-tenant Build 148 independent owner HOLD record. No original records are rewritten.

### 24/7 Rosevear AI Hub boundary

The Windows AI Hub may *later* be assessed as an outbound-only private relay or via owner-managed Tailscale routing. This build records only `NOT_CONFIGURED` or `PRIVATE_PLAN_ONLY` and **never installs or starts a daemon**, sets a router/firewall rule, opens a public listener, reads vault/devices/cameras, uses home-network addresses or executes remote commands. A separately authenticated owner decision and host availability, accounts, isolation and rollback review must happen before any implementation.

## Sanitized QL-253/254 Comms Hub return

```yaml
application_name: iCamp
repository: RosevearCreations/iCamp
source_sha_A: 5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9
source_ci_run_url: https://github.com/RosevearCreations/iCamp/actions/runs/40794126949
proof_commit_sha_B: NOT_AVAILABLE
immutable_public_proof_url: HTTP 404
exact_proof_bytes_sha256: NOT_AVAILABLE
public_spki_sha256: NOT_AVAILABLE
out_of_band_registry_snapshot_sha256: NOT_AVAILABLE
out_of_band_registry_receipt_id: NOT_AVAILABLE
out_of_band_custody_receipt_id: NOT_AVAILABLE
distinct_independent_witness_receipt_id: NOT_AVAILABLE
owner_test_decision: NOT_GIVEN
owner_test_receipt_id: NOT_AVAILABLE
real_health_and_capabilities_get_receipts: NOT_RUN
original_seven_negative_denial_receipts: NOT_VERIFIED
connection_state: DISCONNECTED
```

Actual production deployment and post-merge checks must be verified separately. No credentials, private keys or raw private identity/challenge/registry contents are published.

**Next queued:** Build 150 — QL-255 Six-App Original Proof Retrieval Recheck, Private Registry Witness Escalation & Owner-Scoped Relay TEST Readiness HOLD.
