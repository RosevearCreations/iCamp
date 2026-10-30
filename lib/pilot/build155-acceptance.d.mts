export type PilotState =
  "NOT_TESTED" | "BLOCKED" | "FAILED" | "PASSED_OWNER_REPORTED";

export const PILOT_AREAS: readonly (readonly [string, string])[];
export const PILOT_STATES: readonly PilotState[];
export function blankPilot(): Record<string, PilotState>;
export function summarizePilot(input: Record<string, unknown>): {
  build: number;
  fixture: string;
  results: Record<string, PilotState>;
  counts: Record<PilotState, number>;
  pilot_acceptance: "NOT_INDEPENDENTLY_VERIFIED";
  public_launch_authorized: false;
  production_activation_authorized: false;
};
