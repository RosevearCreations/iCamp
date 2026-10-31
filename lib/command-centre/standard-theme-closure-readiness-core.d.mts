export interface StandardThemeClosureReadinessInput {
  notes?: string;
  areas: Array<{ key: string; reviewed: boolean }>;
  devices: Array<{
    key: string;
    result: "not_tested" | "passed" | "issue";
    correction: string;
    retest: "not_retested" | "looks_fixed" | "still_fails";
  }>;
  accessibility: Array<{
    key: string;
    result: "not_tested" | "passed" | "needs_fix";
    followUp: "open" | "planned" | "owner_retested";
    priority: "normal" | "urgent";
  }>;
}
export interface StandardThemeClosureReadiness {
  areasReviewed: number;
  totalAreas: number;
  devicePasses: number;
  totalDevices: number;
  accessibilityPasses: number;
  totalAccessibility: number;
  blockers: string[];
  canRequestIndependentReview: boolean;
}
export function summarizeStandardThemeClosureReadiness(
  input: StandardThemeClosureReadinessInput,
): StandardThemeClosureReadiness;
export function prepareIndependentOwnerAcceptanceRequest(
  input: StandardThemeClosureReadinessInput,
  now?: Date,
): { ready: boolean; blockers: string[]; text: string };
