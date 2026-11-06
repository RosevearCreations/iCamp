import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheState } from "./build207-cache-witness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS = 120;

export function analyzeCacheBenefit(baseline) {
  const { coldPR, warmPR, coldMainOutlier } = baseline.stages;
  if (
    [coldPR, warmPR, coldMainOutlier].some(
      (record) => record.result !== "success",
    )
  ) {
    throw new Error("BASELINE_REQUIRED_JOBS_NOT_SUCCESSFUL");
  }
  if (
    coldPR.browserCache !== "MISS" ||
    warmPR.browserCache !== "HIT" ||
    coldMainOutlier.browserCache !== "MISS"
  ) {
    throw new Error("BASELINE_CACHE_HIT_MISS_PROOF_INVALID");
  }
  const savedJobSeconds = coldPR.jobSeconds - warmPR.jobSeconds;
  const savedInstallSecondsAfterRestore =
    coldPR.chromiumInstallSeconds -
    (warmPR.browserRestoreSeconds + warmPR.chromiumInstallSeconds);
  return {
    schema: "icamp.build208.cache-benefit.v1",
    sampleCountPerClass: 1,
    savedJobSeconds,
    savedInstallSecondsAfterRestore,
    coldMainInstallSeconds: coldMainOutlier.chromiumInstallSeconds,
    coldMainAptFetchSeconds: coldMainOutlier.aptFetchSeconds,
    coldMainAptSource: coldMainOutlier.ubuntuMirror,
    status: "PROVISIONAL_TWO_PR_RUNS_NOT_ACCEPTED_SLA",
    cacheHitGrantsReleaseApproval: false,
  };
}

export function browserCacheProof({ cacheHit, restoreCompleted }) {
  if (cacheHit === "" && restoreCompleted === true) return "MISS";
  return cacheState(cacheHit);
}

export function buildInstallEvidence({
  startedAtMs,
  completedAtMs,
  installOutcome,
  browserCache,
  npmCache,
  runnerOSVersion,
  runId,
  commit,
  benefit,
}) {
  if (
    !Number.isFinite(startedAtMs) ||
    startedAtMs <= 0 ||
    !Number.isFinite(completedAtMs) ||
    completedAtMs < startedAtMs
  ) {
    throw new Error("MISSING_RELIABLE_INSTALL_CLOCK");
  }
  if (!["success", "failure", "cancelled"].includes(installOutcome)) {
    throw new Error("MISSING_INSTALL_OUTCOME");
  }
  const elapsedSeconds = Math.round((completedAtMs - startedAtMs) / 1000);
  return {
    schema: "icamp.build208.chromium-runner-diagnostics.v1",
    source: "SAME_JOB_UTC_WALL_CLOCK",
    runId: runId ?? null,
    commit: commit ?? null,
    runnerOSVersion: runnerOSVersion || "UNVERIFIED",
    browserCache,
    npmCache,
    installOutcome,
    installSeconds: elapsedSeconds,
    diagnosticState:
      installOutcome !== "success"
        ? "INSTALL_FAILED_REQUIRED_GATE_MUST_FAIL"
        : elapsedSeconds > CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS
          ? "COLD_RUNNER_INSTALL_REVIEW_REQUIRED"
          : "WITHIN_OBSERVATION_BUDGET",
    monitoringBudgetSeconds: CHROMIUM_INSTALL_REVIEW_BUDGET_SECONDS,
    baselineBenefit: benefit,
    allBrowserTestsStillRequired: true,
    systemPackagesNeverCached: true,
    releaseApprovalGranted: false,
  };
}

export function formatInstallSummary(evidence) {
  return [
    "### Build 208 — Chromium cold-runner evidence",
    "",
    `- Runner OS: **${evidence.runnerOSVersion}**; npm cache: **${evidence.npmCache}**; browser cache: **${evidence.browserCache}**.`,
    `- Required Chromium installer outcome: **${evidence.installOutcome}**; elapsed: **${evidence.installSeconds}s** (review threshold ${evidence.monitoringBudgetSeconds}s).`,
    `- Diagnostic: **${evidence.diagnosticState}**. Failure or cancellation never becomes approval.`,
    `- Reviewed Build 207 comparison (one PR sample each): cold→warm browser job saved **${evidence.baselineBenefit.savedJobSeconds}s**; browser restore plus install saved **${evidence.baselineBenefit.savedInstallSecondsAfterRestore}s**. Evidence is provisional, not an accepted SLA.`,
    `- Original Ubuntu 26.04 main outlier: **${evidence.baselineBenefit.coldMainInstallSeconds}s** installing dependencies; **${evidence.baselineBenefit.coldMainAptFetchSeconds}s** fetching packages from ${evidence.baselineBenefit.coldMainAptSource}.`,
    "- Every protected check, system dependency installation, and the complete Playwright suite remain required.",
    "",
  ].join("\n");
}

async function main() {
  if (process.argv.includes("--start")) {
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV_REQUIRED");
    await appendFile(
      process.env.GITHUB_ENV,
      `ICAMP_CHROMIUM_INSTALL_STARTED_MS=${Date.now()}\n`,
    );
    console.log("Build 208: starting mandatory Chromium installation clock.");
    return;
  }
  if (!process.argv.includes("--finish"))
    throw new Error("START_OR_FINISH_REQUIRED");
  const baseline = JSON.parse(
    await readFile(
      resolve(root, "fixtures/build208-browser-cache-baseline.json"),
      "utf8",
    ),
  );
  const osRelease = readFileSync("/etc/os-release", "utf8");
  const runnerOSVersion = osRelease.match(/^VERSION_ID="?([^"\n]+)"?/m)?.[1];
  const evidence = buildInstallEvidence({
    startedAtMs: Number(process.env.ICAMP_CHROMIUM_INSTALL_STARTED_MS),
    completedAtMs: Date.now(),
    installOutcome: process.env.ICAMP_CHROMIUM_INSTALL_OUTCOME,
    browserCache: browserCacheProof({
      cacheHit: process.env.ICAMP_BROWSER_CACHE_HIT,
      restoreCompleted:
        process.env.ICAMP_BROWSER_CACHE_RESTORE_COMPLETED === "true",
    }),
    npmCache: cacheState(process.env.ICAMP_NPM_CACHE_HIT),
    runnerOSVersion,
    runId: process.env.GITHUB_RUN_ID,
    commit: process.env.GITHUB_SHA,
    benefit: analyzeCacheBenefit(baseline),
  });
  if (evidence.runnerOSVersion !== "24.04") {
    throw new Error(
      `UNREVIEWED_CHROMIUM_RUNNER_VERSION_${evidence.runnerOSVersion}`,
    );
  }
  const path = resolve(root, "artifacts/build208-chromium-install.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(evidence, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      formatInstallSummary(evidence),
    );
  }
  console.log(JSON.stringify(evidence));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error("Build 208 browser timing evidence failed:", error.message);
    process.exitCode = 1;
  });
}
