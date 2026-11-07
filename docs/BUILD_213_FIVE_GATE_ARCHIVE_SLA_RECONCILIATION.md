# iCamp Build 213 — Five-gate cohort accrual, independent archive custody and owner SLA reconciliation

## What this build actually proves

Build 213 expands the existing **read-only** GitHub Actions sample from 12 to at most 30 recently completed workflow runs. It groups the **five unchanged required checks** by the same pull-request or main commit, and reports whether at least **three complete cohorts for each stage** are visible. It excludes incomplete, unsuccessful or conflicting records. Historical coverage alone **does not** sign an SLA decision, approve a release, establish independent storage or authorize a Comms Hub TEST handshake.

It adds two **offline verifiers**, never invoked by CI with private credentials:

1. **Archive custody:** compare the exact externally held original archive bytes with a pinned original artifact SHA-256 digest and independently reviewed source run/job/artifact IDs; verify a separate custodian's Ed25519 signature against an independently pinned public key.
2. **Owner SLA decision:** verify a separately signed Build 212 owner receipt for the **exact original Build 213-containing CI evidence**. An `ACCEPT_MONITORING_SLA` decision is valid only if the Build 211 monitoring rules **and** Build 213's three-PR/three-main complete five-gate cohort requirement are met. Deferrals/rejections do not grant acceptance.

The CI-generated `build213` record deliberately reports `NO_EXTERNAL_ARCHIVE_BYTES_OR_INDEPENDENT_CUSTODIAN_ATTESTATION_IN_CI` and `NO_EXTERNALLY_SIGNED_OWNER_RECEIPT_ENROLLED_IN_CI`. It will **not** turn those fields green merely because tests pass, an artifact exists on GitHub, or a test key was used locally.

## 1. Review actual cohort evidence

