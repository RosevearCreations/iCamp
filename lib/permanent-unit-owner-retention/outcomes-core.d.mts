export const outcomeKinds: string[];
export function normalizeOwnerReassessmentOutcome(
  raw: Record<string, unknown>,
): {
  id: string;
  reassessmentId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  outcomeKind: string;
  evidenceReference: string;
  outcomeNote: string;
};
export function normalizeOwnerOutcomeAcceptance(raw: Record<string, unknown>): {
  id: string;
  outcomeId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  acceptanceKind: string;
  auditNote: string;
};
