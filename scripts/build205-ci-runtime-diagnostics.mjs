import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS } from "./build208-browser-runtime-diagnostics.mjs";

// These are monitoring budgets, NOT replacements for protected job timeouts.
export const REQUIRED_CHECK_BUDGETS = Object.freeze({
  "CI / Verify": { queueSeconds: 600, runtimeSeconds: 960 },
  "CI / Browser end-to-end": { queueSeconds: 600, runtimeSeconds: 1140 },
  "CI / Database migrations": { queueSeconds: 600, runtimeSeconds: 840 },
  "Secret Scan / Gitleaks": { queueSeconds: 600, runtimeSeconds: 540 },
  "CodeQL / Analyze JavaScript and TypeScript": {
    queueSeconds: 600,
    runtimeSeconds: 1140,
  },
});

export const REQUIRED_WORKFLOWS = Object.freeze({
  CI: ["Verify", "Browser end-to-end", "Database migrations"],
  "Secret Scan": ["Gitleaks"],
  CodeQL: ["Analyze JavaScript and TypeScript"],
});

const MINIMUM_SAMPLES = 3;
const MAX_RUNS = 12;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function analyzeProtectedTrends(runJobs) {
  const comparisons = {};
  for (const [check, budget] of Object.entries(REQUIRED_CHECK_BUDGETS)) {
    const [workflowName, jobName] = check.split(" / ");
    const observations = runJobs
      .filter(({ run }) => run?.name === workflowName)
      .flatMap(({ run, jobs }) =>
        (jobs ?? [])
          .filter((job) => job.name === jobName && job.conclusion === "success")
          .map((job) => ({
            createdAt: Date.parse(run.created_at ?? ""),
            runId: run.id,
            queueSeconds: safeSeconds(run.created_at, job.started_at),
            runtimeSeconds: safeSeconds(job.started_at, job.completed_at),
          })),
      )
      .filter(
        (observation) =>
          Number.isFinite(observation.createdAt) &&
          observation.queueSeconds !== null &&
          observation.runtimeSeconds !== null,
      )
      .sort((a, b) => b.createdAt - a.createdAt || b.runId - a.runId);
    const latest = observations.slice(0, 2);
    const previous = observations.slice(2, 4);
    const recentQueue = percentile(
      latest.map((item) => item.queueSeconds),
      0.9,
    );
    const formerQueue = percentile(
      previous.map((item) => item.queueSeconds),
      0.9,
    );
    const recentRuntime = percentile(
      latest.map((item) => item.runtimeSeconds),
      0.9,
    );
    const formerRuntime = percentile(
      previous.map((item) => item.runtimeSeconds),
      0.9,
    );
    const enough = latest.length === 2 && previous.length === 2;
    const regressed =
      enough &&
      (recentQueue > budget.queueSeconds ||
        recentRuntime > budget.runtimeSeconds ||
        (recentQueue > formerQueue * 1.25 && recentQueue - formerQueue >= 30) ||
        (recentRuntime > formerRuntime * 1.25 &&
          recentRuntime - formerRuntime >= 30));
    comparisons[check] = {
      recentSampleCount: latest.length,
      previousSampleCount: previous.length,
      recentQueueP90Seconds: recentQueue,
      previousQueueP90Seconds: formerQueue,
      recentRuntimeP90Seconds: recentRuntime,
      previousRuntimeP90Seconds: formerRuntime,
      status: !enough
        ? "INSUFFICIENT_TREND_EVIDENCE"
        : regressed
          ? "OWNER_PERFORMANCE_REVIEW_REQUIRED"
          : "MONITORING_TREND_ACCEPTABLE",
    };
  }
  const statuses = Object.values(comparisons).map((item) => item.status);
  return {
    schema: "icamp.build206.ci-trend-acceptance.v1",
    state: statuses.includes("OWNER_PERFORMANCE_REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED"
      : statuses.includes("INSUFFICIENT_TREND_EVIDENCE")
        ? "INSUFFICIENT_WINDOW_EVIDENCE"
        : "MONITORING_TRENDS_ACCEPTABLE",
    window: "TWO_RECENT_VS_TWO_PRIOR_COMPLETED_SUCCESSFUL_JOBS",
    checks: comparisons,
    releaseGateChanged: false,
    acceptedByOwner: false,
  };
}

export function safeSeconds(start, end) {
  const first = Date.parse(start ?? "");
  const last = Date.parse(end ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
    return null;
  }
  return Math.round((last - first) / 1000);
}

export function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1];
}

