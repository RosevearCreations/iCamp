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
