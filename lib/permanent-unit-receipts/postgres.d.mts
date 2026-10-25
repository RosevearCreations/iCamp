export interface ReceiptDashboard {
  campground: { id: string; organization_id: string; name: string };
  consents: Array<{
    id: string;
    proposal_id: string;
    version_id: string;
    consent_channel: string;
    recipient_reference: string;
    buyer_display_name: string;
    version_code: string;
    content_sha256: string;
  }>;
  signoffs: Array<{
    id: string;
    consent_id: string;
    decision: string;
    reviewed_at: string;
  }>;
  receipts: Array<{
    id: string;
    consent_id: string;
    signoff_id: string;
    channel: string;
    delivered_at: string;
    evidence_reference: string;
    recipient_verification_reference: string;
    note: string;
    recorded_by_user_id: string;
  }>;
  responses: Array<{
    id: string;
    receipt_id: string;
    response: string;
    response_at: string;
    evidence_reference: string;
    note: string;
  }>;
  exceptions: Array<{
    id: string;
    consent_id: string;
    event_type: string;
    reason_code: string;
    evidence_reference: string;
    note: string;
    recorded_at: string;
  }>;
}
export function getReceiptDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<ReceiptDashboard>;
export function recordManualReceipt(
  input: Record<string, unknown>,
): Promise<string>;
export function recordApplicantResponse(
  input: Record<string, unknown>,
): Promise<string>;
export function recordDeliveryException(
  input: Record<string, unknown>,
): Promise<string>;
