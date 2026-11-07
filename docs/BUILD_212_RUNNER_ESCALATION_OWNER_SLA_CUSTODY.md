# iCamp Build 212 — Runner escalation, signed SLA decisions and evidence custody

## Result and limits

Build 212 adds read-only runner-capacity escalation draft receipts, an original-vs-long-term archive custody decision packet, and a local offline Ed25519 owner-sign/verify command. It extends the **existing** GitHub Actions CI evidence artifact and Step Summary. It adds **no** workflow, CI secret, provider case, auto-signature, new retention permission, automatic rerun, security waiver, or Comms Hub TEST activation.

The last fully verified Build 211 production evidence showed 20 required-job runner observations, zero delayed-queue exceptions, and four accessible original artifacts. The recent sample window still contained only two complete PR cohorts and one complete `main` cohort; it was **not sufficient to accept the monitoring SLA**. Build 212 continues to request three valid complete five-gate cohorts per stage. Diagnostic timing budgets are not protected pass/fail controls.

## 1. Runner-capacity escalation receipt

For each genuinely observed required-job queue delay over the existing 600-second *monitoring* budget, the `build212.runnerEscalation.receipts` array contains a stable incident key, original Actions run/job IDs, GitHub Actions source link, observed runner name/group (or source-unavailable), and measured workflow-created-to-job-start proxy. The receipt initially says `DRAFT_PROVIDER_ESCALATION_NOT_SUBMITTED` with no provider case number, no independent finding and no owner closure. **Overlapping jobs or queue delay alone cannot prove GitHub-hosted runner-pool saturation.** No synthetic escalation is produced when there are zero delayed samples.

Owner follow-through: open the linked original run, check whether the delay recurs, optionally open an independently authenticated GitHub Support case, then record the real case/reference and disposition outside this read-only diagnostic. Until that happens, no provider confirmation is claimed.

## 2. Short-term artifacts and long-term custody

The original four Chromium source artifacts still expire on GitHub's configured retention schedule; their pinned SHA-256 strings are useful fingerprints **but not an independent durable archive**. A fresh `build205-ci-runtime-evidence` artifact created by each workflow is separate evidence, not renewal of an old original. Each original receives:

- Its original availability/expiry, reviewed digest pin, and source identity.
- `independentlyRetainedCopy = false`, `independentCopyDigestVerified = false`, and no owner custody attestation unless separate genuine evidence later exists.
- A custody disposition for available, expiring, expired, or unavailable/conflicted sources.

Owner's next decision is whether an independent, access-controlled, tamper-evident long-term archive is needed, who has custody, and the reviewed retention period. Build 212 **does not** create an archive, change retention, delete evidence, or claim that a snapshot has been notarized.

## 3. Exact owner-signed SLA decision — optional, offline, not automatic

Our owner may sign **only a monitoring-SLA decision** for an **exact, previously downloaded original CI evidence artifact**. The receipt is bound to its `GITHUB_SHA`, a deterministic SHA-256 fingerprint of its Build 211 evidence, seven-day expiry by default, single-use nonce, purpose, and `BOTH` PR/main cohorts. It cannot approve a production release, relax any of the five required checks, or authorize a Comms Hub TEST.

### Before using it

1. Download the actual `build205-ci-runtime-evidence` ZIP from the GitHub Actions `CI / Verify` run, extract `build205-ci-runtime.json` to a **private directory outside the repository**, and review the original run links and signed custody state.
2. Obtain an **owner-controlled Ed25519 private key** from our independently managed secure custody. Keep it outside Git, cloud logs and CI. If no appropriate original signer/pin exists, enrollment and independent public-key verification must be completed **before** a receipt can be trusted; do not invent that identity.
3. Make a separate outside-repo `owner-pins.json` with the exact pinned public key (not the private key), reviewed fingerprint, unique key ID and role `ICAMP_SLA_OWNER`. The verifier requires the full structure:

```json
{
  "schema": "icamp.build212.sla-owner-pins.v1",
  "signers": [
    {
      "keyId": "our-reviewed-owner-key",
      "role": "ICAMP_SLA_OWNER",
      "enabled": true,
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n<actual independently verified key>\n-----END PUBLIC KEY-----\n",
      "fingerprint": "sha256:<actual SHA-256 of the SPKI DER public key>"
    }
  ]
}
```

**Never use the placeholders as real keys.** A self-created file alone is not independent owner authentication; confirm the key and its fingerprint through the real approved owner process.

### Offline commands (PowerShell or terminal, from the iCamp checkout)

First prepare an **unsigned** defer decision from actual evidence. Paths and key ID are examples; use our own separate private directory:

```powershell
node scripts/build212-owner-sla-receipt.mjs prepare "C:\private-icamp\build205-ci-runtime.json" DEFER_MONITORING_SLA our-reviewed-owner-key "Awaiting enough complete PR/main cohorts" "C:\private-icamp\sla-request.json"
```

The tool refuses `ACCEPT_MONITORING_SLA` until both stages have at least **three complete successful five-check cohorts**, are within the monitoring budget, and the evidence state is reviewable. `REJECT_MONITORING_SLA` and `DEFER_MONITORING_SLA` remain signable without accepting the SLA.

Once the owner has **personally reviewed the exact evidence and chosen the decision**, sign locally with their separately stored private key:

```powershell
node scripts/build212-owner-sla-receipt.mjs sign "C:\private-icamp\sla-request.json" "C:\private-icamp\build205-ci-runtime.json" "C:\secure-offline\icamp-sla-owner-private.pem" "C:\private-icamp\sla-signed-receipt.json" --confirm-owner-review
```

The script **never prints or uploads private key bytes**, and refuses a private-key location within the repository. It creates the receipt only if the requested output filename does not already exist.

Independently verify the receipt against the **reviewed** owner pins and **same** original evidence:

```powershell
node scripts/build212-owner-sla-receipt.mjs verify "C:\private-icamp\sla-signed-receipt.json" "C:\private-icamp\build205-ci-runtime.json" "C:\private-icamp\owner-pins.json"
```

The verifier checks the Ed25519 signature, exact pinned key fingerprint, role, time window, nonce (within the active verification session), payload scope, and exact evidence fingerprint. Signed deferral is **not** acceptance. Durable cross-session nonce replay protection and independent owner pin custody remain separate owner-operated responsibilities; the offline verifier does not claim that they are installed.

## 4. Protected CI and evidence navigation

- Workflow: [GitHub Actions](https://github.com/RosevearCreations/iCamp/actions) → a completed CI run → `build205-ci-runtime-evidence` artifact. Its JSON now includes `build212` with runner escalation, external custody review and `AWAITING_INDEPENDENT_OWNER_SIGNED_RECEIPT`.
- Contracts: `npm run build212:ci-contract` and `node --test tests/build212-escalation-owner-custody.test.mjs`.
- Five unchanged protected gates: `CI / Verify`, `CI / Browser end-to-end`, `CI / Database migrations`, `Secret Scan / Gitleaks`, `CodeQL / Analyze JavaScript and TypeScript`.
- [GitHub Actions artifact retention documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

## Proposed Build 213

**iCamp 213 — Complete Five-Gate Cohort Accrual, Independent Archive Custody Verification & Signed SLA Decision Reconciliation.** Accumulate enough real completed cohorts, validate any independently stored original evidence and owner-provided receipt, and reconcile decisions without weakening protected release checks.
