# iCamp Build 214 — Owner-supervised SLA ceremony, external archive registration and CI evidence aging

## Scope and proof boundary

Build 214 provides a **local, owner-supervised follow-through** for Build 212/213 evidence. It does not take ownership of the original archive, sign a decision, identify a human by itself, create immutable storage, approve a release or establish the trusted Comms Hub connection.

- Build 213 still verifies the **exact original ZIP bytes**, pinned original Actions identities, independent custodian signature and a separately pinned custodian public key.
- Build 212/213 still prepare, sign and reconcile a **real owner-controlled Ed25519 SLA receipt** for the exact source evidence. Build 214 never generates the signature or private key.
- Build 214 records only verification-derived, minimal source identities, SHA-256 packet hashes, expiry and the resulting local hash-chain head in a private file **outside the repository**. No archive bytes, private keys, human names or owner contacts go into Git or GitHub Actions.
- Every CI run now emits `build214.aging` in the existing `build205-ci-runtime-evidence` artifact. It reports read-only expiry/metadata/conflict alerts for the original Build 211 artifact pins, or `SOURCE_UNAVAILABLE` if metadata cannot be verified. It never ingests the private registry and does not assume original archives were renewed merely because new CI evidence was created.

## Owner/operator runbook (Windows PowerShell)

From a current iCamp checkout, create a restricted directory outside the source checkout. The examples below assume `C:\private-icamp-evidence` already exists and only trusted owners/custodians can read it.

### A. Independent archive custody registration

1. Independently retrieve the exact original ZIP from its original GitHub Actions run and store it outside GitHub under an approved custody policy. Verify the original source run, job, artifact, pinned digest, storage location and real custodian identity via a separate trusted channel. Build 213's historical pin is not storage proof.
2. Obtain `archive-claims.json`, `archive-attestation.json` and `custodian-pins.json` from the independently authorized custodian. Verify the public key fingerprint separately, not by trusting a self-asserted pins file.
3. Register it using the **same** original ZIP and signed packet that Build 213 verifies:

```powershell
node scripts/build214-owner-custody-register.mjs register-archive "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\original.zip" "C:\private-icamp-evidence\archive-claims.json" "C:\private-icamp-evidence\archive-attestation.json" "C:\private-icamp-evidence\custodian-pins.json" --confirm-independent-review
```

The command fails on unknown original identity, digest mismatch, bad signature, unpinned custodian or expired attestation. It only records metadata, never the ZIP or the key.

### B. Real owner-supervised SLA decision registration

1. Download the **original** `build205-ci-runtime.json` generated for the reviewed source commit. Confirm the real PR/main five-gate cohorts and Build 211 SLA monitoring prerequisites. Build 213 requires at least three complete cohorts **per stage** for an affirmative decision.
2. Owner chooses ACCEPT, DEFER or REJECT. Follow the [Build 212 signing ceremony](BUILD_212_RUNNER_ESCALATION_OWNER_SLA_CUSTODY.md) outside CI with their **actual** owner-controlled signing key, then independently enroll and verify the public key pin. Do not paste a private key or signed receipt into chat, a PR, CI or source control.
3. Reconcile the signed receipt with the exact JSON using Build 213, then register it:

```powershell
node scripts/build214-owner-custody-register.mjs register-owner "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\owner-signed-receipt.json" "C:\private-icamp-evidence\owner-pins.json" --confirm-independent-review
```

Registration is restricted to exact-evidence signed decisions. It does **not** turn DEFER/REJECT into ACCEPT or grant deployment or Comms TEST authority.

### C. Review, monitor and independently pin the local ledger

```powershell
node scripts/build214-owner-custody-register.mjs audit "C:\private-icamp-evidence\registry.jsonl"
```

Copy the output's `headHash` via a separate approved channel into independent owner/custodian records. On the next readback, pass the previously anchored head to detect replacement or truncation (when no new entries were expected):

```powershell
node scripts/build214-owner-custody-register.mjs audit "C:\private-icamp-evidence\registry.jsonl" "sha256:YOUR_INDEPENDENTLY_RECORDED_64_HEX_DIGEST"
```

Each entry has a sequence number and hash of the previous entry. Any modified in-place entry is detected; **a full replacement or truncation is detectable only when a prior head is pinned outside the ledger**. The script uses a single-writer lock and fails closed if another writer is active. It does not promise tamper-proof storage, backup durability, human identity validation, replay protection across independent ledger copies or long-term retention. Renew both expiring actual attestations and original artifact retention according to the owner's governance policy.

## Automated read-only aging monitoring

Check the latest [iCamp Actions](https://github.com/RosevearCreations/iCamp/actions) → completed `CI / Verify` → `build205-ci-runtime-evidence` artifact → `build205-ci-runtime.json`:

- `build214.aging.alerts` lists each **original** reviewed Actions artifact that is expired, within 7 days of expiry, unavailable, invalid or digest-conflicted.
- `build214.aging.state = SOURCE_METADATA_CURRENT_EXTERNAL_CUSTODY_UNVERIFIED` is **not** a custody certification; it only means original GitHub metadata raised no current alert.
- `ORIGINAL_ARTIFACT_SOURCE_UNAVAILABLE_REVIEW_REQUIRED` and any conflict remain explicit owner actions, never a green bypass.
- Private registry attestations have their own 14-day expiry warning in `audit`. Run the local audit during periodic owner review; neither CI nor a schedule imports private keys or private custody material.

## Tests and release gates

- `npm run build214:ci-contract`
- `node --test tests/build214-registration-aging.test.mjs`
- `npm run verify` and `npm audit --omit=dev --audit-level=high`
- Actual protected PR and exact `main` checks: `CI / Verify`, `CI / Browser end-to-end`, `CI / Database migrations`, `Secret Scan / Gitleaks`, `CodeQL / Analyze JavaScript and TypeScript`.
- Verify the actual production SHA/deployment separately at [iCamp version endpoint](https://i-camp-pi.vercel.app/api/version).

No new workflow, runner, third-party service, paid resource, scheduled CI job, production database migration, public endpoint or communication provider is created. This avoids new saturation while keeping the five protected gates.

## Next proposed build — 215

**iCamp 215 — Independent Ledger Anchor Readback, Multi-Custodian Renewal Conflict Triage & Owner SLA Expiry Escalation.** Add controlled independent head checkpoints, conflicting-copy review and expiring owner-decision follow-up without publishing private authority evidence or silently upgrading HOLD states.
