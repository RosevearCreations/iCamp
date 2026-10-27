export interface RecurrenceLedger {
  acceptances: Array<{ id: string; accepted_at: Date }>;
  reviews: Array<{
    id: string;
    acceptance_id: string;
    observed_plan_count: number;
    observed_continued_holds: number;
    observed_overdue_plans: number;
    review_note: string;
  }>;
  decisions: Array<{
    id: string;
    recurrence_review_id: string;
    decision_kind: string;
    next_due_at: Date | null;
    decision_note: string;
    reassessment_id: string | null;
    followup_status: string;
  }>;
  reassessments: Array<{
    id: string;
    recurrence_decision_id: string;
    assessment_kind: string;
    assessment_note: string;
    assessed_at: Date;
    gap_status: string;
  }>;
  ownerActions: Array<{
    id: string;
    reassessment_id: string;
    action_kind: string;
    action_note: string;
    next_due_at: Date | null;
  }>;
  exceptionReviews: Array<{
    id: string;
    owner_action_id: string;
    observed_open_gaps: number;
    observed_overdue_gaps: number;
    observed_recurrence_count: number;
    review_note: string;
  }>;
  closureRechecks: Array<{
    id: string;
    exception_review_id: string;
    recheck_kind: string;
    recheck_note: string;
    rechecked_at: Date;
    owner_decision_status: string;
  }>;
  closureOwnerDecisions: Array<{
    id: string;
    closure_recheck_id: string;
    decision_kind: string;
    next_due_at: Date | null;
    decision_note: string;
    independent_followup_status: string;
  }>;
  closureFollowupReviews: Array<{
    id: string;
    owner_decision_id: string;
    review_kind: string;
    next_due_at: Date | null;
    reviewed_at: Date;
    observed_recurring_decisions: number;
    observed_overdue_decisions: number;
    observed_escalation_decisions: number;
    observed_owner_days_overdue: number;
    review_note: string;
    owner_reconciliation_status: string;
  }>;
  closureHandoffDecisions: Array<{
    id: string;
    independent_review_id: string;
    action_kind: string;
    next_due_at: Date | null;
    action_note: string;
    observed_review_days_overdue: number;
    observed_peer_overdue_reviews: number;
    observed_prior_escalation_handoffs: number;
    independent_audit_status: string;
  }>;
  handoffIndependentAudits: Array<{
    id: string;
    handoff_decision_id: string;
    audit_kind: string;
    next_due_at: Date | null;
    audit_note: string;
    observed_handoff_days_overdue: number;
    observed_other_open_handoffs: number;
    observed_other_overdue_handoffs: number;
    observed_other_escalation_handoffs: number;
    owner_signoff_status: string;
  }>;
  closureAuditOwnerSignoffs: Array<{
    id: string;
    independent_audit_id: string;
    signoff_kind: string;
    next_due_at: Date | null;
    signoff_note: string;
    observed_reassessment_days_overdue: number;
    observed_peer_open_audits: number;
    observed_peer_overdue_audits: number;
    observed_prior_manual_escalations: number;
    independent_closeout_status: string;
  }>;
  signoffIndependentCloseoutReviews: Array<{
    id: string;
    owner_signoff_id: string;
    review_kind: string;
    next_due_at: Date | null;
    review_note: string;
    observed_signoff_days_overdue: number;
    observed_peer_open_signoffs: number;
    observed_peer_overdue_signoffs: number;
    observed_prior_escalation_acceptances: number;
    observed_prior_evidence_refreshes: number;
    owner_outcome_status: string;
  }>;
  independentCloseoutOwnerOutcomes: Array<{
    id: string;
    closeout_review_id: string;
    outcome_kind: string;
    next_due_at: Date | null;
    recorded_at: Date;
    evidence_reference: string;
    outcome_note: string;
    observed_review_days_overdue: number;
    observed_peer_open_reviews: number;
    observed_peer_overdue_reviews: number;
    observed_prior_independent_escalations: number;
    observed_prior_exception_renewals: number;
    independent_disposition_status: string;
  }>;
  ownerEvidenceIndependentDispositions: Array<{
    id: string;
    owner_outcome_id: string;
    disposition_kind: string;
    next_due_at: Date | null;
    disposition_note: string;
    observed_owner_days_overdue: number;
    observed_peer_pending_outcomes: number;
    observed_peer_overdue_outcomes: number;
    observed_recent_owner_renewals: number;
    observed_recent_independent_escalations: number;
    independent_recheck_status: string;
  }>;
  independentDispositionRechecks: Array<{
    id: string;
    independent_disposition_id: string;
    replay_owner_outcome_id: string;
    recheck_kind: string;
    next_due_at: Date | null;
    recheck_note: string;
    observed_disposition_days_overdue: number;
    observed_peer_pending_dispositions: number;
    observed_peer_overdue_dispositions: number;
    observed_recent_escalation_rechecks: number;
    observed_recent_owner_renewals: number;
    observed_replay_is_newer: boolean;
    owner_gap_status: string;
  }>;
  independentRecheckOwnerDecisions: Array<{
    id: string;
    independent_recheck_id: string;
    decision_kind: string;
    next_due_at: Date | null;
    decision_note: string;
    observed_recheck_days_overdue: number;
    observed_peer_open_rechecks: number;
    observed_peer_overdue_rechecks: number;
    observed_prior_escalation_decisions: number;
    observed_recent_independent_escalations: number;
    observed_replay_is_newer: boolean;
    observed_closure_proof_chain_complete: boolean;
    proof_continuity_status: string;
  }>;
  independentProofContinuityReviews: Array<{
    id: string;
    owner_decision_id: string;
    replay_owner_decision_id: string;
    review_kind: string;
    next_due_at: Date | null;
    review_note: string;
    observed_owner_days_overdue: number;
    observed_peer_open_owner_decisions: number;
    observed_peer_overdue_owner_decisions: number;
    observed_recent_escalation_renewals: number;
    observed_open_independent_rechecks: number;
    observed_replay_is_newer: boolean;
    observed_prior_chain_complete: boolean;
  }>;
  closureRecurrenceEvents: Array<{
    id: string;
    recorded_at: Date;
    proof_review_id: string;
    prior_event_id: string | null;
    root_reopen_id: string | null;
    event_kind: string;
    outcome_kind: string;
    owner_evidence_decision_id: string | null;
    next_due_at: Date | null;
    event_note: string;
    observed_prior_days_overdue: number;
    observed_open_peer_recurrences: number;
    observed_open_owner_dispositions: number;
    observed_recent_owner_escalations: number;
    observed_original_proof_verified: boolean;
    recurrence_status: string;
  }>;
  reopenedExceptionAgingReviews: Array<{
    id: string;
    reopen_event_id: string;
    prior_review_id: string | null;
    verified_followup_event_id: string | null;
    review_kind: string;
    outcome_kind: string;
    next_due_at: Date | null;
    observed_reopen_days_aging: number;
    observed_prior_days_overdue: number;
    observed_open_peer_recurrences: number;
    observed_open_owner_dispositions: number;
    observed_recent_owner_escalations: number;
    observed_verified_followup_linked: boolean;
    review_note: string;
    aging_status: string;
  }>;
  continuityResolutionFollowups: Array<{
    id: string;
    recorded_at: Date;
    aging_review_id: string;
    prior_followup_id: string | null;
    verified_followup_event_id: string | null;
    followup_kind: string;
    outcome_kind: string;
    next_due_at: Date | null;
    observed_prior_days_overdue: number;
    observed_open_peer_recurrences: number;
    observed_open_owner_dispositions: number;
    observed_recent_owner_escalations: number;
    observed_verified_followup_linked: boolean;
    followup_note: string;
    resolution_status: string;
  }>;
  verifiedClosureMonitors: Array<{
    id: string;
    closure_followup_id: string;
    prior_monitor_id: string | null;
    linked_reopen_event_id: string | null;
    monitor_kind: string;
    outcome_kind: string;
    next_due_at: Date | null;
    observed_proof_age_days: number;
    observed_prior_days_overdue: number;
    observed_open_peer_recurrences: number;
    observed_open_owner_dispositions: number;
    observed_recent_owner_escalations: number;
    observed_original_verified_closure: boolean;
    observed_linked_reopening_verified: boolean;
    monitor_note: string;
    monitoring_status: string;
  }>;
  limited: boolean;
}
export function getRecurrenceLedger(
  actor: string,
  source: string,
  target: string,
): Promise<RecurrenceLedger>;
export function recordOwnerRecurrenceReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentRecurrenceDecision(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentRecurrenceReassessment(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordOwnerEvidenceGapAction(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordReconciliationExceptionReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentClosureRecheck(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordClosureOwnerDecision(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentClosureFollowupReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordOwnerIndependentHandoffDecision(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordHandoffIndependentClosureAudit(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordClosureAuditOwnerSignoff(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordOwnerSignoffIndependentCloseout(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentCloseoutOwnerOutcome(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordOwnerEvidenceIndependentDisposition(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentDispositionRecheck(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentRecheckOwnerDecision(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentProofContinuityReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordClosureRecurrenceEvent(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordReopenedExceptionAgingReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordContinuityResolutionFollowup(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordVerifiedClosureMonitor(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
