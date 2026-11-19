export const SYSOP_TELEMETRY_PATH: string;
export const SYSOP_TELEMETRY_SCHEMA: string;
export function handleSysopTelemetry(input: {
  request: Request;
  env?: Record<string, string | undefined>;
  appId: string;
  sourceCommit?: string;
  nowMs?: number;
}): Promise<Response>;
