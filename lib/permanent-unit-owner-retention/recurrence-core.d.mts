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
export function classifyRecurrenceFollowUp(
  decision: {
    decision_kind: string;
    reassessment_id?: string | null;
    next_due_at?: Date | string | null;
  },
  now?: Date,
): string;
export function normalizeIndependentReassessment(
  raw: Record<string, unknown>,
): {
  id: string;
  recurrenceDecisionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  assessmentKind: string;
  evidenceReference: string;
  assessmentNote: string;
};
