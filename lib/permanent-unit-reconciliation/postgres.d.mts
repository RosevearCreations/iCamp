export interface ReconciliationDashboard {
  campground: { id: string; organization_id: string; name: string };
  consents: Array<{
    id: string;
    version_id: string;
    proposal_id: string;
    consent_channel: string;
    recipient_reference: string;
    version_code: string;
    content_sha256: string;
    buyer_display_name: string;
  }>;
  signoffs: Array<{
    id: string;
    consent_id: string;
    decision: string;
    reviewed_by_user_id: string;
  }>;
  receipts: Array<{
    id: string;
    consent_id: string;
    signoff_id: string;
    channel: string;
    delivered_at: string;
    evidence_reference: string;
    recorded_by_user_id: string;
  }>;
  responses: Array<{
    id: string;
    receipt_id: string;
    response: string;
    response_at: string;
    evidence_reference: string;
    recorded_by_user_id: string;
  }>;
  exceptions: Array<{
    id: string;
    consent_id: string;
    event_type: string;
    reason_code: string;
    recorded_at: string;
    evidence_reference: string;
  }>;
  reconciliations: Array<{
    id: string;
    consent_id: string;
    receipt_id: string | null;
    acknowledgement_id: string | null;
    disclosure_version_id: string;
    disclosure_sha256: string;
    last_exception_event_id: string | null;
    completeness: string;
    reconciliation_reference: string;
    note: string;
    prepared_by_user_id: string;
  }>;
  reviews: Array<{
    id: string;
    reconciliation_id: string;
    decision: string;
    review_reference: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
}
export function getReconciliationDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<ReconciliationDashboard>;
export function prepareEvidenceReconciliation(
  input: Record<string, unknown>,
): Promise<string>;
export function reviewEvidenceClosure(
  input: Record<string, unknown>,
): Promise<string>;