// Read-only time-to-five-protected-checks, measured from GitHub's recorded
// workflow creation until the last required job completion. It does not include
// Vercel deployment time or confer a production/TEST handshake authorization.
export function analyzeReleaseThroughput(runJobs) {
  const grouped = new Map();
  for (const { run, jobs } of runJobs) {
    if (!Object.hasOwn(REQUIRED_WORKFLOWS, run?.name)) continue;
    if (!run.head_sha || !["push", "pull_request"].includes(run.event))
      continue;
    const stage =
      run.event === "push" && run.head_branch === "main"
        ? "MAIN"
        : run.event === "pull_request"
          ? "PR"
          : null;
    if (!stage) continue;
    const key = `${stage}:${run.head_sha}`;
    if (!grouped.has(key)) {
      grouped.set(key, { stage, commit: run.head_sha, workflows: new Map() });
    }
    const group = grouped.get(key);
    const previous = group.workflows.get(run.name);
    if (
      !previous ||
      Date.parse(run.created_at ?? "") >
        Date.parse(previous.run.created_at ?? "")
    ) {
      group.workflows.set(run.name, { run, jobs: jobs ?? [] });
    }
  }

  const groups = [...grouped.values()].map(({ stage, commit, workflows }) => {
    const eligible = [];
    const missing = [];
    for (const [workflow, names] of Object.entries(REQUIRED_WORKFLOWS)) {
      const evidence = workflows.get(workflow);
      for (const name of names) {
        const job = evidence?.jobs.find((item) => item.name === name);
        if (
          evidence?.run.status !== "completed" ||
          evidence.run.conclusion !== "success" ||
          job?.conclusion !== "success" ||
          safeSeconds(evidence.run.created_at, job.completed_at) === null
        ) {
          missing.push(`${workflow} / ${name}`);
        } else {
          eligible.push({ run: evidence.run, job });
        }
      }
    }
    const first =
      eligible.length === 5
        ? Math.min(...eligible.map(({ run }) => Date.parse(run.created_at)))
        : null;
    const last =
      eligible.length === 5
        ? Math.max(...eligible.map(({ job }) => Date.parse(job.completed_at)))
        : null;
    return {
      stage,
      commit,
      state: missing.length
        ? "INCOMPLETE_REQUIRED_GATES"
        : "ALL_FIVE_CHECKS_OBSERVED",
      gateSeconds: first === null ? null : Math.round((last - first) / 1000),
      missing,
      runIds: [...new Set(eligible.map(({ run }) => run.id))],
    };
  });
  const stages = Object.fromEntries(
    ["PR", "MAIN"].map((stage) => {
      const seconds = groups
        .filter((item) => item.stage === stage && item.gateSeconds !== null)
        .map((item) => item.gateSeconds);
      return [
        stage,
        {
          completedPromotions: seconds.length,
          p50Seconds: percentile(seconds, 0.5),
          p90Seconds: percentile(seconds, 0.9),
          state:
            seconds.length >= 2
              ? "OBSERVED_BASELINE"
              : "INSUFFICIENT_COMPLETE_PROMOTIONS",
        },
      ];
    }),
  );
  return {
    schema: "icamp.build207.release-throughput.v1",
    measurement: "GITHUB_FIVE_REQUIRED_GATES_ONLY",
    observedGroups: groups.length,
    stages,
    groups,
    includesVercelDeployment: false,
    productionReleaseAuthorized: false,
    commsHandshakeAuthorized: false,
  };
}

