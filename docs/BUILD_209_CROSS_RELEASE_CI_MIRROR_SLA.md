# iCamp Build 209 — Cross-release cold/warm trend, mirror stall alerts and protected promotion SLA

## Evidence and scope

The existing CI `Verify` job now extends its Build 205 read-only GitHub Actions diagnostic. It inspects up to **four** most recent completed browser job logs (two requests concurrently; eight-second request timeout). Only the recognized Build 208 JSON witness with matching run ID, commit, install outcome and Ubuntu 24.04 version can qualify as measured cold/warm evidence. Raw job logs are not saved in the artifact. Missing, inaccessible, malformed or incomplete log records remain **UNAVAILABLE**, not successful cache hits.

The previous reviewed Build 207 baseline remains pinned in [`fixtures/build208-browser-cache-baseline.json`](../fixtures/build208-browser-cache-baseline.json):

| Original GitHub job | Browser cache | Chromium installation | Whole browser job | Source |
| --- | --- | ---: | ---: | --- |
| Build 207 PR cold | MISS | 17s | 84s | [run 42221352913 / job 127903905167](https://github.com/RosevearCreations/iCamp/actions/runs/42221352913/job/127903905167) |
| Build 207 PR warm | HIT | 9s | 79s | [run 42221880390 / job 127905696919](https://github.com/RosevearCreations/iCamp/actions/runs/42221880390/job/127905696919) |
| Build 207 `main` cold Ubuntu 26.04 | MISS | 580s | 651s | [run 42222247675 / job 127906880336](https://github.com/RosevearCreations/iCamp/actions/runs/42222247675/job/127906880336) |
| Build 208 PR cold Ubuntu 24.04 | MISS | 27s | — | [run 42283370957](https://github.com/RosevearCreations/iCamp/actions/runs/42283370957) |
| Build 208 `main` cold Ubuntu 24.04 | MISS | 24s | — | [run 42283842267](https://github.com/RosevearCreations/iCamp/actions/runs/42283842267) |

These are **individual observed runs, not statistical proof**. Build 209 never combines Ubuntu 26.04 with 24.04 for cold-versus-warm comparisons. Within one OS version, at least two verified successful cold and two verified successful warm browser installations are required before the cross-release trend is considered comparable. Even then the trend is not an owner-accepted SLA.

## Ubuntu apt mirror alert

The original GitHub job log explicitly identified `azure.archive.ubuntu.com` fetching 21.9 MB in **563 seconds** during a 580-second required Playwright installer run. Build 209 retains that source-specific, >120-second historical alert. If current job logs themselves contain an apt `Fetched ... in ...` statement and the actual Ubuntu mirror host, new alerts are recorded as current-source evidence. A slow `Install Chromium` step **alone** is not proof that a mirror caused it. Missing logs must not clear the historical alert.

## Protected release SLA review

Existing GitHub Actions metadata groups all five required checks by commit and release stage (`PR` or `MAIN`). Build 209 computes p90 elapsed gate time over only complete successful five-check groups. **900 seconds per stage** is a diagnostic review budget, not a job timeout or branch protection replacement. Fewer than three complete groups remain provisional; an over-budget p90 becomes `PROMOTION_SLA_REVIEW_REQUIRED`. GitHub check elapsed does not include Vercel production deployment or source handshake authorization.

No new workflow was introduced. CI triggers, the five protected checks, security scans, database migrations, `npx playwright install --with-deps chromium`, full Playwright browser tests, Ubuntu 24.04 browser isolation and exact-lock cache safety are unchanged. The existing `artifacts/build205-ci-runtime.json` and GitHub Step Summary gain a **Build 209** section; the Verify job runs the new fail-closed CI contract assertion. Monitoring source failures do not fabricate green evidence and do not waive test failures.

## Owner review and follow-up

1. Open GitHub Actions for the Build 209 `dev` PR and final `main` release. Download `build205-ci-runtime-evidence` from the `CI / Verify` job.
2. Inspect `build209.crossReleaseCache.byRunnerOS` and compare cold/warm samples **only on the same runner version**. Small samples remain under review.
3. Inspect `build209.ubuntuMirrorAlerts.confirmedAlerts`; follow each run and job ID to its original log before attributing cause.
4. Inspect `build209.protectedPromotionSLA.stages.PR` and `.MAIN`. A performance warning requests engineering review, not automatic release or owner acceptance.
5. Separate Comms Hub TEST signing and independent owner authorization remain on HOLD; successful CI is not a private connection.

**Next recommendation:** Build 210 — Protected CI Queue Saturation Attribution, Repeat Warm-Run Acceptance & Release Latency Exception Triage.
