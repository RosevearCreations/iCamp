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
export function normalizeReopeningFollowupOversight(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  verifiedMonitorId: string;
  priorOversightId: string | null;
  verifiedResolutionEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  oversightKind: string;
  outcomeKind: string;
  nextDueAt: string | null;
  evidenceReference: string;
  oversightNote: string;
};
export function classifyReopeningFollowupStatus(
  record: {
    oversight_kind: string;
    outcome_kind: string;
    next_due_at?: Date | string | null;
  },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeEscalationResolutionRenewal(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  resolvedOversightId: string;
  priorRenewalId: string | null;
  renewalEvidenceEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  renewalKind: string;
  outcomeKind: string;
  nextDueAt: string;
  evidenceReference: string;
  renewalNote: string;
};
export function classifyEscalationResolutionRenewalStatus(
  record: { renewal_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeRenewalFreshnessDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerRenewalId: string;
  priorAuditId: string | null;
  comparisonEvidenceEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  auditKind: string;
  outcomeKind: string;
  nextDueAt: string;
  evidenceReference: string;
  auditNote: string;
};
export function classifyRenewalFreshnessDecisionStatus(
  record: { audit_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeContinuityRecurrenceRecheck(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerContinuityId: string;
  priorRecheckId: string | null;
  verifiedFollowupEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  recheckKind: string;
  outcomeKind: string;
  nextDueAt: string;
  evidenceReference: string;
  recheckNote: string;
};
export function classifyContinuityRecurrenceRecheckStatus(
  record: { recheck_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeOwnerRecheckRenewalWatch(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerRecheckId: string;
  priorWatchId: string | null;
  verifiedEvidenceEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  watchKind: string;
  outcomeKind: string;
  nextDueAt: string;
  evidenceReference: string;
  watchNote: string;
};
export function classifyOwnerRecheckRenewalWatchStatus(
  record: { watch_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeContinuityEvidenceReconciliation(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  continuityWatchId: string;
  priorReconciliationId: string | null;
  verifiedSourceEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  outcomeKind: string;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyContinuityEvidenceReconciliationStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeOwnerProofGatewayReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ownerReconciliationId: string;
  priorReviewId: string | null;
  verifiedRenewalEventId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  outcomeKind: string;
  nextDueAt: string;
  gatewayHealthReceiptRef: string | null;
  gatewayCapabilitiesReceiptRef: string | null;
  gatewayAuditReceiptRef: string | null;
  independentWitnessAttestationRef: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyOwnerProofGatewayReviewStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const gatewayHoldReceiptKinds: string[];
export function normalizeGatewayHoldReceiptReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  gatewayReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  outcomeKind: string;
  nextDueAt: string;
  receiptKind: string | null;
  receiptReference: string | null;
  sourceRevision: string | null;
  ciRunUrl: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyGatewayHoldReceiptReviewStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export function normalizeQl245SourcePinHoldReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  receiptReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  outcomeKind: string;
  nextDueAt: string;
  comparisonSourceRevision: string | null;
  comparisonCiRunUrl: string | null;
  publicSourcePinSha256: string | null;
  separatelySourcedPinSha256: string | null;
  pinProvenanceRef: string | null;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl245SourcePinHoldStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql247SourceRepositories: Readonly<Record<string, string>>;
export function normalizeQl246ExceptionPinHoldDecision(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  sourcePinReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  sourceRevision: string | null;
  ciRunUrl: string | null;
  proofRawJsonSha256: string | null;
  sourceProofStatus: string;
  publicSignerSpkiSha256: string | null;
  outOfBandSpkiSha256: string | null;
  outOfBandReference: string | null;
  operatorChallengeId: string | null;
  operatorChallengeSha256: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl246ExceptionPinHoldStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql247DenialKinds: ReadonlyArray<string>;
export function normalizeQl247TestReceiptHoldWatch(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ql246HoldDecisionId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  testAuthorizationReference: string | null;
  authorizationReferenceStatus: string;
  twoShaAgreementStatus: string;
  twoShaAgreementReference: string | null;
  sourceRevisionSha: string | null;
  proofCommitSha: string | null;
  proofSha256: string | null;
  ciRunUrl: string | null;
  denialReceiptIds: string[];
  denialWitnessReference: string | null;
  rollbackReference: string | null;
  revocationReference: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl247TestReceiptHoldStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql248RecheckOutcomes: Readonly<
  Record<string, ReadonlyArray<string>>
>;
export function normalizeQl248ProvenanceGapHoldRenewal(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ql247WatchId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  proofPublicReference: string | null;
  sourceRevisionSha: string | null;
  proofCommitSha: string | null;
  proofSha256: string | null;
  sourceCiRunUrl: string | null;
  signerPinSha256: string | null;
  signerPinReference: string | null;
  consumerAgreementReference: string | null;
  denialReceiptIds: string[];
  denialWitnessReference: string | null;
  ownerTestAuthorizationReference: string | null;
  rollbackReference: string | null;
  revocationReference: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl248ProvenanceGapHoldStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql248SourceReceiptReassessmentOutcomes: Readonly<
  Record<string, ReadonlyArray<string>>
>;
export function normalizeQl248SourceReceiptExceptionReassessment(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ql248RenewalId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  denialReceiptIds: string[];
  sourceAuditReference: string | null;
  ownerAuthorizationReference: string | null;
  rollbackReference: string | null;
  revocationReference: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl248SourceReceiptReassessmentStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql252SourceAuditHoldOutcomes: Readonly<
  Record<string, ReadonlyArray<string>>
>;
export function normalizeQl252SourceAuditHoldReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ql248SourceReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  sourceRevisionSha: string | null;
  sourceCiRunUrl: string | null;
  proofCommitSha: string | null;
  proofSha256: string | null;
  publicSpkiSha256: string | null;
  sourceAuditReference: string | null;
  denialReceiptIds: string[];
  denialWitnessReference: string | null;
  ownerTestReceiptId: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl252SourceAuditHoldStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
export const ql253HoldReviewOutcomes: Readonly<
  Record<string, ReadonlyArray<string>>
>;
export function normalizeQl253HoldReview(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  ql252ReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  sourceRevisionSha: string | null;
  sourceCiRunUrl: string | null;
  proofCommitSha: string | null;
  proofSha256: string | null;
  publicSpkiSha256: string | null;
  proofHttpStatus: string;
  sourceAuditReference: string | null;
  custodianReceiptId: string | null;
  distinctWitnessReceiptId: string | null;
  challengeSha256: string | null;
  custodyPinSha256: string | null;
  challengeIssuedAt: string | null;
  challengeExpiresAt: string | null;
  ownerTestReceiptId: string | null;
  testTenantId: string | null;
  testWindowStart: string | null;
  testWindowEnd: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
};
export function classifyQl253HoldReviewStatus(
  record: { review_kind: string; next_due_at?: Date | string | null },
  next: { id: string } | null,
  now?: Date,
): string;
