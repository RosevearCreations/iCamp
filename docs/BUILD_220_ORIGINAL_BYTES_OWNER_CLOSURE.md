# iCamp Build 220 — original ZIP byte readback, separate custody signature and owner closure review

Build 220 adds an **offline, size-bounded, read-only original artifact ZIP hash check**, separately pinned **archive-byte custodian attestation**, time-limited **owner-signed exception closure review**, and **cross-device signed receipt reconciliation**. It extends Builds 214–219 without enabling background network calls, modifying the original archive or automatically closing an exception.

**Real provenance requirements remain external:** the operator must independently obtain the original GitHub Actions artifact ZIP through an authenticated, approved workflow; preserve its immutable original run/commit/artifact ID and the independently authenticated source digest; establish the source download and custodian's real identity; and verify storage immutability outside this tool. A matching SHA-256 digest is strong **local byte evidence**, but cannot alone prove original download provenance, durable custody, original GitHub expiry renewal or physical device separation.

## Exact proof chain

1. **Verified prior chain:** a real private Build 214 registration ledger, current Build 218 signed owner-approved original GitHub metadata observation, Build 219 original runner attestation, independent signed redacted portability manifest, and a current signed owner SLA exception acknowledgement for the *same* original artifact ID.
2. **Local archive bytes:** a trusted operator selects the original ZIP stored outside Git. `byte-readback` streams the entire file (up to 100 MiB) and computes SHA-256 without ZIP extraction or uploading bytes. It validates the ZIP local header, byte count, registration identity/commit and digest. The source digest must agree across all registered custodians. A mismatch is reported as `LOCAL_ZIP_DIGEST_CONFLICT_QUARANTINED_HOLD` and cannot be attested.
3. **Independent archive custodian:** an actual custodian, on its own device, signs the immutable byte record digest and current ledger head using an independently pinned Ed25519 key with role `ICAMP_INDEPENDENT_ARCHIVE_BYTE_CUSTODIAN`. The provided device ID is a **claim**; the tool cannot authenticate the physical machine or offsite storage.
4. **Owner closure review:** an owner signs a separate, time-bounded `APPROVE_CLOSURE_REVIEW`, `DEFER_CLOSURE_REVIEW` or `REJECT_CLOSURE_REVIEW` request. It binds the exception acknowledgement, runner, manifest, ZIP readback, custodian receipt, ledger head and owner device claim. This is a **review decision**, not a policy waiver or completed archive retention renewal.
5. **Cross-device reconciliation:** the verifier checks the owner, runner, portability signer and archive custodian against four *different* enabled public-key fingerprints; the signed owner/custodian device claims must differ. Expired or revoked pins, changed bytes/ledger, mismatched artifact IDs, forged signatures and replayed nonces fail closed. The audit output always has `retentionExceptionClosed:false`, `independentOriginalDeviceIdentityEstablished:false`, `originalDownloadProvenanceVerified:false`, `independentOffsiteStorageVerified:false` and `commsTestAuthorized:false`.

Never put original archive ZIPs, private signing keys, operator tokens, unsigned requests or private receipts in GitHub, a browser input, a support ticket, or ChatGPT. All commands run locally and output to protected paths **outside the repository**. Generated receipts are never treated as original-host proof by CI.

## Windows field procedure

Open PowerShell in a trusted iCamp `main` checkout. Use separate original owner/custodian devices. Example private folder `C:\private-icamp-evidence` must already exist and have restricted NTFS permissions. Substitute actual external archive and independently authenticated fingerprints; no sample IDs or fixture keys confer authority.

1. **Confirm the prior signed evidence.** Follow the [Build 219 instructions](BUILD_219_RUNNER_ATTESTATION_MANIFEST_CLOSURE.md) first. Stop if owner pins, runner signature, signed portability manifest or original artifact readback are missing/expired.

2. **Locally hash the actual original artifact ZIP.** The original ZIP must be obtained through an independently authorized GitHub download—not a fabricated test file—and must be outside the checkout. The command does not contact GitHub or copy the ZIP anywhere.

   ```powershell
   node scripts/build220-byte-custody-closure.mjs byte-readback "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\original-artifact-12345.zip" "C:\private-icamp-evidence\original-byte-readback.json" --confirm-owner-local-readonly
   ```

   Verify `localDigestMatchedPinnedSource` and `byteCount`. If a mismatch is reported, **quarantine**, check the independent source and do not sign it. The output explicitly keeps independent provenance and immutable storage on HOLD.

3. **Enroll and independently verify the archive-byte custodian.** Store its actual SPKI public key and calculated fingerprint in `byte-custodian-pins.json`, with schema `icamp.build220.independent-byte-custodian-pins.v1`, role `ICAMP_INDEPENDENT_ARCHIVE_BYTE_CUSTODIAN`, `enabled:true` and a unique `keyId`. The custodian private key stays on the independent original device. Do not reuse any owner, runner or manifest signing key.

