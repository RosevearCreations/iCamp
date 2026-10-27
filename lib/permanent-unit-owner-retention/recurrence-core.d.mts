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
export function normalizeClosureAuditOwnerSignoff(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  independentAuditId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  signoffKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  signoffNote: string;
};
export function classifyClosureAuditOwnerSignoff(
  audit: { audit_kind: string; next_due_at?: Date | string | null },
  signoff: { signoff_kind: string } | null,
  now?: Date,
): string;
export function normalizeOwnerSignoffIndependentCloseout(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerSignoffId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyOwnerSignoffFollowup(
  signoff: { signoff_kind: string; next_due_at?: Date | string | null },
  review: { review_kind: string } | null,
  now?: Date,
): string;
export function normalizeIndependentCloseoutOwnerOutcome(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  closeoutReviewId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  outcomeNote: string;
};
export function classifyIndependentCloseoutOutcomeAging(
  review: { review_kind: string; next_due_at?: Date | string | null },
  outcome: { outcome_kind: string } | null,
  now?: Date,
): string;
export function normalizeOwnerEvidenceIndependentDisposition(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerOutcomeId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  dispositionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  dispositionNote: string;
};
export function classifyOwnerEvidenceRenewalDisposition(
  outcome: { outcome_kind: string; next_due_at?: Date | string | null },
  disposition: { disposition_kind: string } | null,
  now?: Date,
): string;
export function normalizeIndependentDispositionRecheck(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  independentDispositionId: string;
  replayOwnerOutcomeId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  recheckKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  recheckNote: string;
};
export function classifyIndependentDispositionRecheckAging(
  disposition: {
    disposition_kind: string;
    next_due_at?: Date | string | null;
  },
  recheck: { recheck_kind: string } | null,
  now?: Date,
): string;
export function normalizeIndependentRecheckOwnerDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  independentRecheckId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  decisionKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  decisionNote: string;
};
export function classifyOwnerReplayGapAging(
  recheck: { recheck_kind: string; next_due_at?: Date | string | null },
  decision: { decision_kind: string } | null,
  now?: Date,
): string;
export function normalizeIndependentProofContinuityReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerDecisionId: string;
  replayOwnerDecisionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyOwnerProofContinuityAging(
  ownerDecision: { decision_kind: string; next_due_at?: Date | string | null },
  review: { review_kind: string } | null,
  now?: Date,
): string;
export function normalizeClosureRecurrenceEvent(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  proofReviewId: string;
  priorEventId: string | null;
  ownerEvidenceDecisionId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  eventKind: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  eventNote: string;
};
export function classifyClosureRecurrenceStatus(
  event: {
    event_kind: string;
    outcome_kind: string;
    next_due_at?: Date | string | null;
  },
  nextEvent: { outcome_kind: string } | null,
  now?: Date,
): string;
export function normalizeReopenedExceptionAgingReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  reopenEventId: string;
  priorReviewId: string | null;
  verifiedFollowupEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyReopenedExceptionAgingStatus(
  review: {
    review_kind: string;
    outcome_kind: string;
    next_due_at?: Date | string | null;
  },
  nextReview: { id: string } | null,
  now?: Date,
): string;
export function normalizeContinuityResolutionFollowup(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  agingReviewId: string;
  priorFollowupId: string | null;
  verifiedFollowupEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  followupKind: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  followupNote: string;
};
export function classifyContinuityResolutionStatus(
  record: {
    followup_kind: string;
    outcome_kind: string;
    next_due_at?: Date | string | null;
  },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeVerifiedClosureMonitor(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  closureFollowupId: string;
  priorMonitorId: string | null;
  linkedReopenEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  monitorKind: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  monitorNote: string;
};
export function classifyVerifiedClosureMonitorStatus(
  record: {
    monitor_kind: string;
    outcome_kind: string;
    next_due_at?: Date | string | null;
  },
  next: { id: string } | null,
  now?: Date,
): string;
