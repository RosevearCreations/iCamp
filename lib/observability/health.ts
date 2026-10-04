import {
  getRuntimeConfig,
  validateRuntimeConfig,
  type AppEnvironment,
} from "@/lib/config/runtime";

export type HealthStatus = "operational" | "degraded" | "unavailable";

export interface PublicHealthSnapshot {
  status: HealthStatus;
  service: string;
  environment: AppEnvironment;
  timestamp: string;
}

export interface VersionSnapshot {
  service: string;
  version: string;
  environment: AppEnvironment;
  buildSha: string;
  releaseId: string;
  deployedAt: string | null;
}

export interface ReadinessSnapshot {
  status: "ready" | "not-ready";
  timestamp: string;
  checks: {
    configuration: "ok" | "failed";
  };
}

export function getPublicHealthSnapshot(): PublicHealthSnapshot {
  const config = getRuntimeConfig();

  return {
    status: "operational",
    service: config.appName,
    environment: config.environment,
    timestamp: new Date().toISOString(),
  };
}

export function getVersionSnapshot(): VersionSnapshot {
  const config = getRuntimeConfig();

  return {
    service: config.appName,
    version: config.appVersion,
    environment: config.environment,
    buildSha: config.buildSha,
    releaseId: config.releaseId,
    deployedAt: config.deployedAt,
  };
}

export function getReadinessSnapshot(): ReadinessSnapshot {
  const result = validateRuntimeConfig();

  return {
    status: result.ok ? "ready" : "not-ready",
    timestamp: new Date().toISOString(),
    checks: {
      configuration: result.ok ? "ok" : "failed",
    },
  };
}

export function getSafeItSnapshot() {
  const config = getRuntimeConfig();
  const readiness = getReadinessSnapshot();

  return {
    health: readiness.status === "ready" ? "operational" : "degraded",
    environment: config.environment,
    version: config.appVersion,
    buildSha: config.buildSha,
    releaseId: config.releaseId,
    deployedAt: config.deployedAt,
    featureFlags: {
      itAnalysisWorkspace: config.featureFlags.itAnalysisWorkspace,
      publicStatusPage: config.featureFlags.publicStatusPage,
      externalWatchdog: config.featureFlags.externalWatchdog,
    },
    readiness: readiness.checks,
  } as const;
}
