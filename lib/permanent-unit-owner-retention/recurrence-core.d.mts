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
export function normalizeEvidenceGapAction(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  reassessmentId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  actionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  actionNote: string;
};
export function classifyEvidenceGap(
  reassessment: { assessed_at: Date | string },
  latestAction: {
    action_kind: string;
    next_due_at?: Date | string | null;
  } | null,
  now?: Date,
): string;
export function normalizeReconciliationExceptionReview(
  raw: Record<string, unknown>,
): {
  id: string;
  ownerActionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  evidenceReference: string;
  reviewNote: string;
};
export function normalizeIndependentClosureRecheck(
  raw: Record<string, unknown>,
): {
  id: string;
  exceptionReviewId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  recheckKind: string;
  evidenceReference: string;
  recheckNote: string;
};
export function normalizeClosureOwnerDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  closureRecheckId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  decisionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  decisionNote: string;
};
export function classifyClosureOwnerDecision(
  recheck: { rechecked_at: Date | string },
  decision: {
    decision_kind: string;
    next_due_at?: Date | string | null;
  } | null,
  now?: Date,
): string;
export function normalizeIndependentClosureFollowupReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerDecisionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyIndependentClosureFollowup(
  decision: { decision_kind: string; next_due_at?: Date | string | null },
  review: { review_kind: string } | null,
  now?: Date,
): string;
export function normalizeOwnerFollowupHandoffDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  independentReviewId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  actionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  actionNote: string;
};
export function classifyIndependentOutcomeAging(
  review: { review_kind: string; next_due_at?: Date | string | null },
  handoff: { action_kind: string } | null,
  now?: Date,
): string;
export function normalizeHandoffIndependentClosureAudit(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  handoffDecisionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  auditKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  auditNote: string;
};
export function classifyHandoffIndependentClosureStatus(
  handoff: { action_kind: string; next_due_at?: Date | string | null },
  audit: { audit_kind: string } | null,
  now?: Date,
): string;