4. **Prepare, sign and verify the custodian claim:**

   ```powershell
   node scripts/build220-byte-custody-closure.mjs custodian-prepare "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\original-byte-readback.json" independently-enrolled-custodian-id REE-ORIGINAL-SERVER "C:\private-icamp-evidence\byte-custodian-request.json"
   node scripts/build220-byte-custody-closure.mjs custodian-sign "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\original-byte-readback.json" "C:\private-icamp-evidence\byte-custodian-request.json" "C:\private-icamp-evidence\custodian-private.pem" "C:\private-icamp-evidence\byte-custodian-receipt.json" --confirm-original-device-signature
   node scripts/build220-byte-custody-closure.mjs custodian-verify "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\original-byte-readback.json" "C:\private-icamp-evidence\byte-custodian-receipt.json" "C:\private-icamp-evidence\byte-custodian-pins.json"
   ```

   The device ID above is illustrative, not verified hardware evidence. The real independent custodian must supply their actual ID and authentic pin.

5. **Prepare the original owner decision only after independent review.** The argument immediately before owner key ID is one of `APPROVE_CLOSURE_REVIEW`, `DEFER_CLOSURE_REVIEW`, or `REJECT_CLOSURE_REVIEW`. The owner and custodian device claims must be different. Command arguments in order: ledger, signed exception acknowledgement, owner pins, schedule, observation, signed runner receipt, runner pins, redacted report, signed manifest, manifest pins, byte record, custodian receipt, custodian pins, decision, owner key ID, claimed owner device, new output path.

   ```powershell
   node scripts/build220-byte-custody-closure.mjs closure-prepare "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\exception-receipt.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\runner-attestation.json" "C:\private-icamp-evidence\runner-pins.json" "C:\private-icamp-evidence\portable-evidence-218.json" "C:\private-icamp-evidence\manifest-signature.json" "C:\private-icamp-evidence\portability-pins.json" "C:\private-icamp-evidence\original-byte-readback.json" "C:\private-icamp-evidence\byte-custodian-receipt.json" "C:\private-icamp-evidence\byte-custodian-pins.json" DEFER_CLOSURE_REVIEW owner-jack-id JACK-MASTER-LAPTOP "C:\private-icamp-evidence\owner-closure-request.json"
   ```

   Use `DEFER_CLOSURE_REVIEW` until genuine original source provenance and storage evidence are separately authenticated. The owner may later prepare a new scoped review decision.

6. **Sign the exact review request on the owner's original device, then verify its whole cross-device chain** (argument order for `closure-verify`: the first 13 source/pin paths above, followed by owner closure receipt and `--confirm-review-only`):

   ```powershell
   node scripts/build220-byte-custody-closure.mjs closure-sign "C:\private-icamp-evidence\owner-closure-request.json" "C:\private-icamp-evidence\owner-renewal-private.pem" "C:\private-icamp-evidence\owner-closure-receipt.json" --confirm-original-owner-signature
   node scripts/build220-byte-custody-closure.mjs closure-verify "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\exception-receipt.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\recheck-schedule.json" "C:\private-icamp-evidence\recheck-artifact-12345.json" "C:\private-icamp-evidence\runner-attestation.json" "C:\private-icamp-evidence\runner-pins.json" "C:\private-icamp-evidence\portable-evidence-218.json" "C:\private-icamp-evidence\manifest-signature.json" "C:\private-icamp-evidence\portability-pins.json" "C:\private-icamp-evidence\original-byte-readback.json" "C:\private-icamp-evidence\byte-custodian-receipt.json" "C:\private-icamp-evidence\byte-custodian-pins.json" "C:\private-icamp-evidence\owner-closure-receipt.json" --confirm-review-only
   ```

7. **Read the returned HOLD fields.** A clean signed reconciliation does not authorize a persistent connection, renew an original GitHub artifact or mark the retention issue resolved. Independent source-download chain of custody, actual hardware identity, immutable archive retention and the separate final owner policy remain external.

## Verify and promote

- `npm run build220:ci-contract`
- `node --test tests/build220-byte-custody-closure.test.mjs`
- `npm run verify`
- `npm audit --omit=dev --audit-level=high`
- Protected five-check development PR and fresh five-check production PR; only then merge `main` and verify Vercel `READY`, exact `/api/version` SHA, `/api/health`, access control and runtime errors.

No migrations, new cron jobs, automated reads of original GitHub ZIPs, source writes, paid services, guest data exports, or Comms TEST activation are included.

## Next proposed build — iCamp 221

**Original Source Provenance Chain-of-Custody Verification, External Archive Retention Reattestation & Owner-Governed Closure Eligibility Audit.**
