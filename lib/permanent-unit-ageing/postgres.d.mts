export interface AgeingDashboard {
  campground: { id: string; organization_id: string; name: string };
  serverNow: string;
  owners: Array<{ id: string; email_normalized: string }>;
  consents: Array<{
    id: string;
    version_id: string;
    recorded_at: string;
    consent_channel: string;
    buyer_display_name: string;
    version_code: string;
  }>;
  reconciliations: Array<{
    id: string;
    consent_id: string;
    prepared_at: string;
    completeness: string;
  }>;
  exceptions: Array<{
    id: string;
    consent_id: string;
    event_type: string;
    reason_code: string;
    recorded_at: string;
    evidence_reference: string;
  }>;
  reviews: Array<{
    id: string;
    consent_id: string;
    reconciliation_id: string | null;
    exception_event_id: string | null;
    observation_state: string;
    observed_since: string;
    review_decision: string;
    next_review_at: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
  escalations: Array<{
    id: string;
    exception_review_id: string;
    target_owner_user_id: string;
    priority: string;
    due_at: string;
    escalation_reference: string;
    requested_action: string;
    escalated_by_user_id: string;
  }>;
  responses: Array<{
    id: string;
    escalation_id: string;
    response: string;
    note: string;
    evidence_reference: string;
    responded_by_user_id: string;
  }>;
}
export function getAgeingDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<AgeingDashboard>;
export function recordExceptionReview(
  input: Record<string, unknown>,
): Promise<string>;
export function recordOwnerEscalation(
  input: Record<string, unknown>,
): Promise<string>;
export function recordOwnerResponse(
  input: Record<string, unknown>,
): Promise<string>;