export function analyzeChromiumInstallHistory(runJobs) {
  const samples = runJobs
    .filter(({ run }) => run?.name === "CI")
    .flatMap(({ run, jobs }) =>
      (jobs ?? [])
        .filter((job) => job.name === "Browser end-to-end")
        .flatMap((job) =>
          (job.steps ?? [])
            .filter((step) => step.name === "Install Chromium")
            .map((step) => ({
              runId: run.id,
              jobId: job.id,
              commit: run.head_sha,
              stage:
                run.event === "push" && run.head_branch === "main"
                  ? "MAIN"
                  : run.event === "pull_request"
                    ? "PR"
                    : "OTHER",
              outcome: step.conclusion ?? "UNVERIFIED",
              seconds: safeSeconds(step.started_at, step.completed_at),
              observedAt: Date.parse(run.created_at ?? ""),
            })),
        ),
    )
    .filter(
      (record) => record.seconds !== null && Number.isFinite(record.observedAt),
    )
    .sort((a, b) => b.observedAt - a.observedAt || b.runId - a.runId)
    .slice(0, 6);
  const outliers = samples.filter(
    (item) => item.seconds > CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS,
  );
  return {
    schema: "icamp.build208.chromium-install-history.v1",
    source: "GITHUB_ACTIONS_COMPLETED_JOB_STEP_TIMESTAMPS",
    sampleCount: samples.length,
    p90InstallSeconds: percentile(
      samples.map((item) => item.seconds),
      0.9,
    ),
    outlierCount: outliers.length,
    reviewBudgetSeconds: CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS,
    state:
      outliers.length > 0
        ? "COLD_RUNNER_INSTALL_REVIEW_REQUIRED"
        : samples.length < 3
          ? "INSUFFICIENT_HISTORICAL_INSTALL_STEPS"
          : "MONITORING_WITHIN_BUDGET",
    samples,
    // A completed GitHub job cannot establish why apt was slow. The original
    // Ubuntu mirror attribution is separately pinned to the Build 207 log.
    rootCauseInferredFromStepTimes: false,
    releaseApprovalGranted: false,
  };
}