1. Open [iCamp Actions](https://github.com/RosevearCreations/iCamp/actions), select the latest completed **CI / Verify** run and download `build205-ci-runtime-evidence`.
2. Open `build205-ci-runtime.json` from the downloaded ZIP. Inspect `build213.cohortAccrual.stages.PR` and `.MAIN`, including `fullyProtectedCohorts`, `needAdditionalCohorts`, incomplete items and the original run IDs. The source is the latest **up to 30 completed CI/Secret Scan/CodeQL workflow runs**, not a guaranteed six-release historical dataset.
3. Verify the original commits and all five checks in the linked [GitHub Actions](https://github.com/RosevearCreations/iCamp/actions) runs. If either stage is short, continue accumulating real releases; never insert fictional cohorts or loosen checks.
4. Distinguish workflow-gate latency from deployment latency: the former **does not include Vercel production readiness**. A successful PR check or an SLA acceptance is **not** itself proof of `main` Production = GREEN.

The five protected checks are `CI / Verify`, `CI / Browser end-to-end`, `CI / Database migrations`, `Secret Scan / Gitleaks`, and `CodeQL / Analyze JavaScript and TypeScript`. Build 213 does not add GitHub workflow files or modify those job names.

## 2. Verify a genuinely external original archive

First independently copy an **original** artifact ZIP from the original GitHub Actions run to a restricted, independently governed vault or offline archive; do not confuse a newly generated Build 213 CI evidence ZIP with an independently retained original. Compare the downloaded bytes with the pinned original source digest in `fixtures/build210-reviewed-chromium-history.json`. This fixture is reviewed historical identity, **not** proof a copy was retained.

An independently authorized archive custodian must separately review the original run/artifact identity, physically stored copy, expiry, intended custodian and storage location, then sign a canonical JSON payload. The offline verifier accepts:

- The original external ZIP bytes (at most 50 MiB).
- A `claims.json` document with schema `icamp.build213.archive-custody-claims.v1`, `repository: RosevearCreations/iCamp`, original `sourceArtifactId`, `sourceRunId`, `sourceJobId`, `sourceHeadSha`, original `sourceDigest`, `copiedArchiveDigest`, `storageReference` of the form `offline://...` or `vault://...`, `custodianKeyId`, ISO UTC `signedAt` and `expiresAt`.
- `attestation.json` with `signatureBase64`: the **actual** custodian's Ed25519 signature of the UTF-8 canonical JSON representation of `{ "schema": "icamp.build213.archive-custody-attestation.v1", "claims": claims }`. Canonicalization is defined by `canonicalJson` in `scripts/build212-owner-sla-receipt.mjs`.
- `custodian-pins.json` with schema `icamp.build213.archive-custodian-pins.v1` and `signers` entries containing `keyId`, `role: ICAMP_CI_ARCHIVE_CUSTODIAN`, `enabled: true`, reviewed `publicKeyPem` and independently confirmed `fingerprint` (`sha256:` of the SPKI DER public key).

Keep all archive copies, the genuine custodian's private key, signature material and decision records **outside the repo and CI**, and authenticate the original public key separately. Never use a test key, placeholder or merely self-asserted signature as independent authority.

Example PowerShell command, run from the iCamp checkout after real evidence and authority exist:

```powershell
node scripts/build213-cohort-custody-reconciliation.mjs verify-archive "C:\private-icamp\original-external.zip" "C:\private-icamp\claims.json" "C:\private-icamp\attestation.json" "C:\private-icamp\custodian-pins.json"
```

An affirmative offline verifier result proves **byte equality, source identity and a pinned cryptographic attestation**. It expressly sets `immutableStorageVerified = false`, `longTermRetentionPolicyVerified = false` and `ownerRetentionDecisionGranted = false` until independently documented. If a previously pinned original digest differs, **stop** and investigate; do not replace the original pin to make the verification succeed.

## 3. Reconcile the real owner-signed SLA receipt

Use Build 212's documented [owner signing ceremony](BUILD_212_RUNNER_ESCALATION_OWNER_SLA_CUSTODY.md) on an **exactly downloaded Build 213 evidence JSON**. The signer chooses `ACCEPT_MONITORING_SLA`, `DEFER_MONITORING_SLA`, or `REJECT_MONITORING_SLA`, reviews it personally, and signs with their actual independently enrolled **owner-controlled** Ed25519 key outside the repository. The Build 212 prepare command already refuses acceptance when its monitoring prerequisites are missing.

After independent public-pin enrollment, run:

```powershell
node scripts/build213-cohort-custody-reconciliation.mjs verify-owner "C:\private-icamp\build205-ci-runtime.json" "C:\private-icamp\sla-signed-receipt.json" "C:\private-icamp\owner-pins.json"
```

The tool checks key role and pin, signature, scope, evidence fingerprint, expiry and exact Build 213 cohort state. It cannot establish cross-session replay safety or prove the human signer independently from a locally created pins file. It **never** grants production or TEST authority. Record actual reviewed owner decisions separately within our approved change-control process; no owner-signed acceptance is invented in the workflow.

## 4. Verification and release

- `npm run build213:ci-contract`: confirms all five existing jobs, no additional workflow, bounded 30-run review and fail-closed trust states.
- `node --test tests/build213-cohorts-archive-owner.test.mjs`: synthetic tests only; keys and ZIP contents used here have **no real custody authority**.
- `npm run verify` and `npm audit --omit=dev --audit-level=high`: regression and dependency reviews.
- Actual protected GitHub PR and main checks, commit SHA and live [iCamp production](https://i-camp-pi.vercel.app/api/version) must be checked separately to claim **Production = GREEN**.

Original artifact expiry is controlled by GitHub's configured retention, not by our test or signature. See [GitHub's artifact retention documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts). Provider mirror/runner-capacity attribution from prior builds remains provisional until genuine independent provider evidence exists.

## Proposed Build 214

**iCamp 214 — Owner-Supervised SLA Signature Ceremony, Verified External Archive Registration & CI Evidence Aging Automation.** Provide a guided operator handoff to independently register real archival custody and signed monitoring decisions, with expiry alerts and immutable source references, preserving all five protected release gates.
