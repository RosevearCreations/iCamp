# iCamp Build 217 — Cross-custodian diversity, owner renewals and evidence retention SLA dashboard

Build 217 extends Builds 214–216. It adds **review tools, not automatic trust**. Nothing in this build activates Comms TEST, signs for an owner, renews an original GitHub artifact, certifies off-site storage or approves production operations. The five existing protected release checks remain required.

## Scope and safety

1. **Cross-custodian anchor diversity review** verifies the Build 216 rotation history against its independently saved tail hash, checks each Build 215 Ed25519 signature and reviewed pin, counts different active reviewer **public keys**, and detects shared key material or overlapping reviewer/archive signer IDs. Distinct signing keys do **not** establish independent humans or long-term immutable custody. Original archive conflicts remain quarantined by the Build 215 triage logic.
2. **Owner renewal outcome reconciliation** accepts real Build 216 signed owner choice receipts, revalidates their approved public-key pins, checks ledger-head and target-record binding, rejects nonce replay, reports expired decisions and quarantines contradictory active choices. An instruction to request evidence renewal is not evidence that the source was actually renewed. Historic expired receipts may be verified as historic signatures, not current authorization.
3. **Redacted evidence retention SLA dashboard** combines private ledger deadlines, verified rotation claims and Build 211 reviewed *historical* GitHub artifact metadata into overdue, within-seven-day, within-fourteen-day and unknown-deadline buckets. It generates a **static local HTML file** with no external scripts, network requests, source digests, archive locations, signer keys or signed receipts. The dashboard never claims that the historical snapshot is a new GitHub readback.
4. **Production I.T. entry point** at `/workspaces/it-analysis/custody-retention` is permission-protected and provides the instructions and explicit HOLD. Private evidence is not sent to the deployed website, a provider, or GitHub CI.

## Owner-supervised Windows runbook

Use the latest iCamp checkout and a restricted directory **outside** the repository (example `C:\private-icamp-evidence`). Keep the directory off cloud-sync folders unless individually approved. Ensure only authorized custodians/owners can read it.

Before running, we need the actual records, **not simulated proof**:

- `registry.jsonl`: verified Build 214 registration ledger.
- `rotation-history.jsonl`: actual Build 216 hash-linked signed checkpoint records.
- `reviewer-pins.json`: externally authenticated Build 215 independent reviewer public-key pins.
- A separately preserved exact Build 216 `tailHash`, e.g. `sha256:<64 lowercase hex digits>`; use `GENESIS` only when the rotation ledger truly has no records.
- `owner-renewal-receipts.json`: a JSON array of real signed Build 216 owner renewal receipts (use `[]` if none). Each must be authorized by the real owner; do not invent test signatures for field acceptance.
- `owner-renewal-pins.json`: separate, independently enrolled Build 216 owner public-key pins (use `{ "schema": "icamp.build216.owner-renewal-pins.v1", "signers": [] }` if no real receipts).
- `build205-ci-runtime.json`: the downloaded original `build205-ci-runtime-evidence` JSON from the appropriate [iCamp Actions run](https://github.com/RosevearCreations/iCamp/actions). Independently compare original run, job, artifact IDs, SHA and expiry on GitHub before using the snapshot.

Then run:

```powershell
cd C:\path\to\iCamp
node scripts/build217-custody-retention-dashboard.mjs dashboard "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\rotation-history.jsonl" "C:\private-icamp-evidence\reviewer-pins.json" "sha256:YOUR_SEPARATELY_SAVED_ROTATION_TAIL" "C:\private-icamp-evidence\owner-renewal-receipts.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\retention-sla-217.html" --confirm-offline-owner-review
```

The HTML output is created once, with restrictive file permissions where supported. It refuses to overwrite an existing report. If there are no signed checkpoints, use a truly empty `rotation-history.jsonl` file and an independently known `GENESIS` tail. If any signature, pin, source identity or chain tail conflicts, stop and reconcile the original authority before proceeding.

Open `retention-sla-217.html` locally with a browser. Review:

| Reading | What we must do |
| --- | --- |
| Overdue | Confirm original source expiry and owner retention decision immediately |
| Due within 7 days | Prioritize original artifact and signed anchor renewal review |
| Due within 8–14 days | Plan custodian/owner evidence renewal before expiry |
| Unknown deadline | Retrieve source metadata; do not interpret as current |
| Source identity conflicts | Quarantine until original GitHub run/job/artifact IDs match |
| Owner choice conflicts | Obtain separate signed decisions and explicitly resolve disagreement |
| Same reviewer public key under two IDs | Reject the false claim of distinct signers |
| Fewer than two verified current reviewer keys | Obtain a second independently enrolled reviewer; do not infer human independence |

The report is a monitoring snapshot, **not a signed authority record**. Keep original inputs and their separately pinned hashes in independent custody; redacted HTML alone is insufficient. Actual archive immutability, independent real-world identity, source readback and signed owner consent remain externally verified HOLD items.

## Verification

- `npm run build217:ci-contract`
- `node --test tests/build217-custody-retention-dashboard.test.mjs`
- `npm run verify`
- `npm audit --omit=dev --audit-level=high`
- Existing five protected GitHub checks on `dev` and a fresh five-check production PR, exact Vercel SHA, and live `/api/version` and `/api/health`.

No new database migration, automatic scheduler, paid provider or production connectivity is introduced.

## Next proposed build — iCamp 218

**Build 218 — Independent Artifact Source Recheck Scheduler, Owner SLA Exception Acknowledgement & Cross-Custodian Evidence Portability Export.** Introduce owner-approved source recheck orchestration, signed manual exception acknowledgement and tenant-safe portable redacted evidence exports while retaining original trust and release gates.
