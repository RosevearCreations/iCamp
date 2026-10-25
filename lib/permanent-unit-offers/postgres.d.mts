export interface OfferDashboard {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  applications: Array<{
    id: string;
    sale_case_id: string;
    requested_amount_cents: string;
    buyer_display_name: string;
  }>;
  triage: Array<{ application_id: string; decision: string }>;
  proposals: Array<{
    id: string;
    application_id: string;
    principal_cents: string;
    annual_rate_bps: number;
    term_months: number;
    upfront_fee_cents: string;
    estimated_monthly_cents: string;
    policy_reference: string;
    disclosure_reference: string;
    note: string;
    drafted_by_user_id: string;
  }>;
  decisions: Array<{
    id: string;
    proposal_id: string;
    decision: string;
    external_review_reference: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
}
export function getOfferDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<OfferDashboard>;
export function draftOfferTerms(
  input: Record<string, unknown>,
): Promise<string>;
export function reviewOfferTerms(
  input: Record<string, unknown>,
): Promise<string>;
export function closeOfferPoolForTests(): Promise<void>;
