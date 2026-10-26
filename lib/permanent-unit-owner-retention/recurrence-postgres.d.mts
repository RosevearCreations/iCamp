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
