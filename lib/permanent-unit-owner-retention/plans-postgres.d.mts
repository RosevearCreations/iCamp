export interface OwnerReopenPlansReport {
  reviews: Array<{
    id: string;
    acceptance_id: string;
    review_kind: string;
    reviewed_at: Date;
  }>;
  plans: Array<{
    id: string;
    exception_review_id: string;
    action_kind: string;
    next_due_at: Date;
    evidence_reference: string;
    action_note: string;
    planned_at: Date;
  }>;
  resolutions: Array<{
    id: string;
    action_plan_id: string;
    resolution_kind: string;
    observed_unclosed_cases: number;
    cases_since_acceptance: number;
    evidence_reference: string;
    resolution_note: string;
    resolved_at: Date;
  }>;
  limited: boolean;
}
export function getOwnerReopenPlans(
  actor: string,
  source: string,
  target: string,
): Promise<OwnerReopenPlansReport>;
export function recordOwnerReopenActionPlan(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentHoldResolution(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{
  id: string;
  observed_unclosed_cases: number;
  cases_since_acceptance: number;
}>;
