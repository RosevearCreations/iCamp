# iCamp Build 215 — Independent ledger anchor readback, multi-custodian renewal triage and SLA expiry escalation

## Delivered boundaries

Build 215 adds an **offline, owner-supervised** independent anchor signing/readback assistant and conflict/expiry review for the private Build 214 external evidence registry. It cannot prove independent human identity or immutable third-party storage by itself. No private ledger, key or signature is imported into CI, posted to GitHub or made available through the public app.

- Verify a genuine Ed25519 reviewer's separately pinned public key, signed hash-chain prefix, timestamp, scope and expiry. Later ledger entries remain **unanchored** until separately reviewed and signed.
- Group records by original archive artifact identity. Conflicting source digests/identities are quarantined for human review; overlapping custodian renewals, reused storage references, fewer than two distinct current custodian keys and attestations approaching expiry remain explicit actions. Two different signer keys and storage references **do not** prove two independently governed vaults.
- Group signed SLA decisions by exact source evidence digest and commit. Contradictory decisions or reused nonces require manual resolution; receipts expiring within 14 days or already expired require owner follow-up. ACCEPT never automatically overrides DEFER/REJECT, and no expiry alert creates a new owner signature.
- Reuse the existing Build 205 CI artifact to report that private anchor evidence is **not present in CI**; retain GitHub original-artifact aging alerts and all five required protected checks unchanged.

## Owner/independent reviewer steps on Windows

Use a restricted private directory outside the iCamp checkout, for example `C:\private-icamp-evidence`. Keep the original Build 214 `registry.jsonl` and its independently recorded last head hash. Never place the private key, ZIP, ledger, signed decision, owner name or custody location into GitHub, chat or CI.

### 1. Review the Build 214 ledger

```powershell
node scripts/build214-owner-custody-register.mjs audit "C:\private-icamp-evidence\registry.jsonl"
```

Compare the displayed `headHash` with its prior independently held checkpoint. Inspect new sequence numbers, source records, expiries and original artifact identities. If the chain changed unexpectedly or a previously anchored prefix is missing, **stop**: do not create a new signature to conceal it.

### 2. Prepare an unsigned anchor request

```powershell
node scripts/build215-independent-anchor-triage.mjs prepare-anchor "C:\private-icamp-evidence\registry.jsonl" "independent-reviewer-key-id" "C:\private-icamp-evidence\anchor-claims.json" --confirm-reviewed-head
```

This creates a **new, unsigned** request tied to the reviewed sequence and current ledger head, with an expiring nonce. The reviewer key ID must not be an owner/custodian signing key already used in that ledger.

### 3. Separate reviewer signs and independently pins their key

An actually independent authorized reviewer, ideally on a separately controlled device, validates the original artifacts and owner/custodian source references through a trusted channel. Only that reviewer uses their own Ed25519 private key, held outside the checkout:

```powershell
node scripts/build215-independent-anchor-triage.mjs sign-anchor "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\anchor-claims.json" "C:\private-icamp-evidence\reviewer-private.pem" "C:\private-icamp-evidence\anchor-attestation.json" --confirm-independent-review
```

The signature is created locally with `wx` output, not overwritten or uploaded. Obtain `reviewer-pins.json` separately with schema `icamp.build215.independent-anchor-pins.v1`, a reviewer entry with `keyId`, `role: ICAMP_INDEPENDENT_LEDGER_ANCHOR_REVIEWER`, `enabled: true`, `publicKeyPem` and independently confirmed `fingerprint` (the SHA-256 of Ed25519 SPKI DER). A self-created pins file is **not** proof of reviewer identity. Independently retain the signed request and previously pinned head in a protected archive.

### 4. Read back the actual signature and triage custody

```powershell
node scripts/build215-independent-anchor-triage.mjs verify-anchor "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\anchor-claims.json" "C:\private-icamp-evidence\anchor-attestation.json" "C:\private-icamp-evidence\reviewer-pins.json"
```

```powershell
node scripts/build215-independent-anchor-triage.mjs triage "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\anchor-claims.json" "C:\private-icamp-evidence\anchor-attestation.json" "C:\private-icamp-evidence\reviewer-pins.json"
```

Without independently signed inputs, a safe read-only triage is still available:

```powershell
node scripts/build215-independent-anchor-triage.mjs triage "C:\private-icamp-evidence\registry.jsonl"
```

The result explicitly states `NO_INDEPENDENTLY_SIGNED_ANCHOR_SUPPLIED`, and any conflicts or expiring entries remain for owner review. It does not enroll authority, renew source bytes or unlock billing, dispatch, Comms Hub TEST or production checks.

## Review rules

| Finding | Required action |
| --- | --- |
| `CONFLICTING_ORIGINAL_IDENTITY_OR_DIGEST_QUARANTINED` | Investigate against original immutable GitHub run/job/artifact records; **never** rewrite the historical digest to pass. |
| `OVERLAPPING_CUSTODIAN_RENEWALS_MANUAL_REVIEW` | Reconcile duplicate signer attestations and lifecycle without replacing earlier records. |
| `SHARED_STORAGE_REFERENCE_INDEPENDENCE_REVIEW` | Verify separately governed physical copies before claiming independence. |
| `SECOND_CUSTODIAN_ATTESTATION_REQUIRED` | Obtain independent verification or maintain explicit HOLD. |
| `CUSTODY_EXPIRY_OR_RENEWAL_ESCALATION` | Reverify actual original bytes and obtain new signed custody attestations before expiry. |
| `CONFLICTING_OR_REPLAYED_OWNER_DECISIONS_REVIEW_REQUIRED` | Resolve authority and signed decisions off-system; no automatic supersession. |
| `OWNER_SLA_RECEIPT_EXPIRES_WITHIN_14_DAYS` / `OWNER_SIGNED_RECEIPT_EXPIRED_RENEWAL_REQUIRED` | Ask owner to review current evidence and explicitly sign a *new* decision. |
| `SIGNED_HISTORICAL_PREFIX_VERIFIED_NEW_ENTRIES_UNANCHORED` | Obtain a new separate reviewer checkpoint for added entries. |

Cryptographic verification establishes byte equality, signature and pinned-key consistency, **not** human identity, independent storage durability, signer enrollment, original owner consent, or cross-session nonce replay prevention. The local ledger's old head must remain pinned separately to detect complete-file replacement or truncation.

## Verification and promotion

- `npm run build215:ci-contract`
- `node --test tests/build215-independent-anchor-triage.test.mjs`
- `npm run verify`, production dependency audit, protected PR checks and exact live Vercel SHA after merging `dev`/`main`.
- Read latest [iCamp Actions](https://github.com/RosevearCreations/iCamp/actions) → `CI / Verify` → `build205-ci-runtime-evidence` for the read-only `build215` handoff. No CI job accesses the external registry.

## Next proposed build — 216

**iCamp 216 — Independent Custody Head Checkpoint Rotation, Owner Renewal Decision Workbench & Source-Verified Expiry Escalation Timeline.** Maintain independently signed head-history transitions and source-expiry follow-ups with clear owner choice, preserving fail-closed trust.
