export function normalizeRecurrenceReview(raw: Record<string, unknown>): {
  id: string;
  acceptanceId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  evidenceReference: string;
  reviewNote: string;
};
export function normalizeRecurrenceDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  recurrenceReviewId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  decisionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  decisionNote: string;
};
