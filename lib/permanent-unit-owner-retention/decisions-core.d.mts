export const issueKinds: string[];
export const reviewKinds: string[];
export const decisionKinds: string[];
export function normalizeOversightReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  windowDays: number;
  issueKind: string;
  reviewKind: string;
  nextReviewAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function normalizeOversightDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewId: string;
  decisionKind: string;
  basisCaseId: string | null;
  nextDueAt: string | null;
  evidenceReference: string;
  decisionNote: string;
};
