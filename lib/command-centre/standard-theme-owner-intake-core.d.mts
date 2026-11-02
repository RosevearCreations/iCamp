import type { StandardThemeClosureReadinessInput } from "./standard-theme-closure-readiness-core.mjs";

export const STANDARD_OWNER_INTAKE_VERSION: number;
export const STANDARD_OWNER_SUBMISSION_ENABLED: false;
export interface StandardThemeOwnerIntakeInput {
  preparerId: string;
  intendedReviewerId: string;
  campgroundId: string;
  sourceSha: string;
  sourceReference: string;
  review: StandardThemeClosureReadinessInput & {
    accessibility: Array<
      StandardThemeClosureReadinessInput["accessibility"][number] & {
        note?: string;
        nextStep?: string;
      }
    >;
  };
}
export function prepareStandardThemeOwnerIntake(
  input: StandardThemeOwnerIntakeInput,
  now?: Date,
): {
  ready: boolean;
  blockers: string[];
  packet: Record<string, unknown>;
  json: string;
};
export interface StandardThemeImportedDecision {
  id: string;
  campgroundId: string;
  preparedByUserId: string;
  reviewerUserId: string;
  sourceSha: string;
  decision: "pending" | "rejected" | "recheck" | "approved";
  occurredAt: string;
  evidenceReference: string;
  note: string;
  authenticity: "UNVERIFIED_IMPORTED_HISTORY";
  needsSourceRecheck: boolean;
}
export function readStandardThemeDecisionLedger(
  raw: string,
  scope: { campgroundId: string; preparerId: string; sourceSha: string },
): StandardThemeImportedDecision[];
export function standardThemeDecisionReadbackSummary(
  entries: StandardThemeImportedDecision[],
): {
  total: number;
  claimedApproved: number;
  recheck: number;
  authoritativeDecisionRecorded: false;
};
