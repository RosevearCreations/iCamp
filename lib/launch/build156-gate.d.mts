export type LaunchState = "NOT_VERIFIED" | "BLOCKED" | "OWNER_REPORTED_READY";
export const LAUNCH_CHECKS: readonly (readonly [string, string])[];
export const LAUNCH_STATES: readonly LaunchState[];
export function blankLaunch(): Record<string, LaunchState>;
export function launchReport(input: Record<string, unknown>): {
  build: number;
  environment: string;
  checks: Record<string, LaunchState>;
  independent_verification: "REQUIRED";
  external_services_enabled: false;
  billing_live: false;
  public_launch_authorized: false;
  integration_connection: "DISCONNECTED";
  integration_gate: "HOLD";
};
