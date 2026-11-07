# iCamp Build 210 — Queue saturation attribution, historical Chromium evidence and release latency triage

## Four reviewed historical artifacts

Build 209's bounded 12-run history eventually contained three warm samples and **no cold sample**, even though previous releases had verified cold evidence. Build 210 preserves four directly reviewed GitHub Actions artifact fingerprints in [`fixtures/build210-reviewed-chromium-history.json`](../fixtures/build210-reviewed-chromium-history.json):

| Source run / browser job | Runner OS | Browser cache | Required Chromium install | Original timing artifact |
| --- | --- | --- | ---: | --- |
| [42283370957 / 128117835590](https://github.com/RosevearCreations/iCamp/actions/runs/42283370957/job/128117835590) | 24.04 | MISS | 27s | [13536566569](https://github.com/RosevearCreations/iCamp/actions/runs/42283370957/artifacts/13536566569) |
| [42283842267 / 128119443302](https://github.com/RosevearCreations/iCamp/actions/runs/42283842267/job/128119443302) | 24.04 | MISS | 24s | [13536442191](https://github.com/RosevearCreations/iCamp/actions/runs/42283842267/artifacts/13536442191) |
| [42314169541 / 128222624336](https://github.com/RosevearCreations/iCamp/actions/runs/42314169541/job/128222624336) | 24.04 | HIT | 13s | [13550410411](https://github.com/RosevearCreations/iCamp/actions/runs/42314169541/artifacts/13550410411) |
| [42314518303 / 128223755510](https://github.com/RosevearCreations/iCamp/actions/runs/42314518303/job/128223755510) | 24.04 | HIT | 16s | [13548984321](https://github.com/RosevearCreations/iCamp/actions/runs/42314518303/artifacts/13548984321) |

These are separate actual GitHub-hosted browser jobs, with successful outcomes, original run/job IDs, head SHAs, artifact IDs and reviewed SHA-256 ZIP artifact digests. The archive is a **reviewed reference fixture, not immutable third-party custody**. GitHub-hosted artifacts expire after 14 days; recorded digests are fingerprints, not substitutes for the expired original ZIP. Original review date: November 6, 2026.

Two cold installs yielded a p50 of **24 seconds** and p90 of **27 seconds**; two warm installs a p50 of **13 seconds** and p90 of **16 seconds**. The observed p50 difference is **11 seconds**, but two per class is not a statistically accepted benefit or owner SLA. This comparison covers Chromium install elapsed only, not job queue, overall release duration or Vercel deployment. Linux packages remain mandatory even on a warm browser cache.

### Safe rolling evidence rules

- Continue to read at most four recent completed browser logs per Build 209's bounded source procedure.
- Merge recent verified job-log witnesses with the four pinned, successfully completed GitHub artifacts by **run ID and job ID**. Identical records deduplicate; a conflicting cache state, OS version or duration quarantines that job and flags `SOURCE_CONFLICT_REQUIRES_REVIEW`.
- Reject invalid digests, impossible durations, duplicate pinned source identities, wrong runner OS and unsuccessful jobs. An unreadable log cannot silently erase a reviewed older observation or be counted as a success.
- The sample archive is never a release authorization, owner decision or trusted Comms Hub handshake.

## Queue saturation attribution: observed versus unknown

Build 210 uses the existing GitHub Actions job timestamps to retain per-check queue p90, job counts, observed queue budget breaches and up to ten overlapping-run pairs. The **600-second queue review budget** is a diagnostic threshold, not a timeout. It also preserves the eight largest concrete queue exceptions with original run/job IDs.

Queue wait and overlapping workflow runs are **possible contention indicators**. Neither proves GitHub-hosted runner pool saturation, an Ubuntu mirror stall, GitHub service congestion or a specific queue root cause. We do not have independent runner-pool telemetry to make that attribution. Any true source-level diagnosis must be supported by logs or runner capacity evidence before action.

## Protected promotion exception triage

The existing five-check release baseline continues to calculate PR/main elapsed gate time independently. Build 210 adds a read-only exception list for:

1. Actually unsuccessful protected jobs, using the completed job conclusion.
2. Observed queue times exceeding the 600-second per-check review budget.
3. **Complete successful five-check cohorts** exceeding the 900-second PR/main release-gate review budget.

Incomplete cohorts are explicitly excluded rather than labelled failures or releases; they can reflect the limited history window. All exceptions are for an operator to review: none automatically retries a workflow, accepts an SLA, authorizes a release or closes a Comms Hub TEST gate.

No workflow, event trigger, required job, branch protection, database migration, secret scan, CodeQL analysis, Playwright browser test, exact-lock cache or mandatory Chromium installation was removed. The `CI / Verify` job runs an additional Build 210 contract assertion and writes the Build 210 section to the existing Build 205 JSON artifact and step summary. No extra GitHub Actions workflow run is introduced.

## Owner follow-up

1. Open the new Build 210 PR and `main` CI run, then download the **build205-ci-runtime-evidence** artifact from `CI / Verify`.
2. Review `build210.retainedCacheHistory`, its source conflicts and 24.04 cold/warm counts.
3. Review `build210.queueSaturation.largestObservedQueueDelays` and the original job links; do not assume slow apt mirrors from queue timing.
4. Review `build210.latencyExceptions` and decide which confirmed exceptions warrant investigation. The original Build 207 563-second `azure.archive.ubuntu.com` stall remains separately pinned in Build 209.
5. Keep the original-issuer Comms Hub TEST handshake authorization on HOLD until its separate signed owner and witness requirements are satisfied.

**Next proposed Build 211:** CI Runner Contention Source Verification, Expiring Artifact Renewal & Owner SLA Acceptance Evidence Pack.
