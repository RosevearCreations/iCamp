export const appEnvironments = [
  "development",
  "test",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof appEnvironments)[number];

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RuntimeConfig {
  appName: string;
  appVersion: string;
  environment: AppEnvironment;
  buildSha: string;
  releaseId: string;
  deployedAt: string | null;
  logLevel: LogLevel;
  featureFlags: {
    itAnalysisWorkspace: boolean;
    publicStatusPage: boolean;
    externalWatchdog: boolean;
  };
}

function parseEnvironment(
  value: string | undefined,
  nodeEnv: string | undefined,
): AppEnvironment {
  if (value && appEnvironments.includes(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  if (nodeEnv === "production") {
    return "production";
  }

  if (nodeEnv === "test") {
    return "test";
  }

  return "development";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new Error("Boolean environment value must be true/false or 1/0.");
}

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value ?? "info";

  if (
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized;
  }

  throw new Error("ICAMP_LOG_LEVEL must be debug, info, warn, or error.");
}

function parseOptionalIsoDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new Error("ICAMP_DEPLOYED_AT must be an ISO-compatible date/time.");
  }

  return new Date(parsed).toISOString();
}

function normalizeBuildSha(value: string | undefined): string {
  const buildSha = value?.trim();

  if (!buildSha) {
    return "local";
  }

  if (!/^[a-zA-Z0-9._-]{4,80}$/.test(buildSha)) {
    throw new Error("Build SHA/reference contains unsupported characters.");
  }

  return buildSha;
}

export function getRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const environment = parseEnvironment(env.ICAMP_APP_ENV, env.NODE_ENV);

  return Object.freeze({
    appName: env.ICAMP_APP_NAME?.trim() || "iCamp",
    appVersion: env.ICAMP_APP_VERSION?.trim() || "0.1.0",
    environment,
    buildSha: normalizeBuildSha(
      env.ICAMP_BUILD_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA,
    ),
    releaseId: env.ICAMP_RELEASE_ID?.trim() || "local",
    deployedAt: parseOptionalIsoDate(env.ICAMP_DEPLOYED_AT),
    logLevel: parseLogLevel(env.ICAMP_LOG_LEVEL),
    featureFlags: Object.freeze({
      itAnalysisWorkspace: parseBoolean(
        env.ICAMP_FEATURE_IT_ANALYSIS_WORKSPACE,
        true,
      ),
      publicStatusPage: parseBoolean(
        env.ICAMP_FEATURE_PUBLIC_STATUS_PAGE,
        true,
      ),
      externalWatchdog: parseBoolean(
        env.ICAMP_FEATURE_EXTERNAL_WATCHDOG,
        false,
      ),
    }),
  });
}

export function validateRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; config: RuntimeConfig } | { ok: false; errors: string[] } {
  try {
    return { ok: true, config: getRuntimeConfig(env) };
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error ? error.message : "Unknown configuration error.",
      ],
    };
  }
}

export function assertRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const result = validateRuntimeConfig(env);

  if (!result.ok) {
    throw new Error(
      `Invalid iCamp runtime configuration: ${result.errors.join(" ")}`,
    );
  }

  return result.config;
}
