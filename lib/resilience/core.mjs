export const RESILIENCE_BUDGETS = Object.freeze({
  health: Object.freeze({
    label: "Public health",
    p95Ms: 500,
    sampleMinimum: 20,
  }),
  readiness: Object.freeze({
    label: "Readiness",
    p95Ms: 750,
    sampleMinimum: 20,
  }),
  database: Object.freeze({
    label: "Scoped database read",
    p95Ms: 250,
    sampleMinimum: 20,
  }),
});

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function requireIsolatedDrill({
  environment,
  databaseUrl,
  acknowledgment,
}) {
  if (environment !== "test" || acknowledgment !== "ISOLATED_TEST_ONLY") {
    throw new Error(
      "Recovery drill requires test environment and explicit isolated-test acknowledgement.",
    );
  }
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Recovery drill requires a valid local PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !LOOPBACK.has(url.hostname) ||
    !["icamp_ci", "icamp_drill_source"].includes(
      decodeURIComponent(url.pathname.slice(1)),
    ) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Recovery drill source must be a named loopback-only synthetic test database.",
    );
  }
  return {
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

export function summarizePerformance(samples, budget) {
  if (
    !Array.isArray(samples) ||
    samples.some((v) => !Number.isFinite(v) || v < 0)
  ) {
    throw new Error(
      "Latency samples must be finite, nonnegative milliseconds.",
    );
  }
  if (
    !budget ||
    !Number.isFinite(budget.p95Ms) ||
    !Number.isInteger(budget.sampleMinimum)
  ) {
    throw new Error("Performance budget is invalid.");
  }
  const ordered = [...samples].sort((a, b) => a - b);
  const p95Ms = ordered.length
    ? ordered[Math.ceil(ordered.length * 0.95) - 1]
    : null;
  return {
    samples: ordered.length,
    p95Ms,
    maxMs: ordered.at(-1) ?? null,
    budgetMs: budget.p95Ms,
    status:
      ordered.length < budget.sampleMinimum
        ? "insufficient_evidence"
        : p95Ms <= budget.p95Ms
          ? "pass"
          : "breach",
  };
}

export function summarizeRestore({
  source,
  restored,
  sourceCapturedAt,
  restoreCompletedAt,
  elapsedMs,
  deniedCrossTenantRows,
}) {
  if (!source || !restored || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error("Recovery evidence is incomplete.");
  }
  const consistent =
    Object.keys(source).length > 0 &&
    Object.keys(source).every(
      (key) => Number.isInteger(source[key]) && source[key] === restored[key],
    );
  const isolated = deniedCrossTenantRows === 0;
  return {
    status: consistent && isolated ? "pass" : "fail",
    sourceCapturedAt,
    restoreCompletedAt,
    measuredRestoreMs: Math.round(elapsedMs),
    sourceCounts: source,
    restoredCounts: restored,
    unauthorizedCampgroundRows: deniedCrossTenantRows,
    // A single synthetic snapshot cannot establish a real backup schedule's RPO.
    productionRpo: "not_measured",
    productionRto: "not_measured",
    evidenceScope: "isolated_local_postgresql_test_only",
  };
}