export function analyzeHistory(runJobs, source = "GITHUB_ACTIONS_READ_ONLY") {
  const samples = [];
  for (const { run, jobs } of runJobs) {
    if (!Object.hasOwn(REQUIRED_WORKFLOWS, run?.name)) continue;
    for (const job of jobs ?? []) {
      if (!REQUIRED_WORKFLOWS[run.name].includes(job.name)) continue;
      const check = `${run.name} / ${job.name}`;
      const queueSeconds = safeSeconds(run.created_at, job.started_at);
      const runtimeSeconds = safeSeconds(job.started_at, job.completed_at);
      if (queueSeconds === null || runtimeSeconds === null) continue;
      samples.push({
        check,
        runId: run.id,
        jobId: job.id,
        commit: run.head_sha,
        event: run.event,
        branch: run.head_branch,
        conclusion: job.conclusion,
        queueSeconds,
        runtimeSeconds,
      });
    }
  }

  const checks = Object.fromEntries(
    Object.entries(REQUIRED_CHECK_BUDGETS).map(([name, budget]) => {
      const entries = samples.filter((sample) => sample.check === name);
      const queueP90Seconds = percentile(
        entries.map((item) => item.queueSeconds),
        0.9,
      );
      const runtimeP90Seconds = percentile(
        entries.map((item) => item.runtimeSeconds),
        0.9,
      );
      const overBudget =
        queueP90Seconds > budget.queueSeconds ||
        runtimeP90Seconds > budget.runtimeSeconds;
      return [
        name,
        {
          sampleCount: entries.length,
          queueP90Seconds,
          runtimeP90Seconds,
          budget,
          status: overBudget
            ? "SLA_BREACH_DIAGNOSTIC_ONLY"
            : entries.length < MINIMUM_SAMPLES
              ? "INSUFFICIENT_MEASUREMENTS"
              : "WITHIN_MONITORING_BUDGET",
          unsuccessfulRunIds: [
            ...new Set(
              entries
                .filter((item) => item.conclusion !== "success")
                .map((item) => item.runId),
            ),
          ],
          recovery: overBudget
            ? queueP90Seconds > budget.queueSeconds
              ? "Inspect GitHub runner availability, concurrency groups and queue age; keep required checks enabled."
              : "Inspect slow steps, dependency resolution and artifacts; retain every protected check."
            : entries.some((item) => item.conclusion !== "success")
              ? "Review failed/cancelled run logs and rerun only after understanding root cause."
              : entries.length < MINIMUM_SAMPLES
                ? "Collect additional completed GitHub Actions job timestamps before accepting an SLA."
                : "No intervention indicated; keep the protected release gate unchanged.",
        },
      ];
    }),
  );

  return {
    schema: "icamp.build205.ci-runtime-diagnostics.v1",
    source,
    measurementState: samples.length ? "HISTORICAL_SAMPLES" : "NO_MEASUREMENT",
    observedRuns: runJobs.length,
    sampledJobs: samples.length,
    checks,
    samples,
    trend: analyzeProtectedTrends(runJobs),
    throughput: analyzeReleaseThroughput(runJobs),
    chromiumHistory: analyzeChromiumInstallHistory(runJobs),
    protectedGatesModified: false,
    releaseApprovalGranted: false,
    commsHandshakeAuthorized: false,
  };
}

