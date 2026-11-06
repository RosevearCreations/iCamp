# iCamp Build 208 — Cold-runner Chromium recovery, cache benefit and protected CI review

## Original-issuer GitHub evidence (Build 207)

All cited runs below are GitHub Actions' own immutable job step records, not hypothetical samples.

| Build 207 browser check | GitHub source | Cache | Complete job | Chromium installation | Cache restore |
| --- | --- | --- | ---: | ---: | ---: |
| First PR | [run 42221352913, job 127903905167](https://github.com/RosevearCreations/iCamp/actions/runs/42221352913/job/127903905167) | MISS | 84s | 17s | 0s |
| Follow-up PR | [run 42221880390, job 127905696919](https://github.com/RosevearCreations/iCamp/actions/runs/42221880390/job/127905696919) | HIT | 79s | 9s | 4s |
| `main` production verification | [run 42222247675, job 127906880336](https://github.com/RosevearCreations/iCamp/actions/runs/42222247675/job/127906880336) | MISS | 651s | **580s** | 1s |

This is **one cold/warm PR pair**, not proof of a statistically reliable CI speedup. It indicates a five-second whole-job gain and four-second cache-restore-plus-installer gain. Playwright's [official CI documentation](https://playwright.dev/docs/ci#caching-browsers) cautions that browser binary caching can cost about as much as downloading; Linux packages are never cached by this mechanism.

The 580-second `main` install was not a Chromium CDN problem: the actual [GitHub job log](https://github.com/RosevearCreations/iCamp/actions/runs/42222247675/job/127906880336) reports 21.9 MB of Ubuntu font packages fetched in **9 minutes 23 seconds** from `azure.archive.ubuntu.com` on runner Ubuntu 26.04 (`resolute`), at 38.8 kB/s. The browser binaries subsequently downloaded within seconds. All five protected production checks eventually passed.

## Remediation and new evidence

1. The browser lane alone now pins `runs-on: ubuntu-24.04`, supported by [GitHub's official runner labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). Other isolated CI lanes remain unchanged.
2. The browser binary cache key now includes **Ubuntu 24.04 and the exact reviewed package-lock hash**. No Ubuntu 26.04 browser executable can be silently reused from the earlier cache key. No `restore-keys` fallback is allowed.
3. The untouched `npx playwright install --with-deps chromium` still runs on **every** browser job, on both cache HIT and MISS. Linux OS dependencies and all Chromium/Playwright end-to-end tests remain mandatory.
4. A start/end witness reports the observed installer duration, actual OS version, npm/browser HIT or MISS, install outcome and diagnostic state. Durations over 120 seconds generate a **review warning, not a bypass**. Every run uploads a 14-day `build208-chromium-install-evidence` artifact.
5. The existing Build 205 CI timing evidence gains a Build 208 historical Chromium-install series from real GitHub Actions job-step timestamps. The old 580-second outlier remains visible as a comparison; incomplete records are never treated as successful evidence.
6. The Build 208 contract verifier is run inside the existing `CI / Verify` job, with tests rejecting an unreviewed floating browser OS, mismatched OS cache key, a missing Chromium installation or removal of the browser harness.

## Limits and separate authority

- A green code release does **not** grant trusted Comms Hub TEST handshake authorization or start live communications. Original source issuer, witness and explicit TEST-scoped owner authorization are separate.
- This change does not alter test counts, security scanning, database migrations, production release approvals, or protected branch rules. Failure or cancellation of the mandatory Chromium installer still fails the browser job.
- A reproducible improvement requires several complete cold and warm runs on **the same Ubuntu image**. Previous Ubuntu 26.04 results are a historical baseline, not directly comparable with the first Ubuntu 24.04 run.
