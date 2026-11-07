# iCamp Build 219 — independent runner, redacted manifest and retention exception closure review

Build 219 extends the Build 218 field workbench with **two independently enrolled Ed25519 signer roles** and a fail-closed offline **retention exception closure review**. The release does not provision an owner, create independent human witnesses, read original archive ZIP bytes, waive an SLA or connect Comms Hub. The five protected CI checks remain unchanged.

## Trust boundaries

1. **Owner-authorized read-only runner:** the existing Build 218 schedule and local recheck observation must match exactly. The operator prepares a time-limited signing request bound to the task, artifact, schedule digest and observation digest. An independently enrolled `ICAMP_INDEPENDENT_READONLY_RUNNER` key signs the request; verification checks the signature, public-key pin, expiry and nonce. This attests that a pinned operator signed **the local readback record**. It does not independently prove that GitHub supplied authentic metadata, that the signer is a genuine external person, or that original archive bytes still exist.
2. **Independent portable manifest:** an `ICAMP_INDEPENDENT_PORTABILITY_CUSTODIAN` signs the original Build 218 redacted export digest. The workbench verifies all expected export fields, nested allowlists, digest and signature. The manifest key must not be the same active fingerprint as the owner or runner key. The signer identity/public key must be enrolled **outside** the checkout, preferably by a separate authority and device. A signed redacted summary is not proof of durable storage, original ZIP contents or offsite custodian independence.
3. **Exception closure review:** the offline workbench verifies the actual Build 218 owner exception acknowledgement, runner signature, manifest signature and matching artifact ID, task, observation and export record. A matching GitHub metadata readback may advance to an **owner/external archive proof HOLD**. All outcomes explicitly report `retentionExceptionClosed: false`. Missing original archive byte verification, storage-independence evidence and a new owner-signed closure decision cannot be supplied by this script. Invalid/missing/expired signatures and cross-source records are rejected.

Nonce replay checks are session-scoped. Store verified nonces in independently controlled audit custody before considering cross-session anti-replay. The `sign` and `verify` tools use only local files; no background scheduler, network GET, database write or automatic owner approval is installed.

## Windows operator steps

Use a protected directory outside Git, for example `C:\private-icamp-evidence`, and a trusted iCamp checkout. These are example filenames; substitute real files and actual independently enrolled public-key IDs. Never commit private keys, signed receipts, archive ZIPs or sensitive identity records.

1. **Complete the Build 218 owner-approved read-only source recheck** using [Build 218 instructions](BUILD_218_SOURCE_RECHECK_OWNER_EXCEPTION_PORTABILITY.md). Have the actual schedule, recheck observation, redacted export and signed owner exception acknowledgement ready. If any are missing, **stop at HOLD**.
2. **Independently enroll the runner identity and public key.** The private key remains on the runner's original device; store a `runner-pins.json` file such as:

   ```json
   {
     "schema": "icamp.build219.independent-runner-pins.v1",
     "signers": [{
       "keyId": "independently-enrolled-runner-id",
       "role": "ICAMP_INDEPENDENT_READONLY_RUNNER",
       "enabled": true,
       "publicKeyPem": "ACTUAL_ED25519_SPKI_PEM_FROM_ORIGINAL_RUNNER",
       "fingerprint": "sha256:ACTUAL_SHA256_PUBLIC_KEY_FINGERPRINT"
     }]
   }
   ```

   No example value counts as a valid enrollment. Establish original device/identity and fingerprint separately.
3. **Prepare, sign and verify the runner attestation.** Use the real private key locally, with the key ID matching the independently pinned public key:

   ```powershell
   node scripts/build219-runner-manifest-closure.mjs runner-prepare "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" independently-enrolled-runner-id "C:\private-icamp-evidence\runner-request.json"
   node scripts/build219-runner-manifest-closure.mjs runner-sign "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\runner-request.json" "C:\private-icamp-evidence\runner-private.pem" "C:\private-icamp-evidence\runner-attestation.json" --confirm-runner-signature
   node scripts/build219-runner-manifest-closure.mjs runner-verify "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\runner-attestation.json" "C:\private-icamp-evidence\runner-pins.json"
   ```

4. **Enroll a separate portability custodian** in `portability-pins.json`, with schema `icamp.build219.independent-portability-pins.v1` and role `ICAMP_INDEPENDENT_PORTABILITY_CUSTODIAN`. The private key and fingerprint must be genuinely separate from both the owner and the runner. Have the custodian review the redacted Build 218 report before signing.
5. **Prepare, sign and verify the independent export manifest** using the complete public-key enrollment files for the other two roles:

   ```powershell
   node scripts/build219-runner-manifest-closure.mjs manifest-prepare "C:\private-icamp-evidence\portable-evidence-218.json" independent-portability-key-id "C:\private-icamp-evidence\manifest-request.json"
   node scripts/build219-runner-manifest-closure.mjs manifest-sign "C:\private-icamp-evidence\portable-evidence-218.json" "C:\private-icamp-evidence\manifest-request.json" "C:\private-icamp-evidence\portability-private.pem" "C:\private-icamp-evidence\manifest-signature.json" --confirm-independent-custodian-signature
   node scripts/build219-runner-manifest-closure.mjs manifest-verify "C:\private-icamp-evidence\portable-evidence-218.json" "C:\private-icamp-evidence\manifest-signature.json" "C:\private-icamp-evidence\portability-pins.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\runner-pins.json"
   ```

6. **Review the retention exception**, without waiving or closing it:

   ```powershell
   node scripts/build219-runner-manifest-closure.mjs closure-review "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\exception-receipt.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\runner-attestation.json" "C:\private-icamp-evidence\runner-pins.json" "C:\private-icamp-evidence\portable-evidence-218.json" "C:\private-icamp-evidence\manifest-signature.json" "C:\private-icamp-evidence\portability-pins.json" --confirm-review-only
   ```

   Examine the resulting `state` and proof-gap fields. Even a valid signature chain **does not close** the retention exception or extend the expiring GitHub artifact. Genuine source ZIP readback, archive storage proof and explicit owner closure authorization remain independent operational steps.

Use a separate output filename for each new attempt. The file-writing commands create new files only (`wx`) and reject overwrite/symlink targets. The report remains outside the production web application, so no customer/tenant data or keys are uploaded.

## Release verification

- `npm run build219:ci-contract`
- `node --test tests/build219-runner-manifest-closure.test.mjs`
- `npm run verify`
- `npm audit --omit=dev --audit-level=high`
- Protected `dev` PR and independently tested protected `main` PR, retaining exactly five required checks.
- Vercel `READY` on the exact merged SHA, live `/api/version`, `/api/health`, authenticated management route and runtime error scan.

**Next proposed build — iCamp 220:** Actual Original Artifact Byte-Readback Custody Proof Intake, Independently Signed Exception Closure Decision & Cross-Device Audit Receipt Reconciliation.
