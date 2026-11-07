# iCamp Build 218 — owner-scoped source rechecks, signed SLA exception acknowledgements and portable evidence

Build 218 extends the private Builds 214–217 custody chain. It introduces an **offline owner-controlled recheck schedule**, an opt-in **read-only GitHub artifact metadata recheck**, an **Ed25519 signed exception acknowledgement**, and a **cross-custodian redacted export**. Nothing automatically installs a Windows scheduler or Vercel Cron Job. No owner decision, original artifact copy or external storage independence is invented in CI.

The protected release checks, provider holds, production approval policy and Comms Hub TEST authority are unchanged.

## The three workflows

### 1. Independent original artifact recheck schedule

- `createSourceRecheckSchedule` combines the private Build 214 ledger with the reviewed Build 211 original GitHub Actions artifact **historical snapshot** and actual Build 216 owner-signed `REQUEST_EVIDENCE_RENEWAL` receipts.
- A 14-day warning window and 24-hour repeat interval generate deterministic due tasks and idempotency keys. Multiple custodians of the **same source artifact** share one recheck task. Differing source identities or digests are quarantined.
- Missing signed owner request, mismatching snapshot, not-yet-due task and repeat cooldown remain **HOLD / WAIT**. Generating a schedule performs **no network call** and installs **no unattended task**.
- A supervised `recheck` command separately recomputes eligibility, then performs one fixed-origin HTTPS **GET** to the original GitHub artifact metadata endpoint, using a read-only GitHub Actions credential already present in the operator's secure `GITHUB_TOKEN` environment variable. It enforces an 8-second timeout, rejects redirects, checks artifact ID, run ID, source commit and exposed digest, then records a limited observation.
- GitHub artifact metadata does **not** prove the original CI job association, download/retention of original ZIP bytes, owner identity, or immutable off-site custody. If the API omits its digest, or the original is expired, the result stays on HOLD. A successful metadata match **does not extend an artifact's expiry**.

The schedule can be evaluated repeatedly by an operator or a separately approved Windows Scheduled Task, but this build does not enroll or activate such a task. The individual GET still needs an explicit confirmation and current signed owner request. Do not attach credentials to a task until the authorized owner approves the exact operation and storage policy.

### 2. Owner SLA exception acknowledgement

The separate Build 218 request binds an exception code to one exact ledger entry hash, current ledger head, owner key ID, nonce, and short expiry (one to seven days). An authorized owner signs it locally with their actual Ed25519 key; a verifier checks the independently enrolled Build 216 owner public-key pin. Supported exception codes:

- `ORIGINAL_ARTIFACT_EXPIRED`
- `SOURCE_METADATA_UNAVAILABLE`
- `SOURCE_DIGEST_OR_IDENTITY_CONFLICT`
- `INDEPENDENT_CUSTODY_NOT_PROVEN`
- `SLA_RECHECK_OVERDUE`

This is an acknowledgement **of a problem**, not a waiver or signed authorization to bypass release/retention checks. Invalid signatures, missing pins, expired requests, replayed nonces and ledger drift fail closed. Nonce replay detection is per verification session; long-term cross-session replay protection requires independent custody.

### 3. Cross-custodian evidence portability

The local `export` command verifies the current Build 217 dashboard inputs, signed owner exception receipts, source task references and basic recheck-record consistency before emitting an immutable-by-content-digest JSON **summary**. The export contains urgency/exception counts, reported metadata recheck statuses and proof-gap flags. It does **not** include original source digests, ZIP contents, signer keys, signatures, storage locations, customer/tenant data or raw owner notes. The JSON digest detects accidental modification but is **not** an independent signature or an archive durability certificate.

The export's reported source observations are **untrusted local receipts unless independently compared to the original GitHub endpoint**. Importing the report must not upgrade external trust, tenant isolation, owner approval, or Comms TEST state.

## Windows operator steps

