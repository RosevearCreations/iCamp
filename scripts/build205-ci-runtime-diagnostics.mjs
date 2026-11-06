import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
