# iCamp Build 206 — critical-path cache, locked installs and trend acceptance

## Change

Build 205 measured the five protected checks using genuine GitHub job
timestamps. In the first 12 historical runs, queue p90 ranged from 54–121
seconds, while job runtime p90 ranged from 17–192 seconds. This release
addresses repeated dependency downloads in the three existing `CI` jobs.

- Commit the npm v3 dependency lockfile with SHA-512 integrity for the complete
  dependency graph; existing package versions and application code remain
  unchanged.
- In Verify, Browser end-to-end and Database migrations, enable
  `actions/setup-node@v7`'s built-in `cache: npm`, keyed by
  `package-lock.json`. This caches npm's **download store only**, never
  `node_modules` or executable workspaces.
- Continue running a clean `npm ci --ignore-scripts` in **each job**, with
  `--prefer-offline` to use integrity-checked cached downloads. Skip npm's
  *automatic install-time* advisory query, and retain the separate mandatory
  `npm audit --omit=dev --audit-level=high` check and full audit artifact.
- Retain all five protected checks, the browser and PostgreSQL test scopes,
  CodeQL's independent weekly scan and PR/main runs. Do not add workflows or
  weaken job timeouts, disable verification, cache a database, or share
  secrets across jobs.

The `build206:cache-contract` verifier enforces this graph and rejects
restoring unpinned installs, losing cache keys, removing migration/audit gates,
or using missing/unapproved tarball integrity claims. The existing Build 204
and Build 205 checks continue running.

## Queue SLA trend acceptance

The existing Build 205 evidence collector now also compares the **two most
recent** successful job samples against the **two previous** successful
samples for each of the five protected checks. It uses original GitHub Actions
start/end timestamps and retains the same 12-run bound and artifact.

Results:

- `MONITORING_TREND_ACCEPTABLE`: both windows exist, no hard SLA warning and
  no significant 25% + 30-second queue or runtime regression.
- `OWNER_PERFORMANCE_REVIEW_REQUIRED`: a recent monitoring budget is exceeded
  or a material slowdown is observed. Consult slow steps and network/cache
  misses; no automatic bypass or rerun is authorized.
- `INSUFFICIENT_TREND_EVIDENCE`: fewer than two successful measurements in
  either window. Never label missing data as accepted.

Global states `MONITORING_TRENDS_ACCEPTABLE`, `REVIEW_REQUIRED`, and
`INSUFFICIENT_WINDOW_EVIDENCE` summarize the five checks. These are owner
**performance review** indicators; neither a passing trend nor a fast cache
grants release, external source custody, owner consent, or Comms Hub TEST
handshake authority. All protected release checks must pass independently.

## Review after promotion

1. Inspect `CI / Verify`'s Build 206 trend line and the 14-day
   `build205-ci-runtime-evidence` artifact for the exact release commit.
2. Compare queue and elapsed job p90 against Build 205 and the next warm-cache
   run; do not claim a measured speedup before comparable warm runs exist.
3. If a job slows, inspect cache hit/miss, lockfile hashes and GitHub's runner
   queue. Re-run only after diagnosis with an unchanged protected check set.
4. Retain five successful PR and main GitHub checks, then verify Vercel READY,
   exact main SHA and production `/api/version` and `/api/health/ready`.

No TEST peer enrollment, live Comms Hub connection or account activation is
part of this CI build. Build 203's independent approval remains on HOLD.
