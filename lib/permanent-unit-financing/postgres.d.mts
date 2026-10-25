export interface FinancingDashboard {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  cases: Array<{
    id: string;
    buyer_display_name: string;
    accommodation_id: string;
    application_reference: string;
  }>;
  applications: Array<{
    id: string;
    sale_case_id: string;
    requested_amount_cents: string;
    applicant_contact_reference: string;
    consent_reference: string;
    purpose_note: string;
    opened_by_user_id: string;
  }>;
  evidence: Array<{
    id: string;
    application_id: string;
    document_type: string;
    outcome: string;
    source_reference: string;
    note: string;
    recorded_by_user_id: string;
  }>;
  triage: Array<{
    id: string;
    application_id: string;
    decision: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
}
export function getFinancingDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<FinancingDashboard>;
export function openFinancingApplication(
  input: Record<string, unknown>,
): Promise<string>;
export function recordFinancingEvidence(
  input: Record<string, unknown>,
): Promise<string>;
export function triageFinancingApplication(
  input: Record<string, unknown>,
): Promise<string>;
export function closeFinancingPoolForTests(): Promise<void>;