export async function fetchGitHubHistory({
  fetchImpl = fetch,
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com",
} = {}) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    throw new Error("MISSING_ACTIONS_READ_ACCESS");
  }
  const [owner, repo] = repository.split("/");
  const base = `${apiUrl}/repos/${owner}/${repo}/actions`;
  async function getJson(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(`${base}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`ACTIONS_READ_HTTP_${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  const response = await getJson(`/runs?status=completed&per_page=${MAX_RUNS}`);
  const recentRuns = (response.workflow_runs ?? [])
    .filter((run) => Object.hasOwn(REQUIRED_WORKFLOWS, run.name))
    .slice(0, MAX_RUNS);
  const runJobs = [];
  // Bound API pressure; never introduce another workflow or automatic rerun.
  for (let offset = 0; offset < recentRuns.length; offset += 3) {
    const batch = recentRuns.slice(offset, offset + 3);
    const results = await Promise.all(
      batch.map(async (run) => {
        const detail = await getJson(`/runs/${run.id}/jobs?per_page=100`);
        return { run, jobs: detail.jobs ?? [] };
      }),
    );
    runJobs.push(...results);
  }
  return runJobs;
}

export function formatSummary(evidence) {
  const lines = [
    "### Build 205 — protected CI runtime / queue diagnostic",
    "",
    `Measurement: **${evidence.measurementState}**; completed runs inspected: ${evidence.observedRuns}; matching jobs: ${evidence.sampledJobs}.`,
    "",
    "| Protected check | Samples | Queue p90 | Runtime p90 | Diagnostic |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  const diagnostics = [];
  for (const [name, data] of Object.entries(evidence.checks)) {
    lines.push(
      `| ${name} | ${data.sampleCount} | ${data.queueP90Seconds === null ? "—" : `${data.queueP90Seconds}s`} | ${data.runtimeP90Seconds === null ? "—" : `${data.runtimeP90Seconds}s`} | ${data.status} |`,
    );
    if (data.status !== "WITHIN_MONITORING_BUDGET") {
      diagnostics.push(`- ${name}: ${data.recovery}`);
    }
  }
  lines.push(
    "",
    ...diagnostics,
    "",
    `Build 206 trend state: **${evidence.trend.state}**. Requires two recent and two previous successful job samples per check; never substitutes for required release checks.`,
    "",
    "| Protected check | Prior queue p90 | Recent queue p90 | Prior runtime p90 | Recent runtime p90 | Trend review |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
  );
  for (const [name, trend] of Object.entries(evidence.trend.checks)) {
    const seconds = (value) => (value === null ? "—" : `${value}s`);
    lines.push(
      `| ${name} | ${seconds(trend.previousQueueP90Seconds)} | ${seconds(trend.recentQueueP90Seconds)} | ${seconds(trend.previousRuntimeP90Seconds)} | ${seconds(trend.recentRuntimeP90Seconds)} | ${trend.status} |`,
    );
  }
  lines.push(
    "",
    "### Build 207 — complete protected-gate throughput baseline",
    "",
    "| Gate stage | Completed SHA groups | p50 to five checks | p90 to five checks | Evidence state |",
    "| --- | ---: | ---: | ---: | --- |",
  );
  for (const [stage, data] of Object.entries(evidence.throughput.stages)) {
    lines.push(
      `| ${stage} | ${data.completedPromotions} | ${data.p50Seconds === null ? "—" : `${data.p50Seconds}s`} | ${data.p90Seconds === null ? "—" : `${data.p90Seconds}s`} | ${data.state} |`,
    );
  }
  lines.push(
    "",
    "### Build 208 — Chromium install history (GitHub job step timestamps)",
    "",
    `Samples: ${evidence.chromiumHistory.sampleCount}; p90: ${evidence.chromiumHistory.p90InstallSeconds ?? "—"}s; over ${evidence.chromiumHistory.reviewBudgetSeconds}s: ${evidence.chromiumHistory.outlierCount}; diagnostic: **${evidence.chromiumHistory.state}**.`,
    "",
    "Any mirror attribution must come from the specific job logs, not elapsed time alone. No required check or release approval is altered.",
  );
  lines.push(
    "",
    `Observed commit-stage groups: ${evidence.throughput.observedGroups}; only successful complete five-check groups count. GitHub gate elapsed excludes Vercel deployment and is never an owner release/Comms Hub authorization.`,
  );
  lines.push(
    "",
    "Budgets are diagnostic only. All five required GitHub checks, failure behavior, and release approvals remain unchanged.",
  );
  return `${lines.join("\n")}\n`;
}

export async function writeEvidence(evidence, { root = projectRoot } = {}) {
  const file = resolve(root, "artifacts/build205-ci-runtime.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(evidence, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, formatSummary(evidence));
  }
  return file;
}

async function main() {
  let evidence;
  try {
    const runJobs = await fetchGitHubHistory();
    evidence = analyzeHistory(runJobs);
  } catch (error) {
    // This must not be mistaken for a completed, green measurement or fake data.
    const reason =
      error instanceof Error &&
      /^(MISSING_ACTIONS_READ_ACCESS|ACTIONS_READ_HTTP_\d+)$/.test(
        error.message,
      )
        ? error.message
        : "GITHUB_ACTIONS_READ_UNAVAILABLE";
    evidence = {
      ...analyzeHistory([], "GITHUB_ACTIONS_HISTORY_UNAVAILABLE"),
      sourceFailure: reason,
    };
  }
  evidence.generatedAt = new Date().toISOString();
  evidence.context = {
    runId: process.env.GITHUB_RUN_ID ?? null,
    commit: process.env.GITHUB_SHA ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
  };
  const file = await writeEvidence(evidence);
  console.log(`Build 205 diagnostic: ${evidence.measurementState}; ${file}`);
  console.log(formatSummary(evidence));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      "Build 205 failed to preserve its CI evidence artifact:",
      error,
    );
    process.exitCode = 1;
  });
}