Use a restricted directory outside the Git checkout, such as `C:\private-icamp-evidence`. Keep the private ledger, reviewed source snapshot, reviewer pins, Build 216 owner pins and signed renewal receipts in that location. The Build 217 [operator guide](BUILD_217_CUSTODY_DIVERSITY_RENEWAL_DASHBOARD.md) explains those source files. Never commit private files or keys.

1. **Prepare or independently verify an actual Build 216 owner-signed `REQUEST_EVIDENCE_RENEWAL`** for an exact archive registration sequence. No synthetic owner signature from CI qualifies.
2. **Produce a recheck schedule** (no GitHub call yet):

   ```powershell
   node scripts/build218-source-recheck-portability.mjs schedule "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\owner-renewal-receipts.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\recheck-schedule.json" --confirm-owner-review
   ```

3. **Review due tasks and owner approval.** If a task is `OWNER_REQUESTED_READONLY_RECHECK_DUE`, configure a read-only GitHub Actions token securely as `GITHUB_TOKEN` in the local process environment. Do not enter it on a command line, print it in logs or paste it into ChatGPT. Execute one specifically approved metadata GET (example artifact ID `12345`):

   ```powershell
   node scripts/build218-source-recheck-portability.mjs recheck "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\owner-renewal-receipts.json" "C:\private-icamp-evidence\owner-renewal-pins.json" 12345 "C:\private-icamp-evidence\recheck-artifact-12345.json" --confirm-owner-authorized-readonly
   ```

4. **Acknowledge any actual owner SLA exception** (example sequence `1`):

   ```powershell
   node scripts/build218-source-recheck-portability.mjs ack-prepare "C:\private-icamp-evidence\registry.jsonl" 1 SLA_RECHECK_OVERDUE owner-renewal-key-id "C:\private-icamp-evidence\exception-request.json"
   node scripts/build218-source-recheck-portability.mjs ack-sign "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\exception-request.json" "C:\private-icamp-evidence\owner-renewal-private.pem" "C:\private-icamp-evidence\exception-receipt.json" --confirm-owner-signature
   node scripts/build218-source-recheck-portability.mjs ack-verify "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\exception-receipt.json" "C:\private-icamp-evidence\owner-renewal-pins.json"
   ```

5. **Make a redacted portable export.** Assemble successfully created recheck output objects into `rechecks.json` as a JSON array, and actual signed exception receipts into `exceptions.json` as an array (`[]` if none). The resulting output is a new file and will not overwrite an existing one.

   ```powershell
   node scripts/build218-source-recheck-portability.mjs export "C:\private-icamp-evidence\registry.jsonl" "C:\private-icamp-evidence\build205-ci-runtime.json" "C:\private-icamp-evidence\rotation-history.jsonl" "C:\private-icamp-evidence\reviewer-pins.json" "sha256:YOUR_SEPARATELY_SAVED_ROTATION_TAIL" "C:\private-icamp-evidence\owner-renewal-receipts.json" "C:\private-icamp-evidence\owner-renewal-pins.json" "C:\private-icamp-evidence\rechecks.json" "C:\private-icamp-evidence\exceptions.json" "C:\private-icamp-evidence\portable-evidence-218.json" --confirm-redacted-export
   ```

Keep the original inputs in separately governed custody. The redacted summary cannot replace them.

## Verification and promotion

- `npm run build218:ci-contract`
- `node --test tests/build218-source-recheck-portability.test.mjs`
- `npm run verify`
- `npm audit --omit=dev --audit-level=high`
- The original five protected GitHub release gates for `dev` and a fresh five-check PR to `main`, followed by Vercel READY, exact production SHA, live API health and runtime-error scan.

No new database migration, paid provider, automatic external scheduler, remote source write or production Comms connection is created.

## Next proposed build — iCamp 219

**Build 219 — Owner-Approved Read-Only Recheck Runner Attestation, Independent Portability Manifest Signature & Retention Exception Closure Review.** Introduce separate runner identity attestations, cross-custodian portability signature verification and evidence-backed owner closure decisions without weakening protected gates.
