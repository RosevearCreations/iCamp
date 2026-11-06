# Build 207 — CI cache warm-run validation, browser reuse and throughput baseline

## Implementation

- All three independent CI jobs still perform integrity-locked `npm ci --ignore-scripts`, and each reports the **observed** `setup-node` npm cache hit/miss in its own GitHub job summary.
- The browser job restores only `~/.cache/ms-playwright`, scoped to the OS and an exact SHA-256-derived hash of the reviewed `package-lock.json`. There is no cross-version restore prefix. The workflow **always** runs `npx playwright install --with-deps chromium`, checks that Playwright's expected Chromium executable is present and runs every browser end-to-end test. A browser cache HIT is not a pass for an actual test.
- The three protected workflows and all five required checks stay intact: `CI / Verify`, `CI / Browser end-to-end`, `CI / Database migrations`, `Secret Scan / Gitleaks`, and `CodeQL / Analyze JavaScript and TypeScript`. Release authorization is unchanged.
- The existing Build 205 read-only timing artifact (`build205-ci-runtime-evidence`) now includes a Build 207 release-throughput baseline. For each SHA and stage (pull-request or main push), it measures from the earliest GitHub Actions workflow creation to the final successful completion of **all five** required checks. Incomplete or failed groups are excluded. Results show p50/p90 only when complete groups are observed; fewer than two groups remain explicitly **INSUFFICIENT**.

## Verification and interpretation

1. Inspect the **CI / Verify**, **CI / Browser end-to-end** and **CI / Database migrations** GitHub job summaries for `npm tarball cache: HIT` or `MISS`; the browser summary also shows its Chromium cache and installation evidence.
2. A cold PR run can legitimately show `MISS`; GitHub Actions cache branch and merge-ref scoping affect reuse. A subsequent run with a matching lockfile and cache scope must demonstrate `HIT` before the team can assert a warm-run result.
3. Download `build205-ci-runtime-evidence` from the CI run and review `throughput.stages.PR` and `.MAIN` along with `throughput.groups` for incomplete historical groups. These are GitHub protected-check completion times, **not** deployment-to-production or queue-wide throughput.
4. Compare cache-hit and cache-miss job durations before accepting improvement. If binary cache restoration costs more than download, remove the browser cache in a reviewed follow-up; Playwright's [CI guidance](https://playwright.dev/docs/ci#caching-browsers) notes browser cache restoration is often no faster than installation and does not cache Linux system dependencies.
5. Review `npm run build206:cache-contract`, `npm run build207:cache-contract`, `npm test`, formatter, linter, typecheck, production audit, browser and database gates, Gitleaks and CodeQL. The cache is only an optimization and never bypasses any of them.

## Trust boundary

Neither a green production deployment nor a cache hit authorizes the separate trusted Comms Hub TEST handshake. Original-issuer custody, independent witness and explicit TEST-scoped owner authorization remain separate HOLD conditions. No Comms Hub traffic, customer messages or device actions are introduced by Build 207.
