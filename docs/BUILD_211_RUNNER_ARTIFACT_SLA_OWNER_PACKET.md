# iCamp Build 211 — Runner contention, artifact expiry & owner SLA acceptance evidence

**Scope:** Read-only observations in the pre-existing `CI / Verify` evidence artifact. No new workflow, runner privilege, retry, gate waiver, remote retention mutation, or Comms Hub TEST authorization.

## Runner source verification

Build 210's workflow-created-to-job-start queue proxy can include GitHub scheduling overhead. Build 211 attaches the original GitHub Actions run/job IDs, observed assigned `runner_name`, `runner_group_name`, available runner labels, timestamps, and conclusions to required checks. If a check exceeds its existing 600-second monitoring queue budget, show the original assignment. Missing assignment is explicit. Parallel workflows on hosted runners **do not prove that the provider's runner pool is saturated**: pool capacity, cross-tenant queues, and scheduler decisions are not observable from the job API. Neither mirror nor runner contention is inferred as the cause of a delay.

## Expiring source evidence and safe renewal

Build 210's four original reviewed Chromium artifact IDs and pinned SHA-256 fingerprints remain the historical source references. The diagnostic now performs **four bounded, authenticated, read-only GitHub Actions artifact metadata lookups**. It checks artifact ID identity, creation/expiry dates, `expired`, and optional GitHub metadata digest. It distinguishes:

- Original available for more than seven days.
- Expiring within seven days: owner decides whether to preserve an independently reviewed original copy.
- Original expired: cannot honestly label the old evidence renewed or verified.
- Source unavailable, identity/metadata invalid or digest conflict: quarantine and request independent review.

The existing CI produces a fresh 14-day `build205-ci-runtime-evidence` artifact at every run, which is **new evidence**, not a renewal of the original artifacts. No original is overwritten or recreated, no retention period is extended, and a pinned digest does not itself constitute an independently retained immutable copy. Source failures remain visible rather than passing as green.

## Owner SLA decision packet

The existing bounded twelve-completed-workflow readback supplies only fully successful SHA cohorts containing all five required checks. The packet displays PR/main sample counts, p50/p90 times, individual run IDs, incomplete-cohort exclusions, and 900-second *diagnostic* performance budgets. A minimum of three full cohorts per stage is required even to present a reviewable sample. Missing source, expiration risk, exceptions or insufficient cohorts keep the owner review open.

Owner decision is deliberately `NOT_SIGNED`. We must review original GitHub Actions links/archives, determine acceptable monitoring baselines, document any exception or retention choice, and sign through the project's separate authorized owner workflow. A software-generated report cannot certify our consent or a live Comms Hub handshake.

## Evidence and verification

- Original source run and artifact IDs: [`fixtures/build210-reviewed-chromium-history.json`](../fixtures/build210-reviewed-chromium-history.json).
- Per-run diagnostic artifact: `.github/workflows/ci.yml` → `build205-ci-runtime-evidence` (14-day retention), with `build211` object and step summary.
- Local tests: `npm run build211:ci-contract`, `node --test tests/build211-runner-artifact-sla.test.mjs`, and `npm run verify`.
- All five checks remain: `CI / Verify`, `CI / Browser end-to-end`, `CI / Database migrations`, `Secret Scan / Gitleaks`, `CodeQL / Analyze JavaScript and TypeScript`.
- [GitHub Actions runs](https://github.com/RosevearCreations/iCamp/actions), [GitHub artifact documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

## Proposed Build 212

**iCamp 212 — Runner Capacity Escalation Receipts, Owner-Signed SLA Decisions & Long-Term CI Evidence Custody Review.** Implement an explicit owner-reviewed resolution path for provider diagnostics, any expiring artifacts, and signed monitoring decisions, without circumventing required gates.
