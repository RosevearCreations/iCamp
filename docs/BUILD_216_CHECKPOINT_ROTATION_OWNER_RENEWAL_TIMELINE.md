# iCamp Build 216 — Checkpoint rotation, owner renewal decision workbench and source-linked expiry timeline

Build 216 extends the private Build 214/215 evidence chain. It **does not** activate a Comms Hub connection, billing, dispatch, physical archive renewal or production permission. No independent signer or owner decision is invented in CI.

## What changed

1. **Head checkpoint rotation:** verifies every previously signed Build 215 Ed25519 anchor against the same ledger prefix, then appends an ordered, hash-linked rotation record. Stale prefixes and expired latest checkpoints are surfaced; descending sequence, reuse of an anchor nonce, missing signatures, tampering, and missing pinned chain tails are rejected. The full private rotation history remains outside Git.
2. **Owner renewal decision workbench:** creates a scoped, expiring, unsigned request for one exact ledger record. Choices are `REQUEST_EVIDENCE_RENEWAL`, `DEFER_RENEWAL_REVIEW`, `REJECT_RENEWAL`, and `ESCALATE_SOURCE_CONFLICT`. The independently enrolled owner must sign with their actual Ed25519 key; verification binds the signature to the target entry hash and current ledger head. None of the choices silently modifies earlier records.
3. **Source-linked expiry timeline:** compares Build 214 private registration identities/digests with the reviewed Build 211 original artifact snapshot in a downloaded `build205-ci-runtime.json`, then sorts GitHub original artifact expiry, private custodian attestations, owner SLA receipts and signed anchor checkpoints by deadline. It marks mismatches as conflicts and never describes a downloaded snapshot as a fresh authenticated API readback.
4. **CI safety:** adds one contract step to the existing Verify job and a no-private-evidence diagnostic marker to the existing Build 205 artifact. The five required protected checks, original workflows, provider holds and failure behavior are unchanged.

## Windows operator instructions

Use a restricted private directory outside the iCamp source checkout, e.g. `C:\private-icamp-evidence`. Only real owners and independent reviewers should handle signed records or keys. Confirm source identities from original GitHub Actions run/job/artifact records before trusting any downloaded JSON.

### A. Rotate a genuinely signed head checkpoint

Complete the [Build 215 independent reviewer ceremony](BUILD_215_INDEPENDENT_ANCHORS_CUSTODY_SLA.md) to create the actual `anchor-claims.json`, `anchor-attestation.json` and separately reviewed `reviewer-pins.json`.

From the latest iCamp checkout:

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs rotate "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\rotation-history.jsonl" "C:\private-icamp-evidence\anchor-claims.json" "C:\private-icamp-evidence\anchor-attestation.json" "C:\private-icamp-evidence\reviewer-pins.json" "GENESIS" --confirm-independent-review
```

Use `GENESIS` **only on the first rotation** when no history exists. On later rotations, replace it with the **previously independently recorded** `tailHash`; a missing or mismatched prior head is rejected. The command validates the entire existing history before appending and returns a new `tailHash`. Record that hash **separately** in an independent owner/custodian archive. To read back and compare the pinned tail:

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs verify-rotations "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\rotation-history.jsonl" "C:\private-icamp-evidence\reviewer-pins.json" "sha256:PREVIOUSLY_INDEPENDENTLY_SAVED_TAIL_HASH"
```

An anchor can certify a historical prefix even when a newer ledger entry exists. A fresh signed checkpoint is needed for that new head. The chain hash alone does not prove off-site immutability or human independence; the recorded tail must be preserved independently. Reviewer public-key pins must be verified through a separate trusted channel.

### B. Prepare, sign and verify an owner renewal choice

Choose the exact ledger record sequence to review (example: `1`). This does **not** approve automatically retrieving or renewing the original evidence:

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs prepare-renewal "C:\private-icamp-evidence\registry.jsonl" 1 DEFER_RENEWAL_REVIEW owner-renewal-key-id "C:\private-icamp-evidence\renewal-request.json"
```

The authorized owner reviews the exact requested choice, source hash, original expiry, private record and applicable trust policy. Using their actual separately held Ed25519 key outside the checkout:

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs sign-renewal "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\renewal-request.json" "C:\private-icamp-evidence\owner-renewal-private.pem" "C:\private-icamp-evidence\renewal-signed-receipt.json" --confirm-owner-review
```

The independently enrolled `owner-renewal-pins.json` must have schema `icamp.build216.owner-renewal-pins.v1` and one enabled signer containing their verified `keyId`, `role: ICAMP_CUSTODY_RENEWAL_OWNER`, `publicKeyPem`, and independently authenticated Ed25519 SPKI `fingerprint`.

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs verify-renewal "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\renewal-signed-receipt.json" "C:\private-icamp-evidence\owner-renewal-pins.json"
```

Verification confirms cryptographic consistency with the pinned public key, not the owner's real-world identity. If the ledger head changed since the request was prepared, start a new owner review. Keep signed decisions outside Git and treat replay checks as per verification session, not a shared database ledger.

### C. Produce the expiry timeline

Download the original `build205-ci-runtime-evidence` artifact from the relevant completed [iCamp GitHub Actions](https://github.com/RosevearCreations/iCamp/actions) run, and confirm its source commit, job/artifact IDs and fingerprint separately. Then:

```powershell
node scripts/build216-checkpoint-renewal-timeline.mjs timeline "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\rotation-history.jsonl" "C:\private-icamp-evidence\reviewer-pins.json"
```

Without a signed rotation history, omit the last two paths. Review `SOURCE_IDENTITY_CONFLICT_QUARANTINED`, expiring original artifacts (seven days), custody/owner receipt renewals (14 days) and expiring anchor checkpoints (seven days). The timeline is evidence-linked **monitoring**: it does not make a new GitHub API call, renew a ZIP, sign a receipt, assert durable storage or turn a Comms Hub TEST hold into an active connection.

## Verification and release

- `npm run build216:ci-contract`
- `node --test tests/build216-checkpoint-renewal-timeline.test.mjs`
- `npm run verify` and `npm audit --omit=dev --audit-level=high`
- Five existing PR/main release gates, then exact live Vercel production SHA and `/api/health` readback.

No new database migration, paid provider, external connection or scheduled workflow is created by Build 216. Actual independent original artifact readback, separate owner decisions and long-term custody remain owner-controlled external procedures.

## Next proposed build — 217

**iCamp 217 — Cross-Custodian Anchor Diversity Review, Owner Renewal Outcome Reconciliation & Evidence Retention SLA Dashboard.** Add explicit custodian governance comparisons, independently reviewed outcome reconciliation and accessible operational summaries while retaining every trust HOLD.
