export interface AcceptanceExceptionReviewReport {
  candidates: Array<{
    id: string;
    accepted_at: Date;
    accepted_by_user_id: string;
    outcome_kind: string;
    review_id: string;
    new_case_count: number;
  }>;
  reviews: Array<{
    id: string;
    acceptance_id: string;
    review_kind: string;
    observed_unclosed_cases: number;
    cases_since_acceptance: number;
    evidence_reference: string;
    review_note: string;
    reviewed_at: Date;
  }>;
  limited: boolean;
}
export function getAcceptanceExceptionReviewReport(
  actor: string,
  source: string,
  target: string,
): Promise<AcceptanceExceptionReviewReport>;
export function recordAcceptanceExceptionReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{
  id: string;
  observed_unclosed_cases: number;
  cases_since_acceptance: number;
}>;
