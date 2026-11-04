export interface PerformanceBudget {
  label: string;
  p95Ms: number;
  sampleMinimum: number;
}

export const RESILIENCE_BUDGETS: Readonly<{
  health: PerformanceBudget;
  readiness: PerformanceBudget;
  database: PerformanceBudget;
}>;

export function requireIsolatedDrill(input: {
  environment: string | undefined;
  databaseUrl: string | undefined;
  acknowledgment: string | undefined;
}): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export function summarizePerformance(
  samples: number[],
  budget: PerformanceBudget,
): {
  samples: number;
  p95Ms: number | null;
  maxMs: number | null;
  budgetMs: number;
  status: "insufficient_evidence" | "pass" | "breach";
};

export function summarizeRestore(input: {
  source: Record<string, number>;
  restored: Record<string, number>;
  sourceCapturedAt: string;
  restoreCompletedAt: string;
  elapsedMs: number;
  deniedCrossTenantRows: number;
}): {
  status: "pass" | "fail";
  sourceCapturedAt: string;
  restoreCompletedAt: string;
  measuredRestoreMs: number;
  sourceCounts: Record<string, number>;
  restoredCounts: Record<string, number>;
  unauthorizedCampgroundRows: number;
  productionRpo: "not_measured";
  productionRto: "not_measured";
  evidenceScope: "isolated_local_postgresql_test_only";
};
