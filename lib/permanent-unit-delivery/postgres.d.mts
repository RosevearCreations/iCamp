export interface DeliveryDashboard {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    lifecycle_state: string;
  };
  versions: Array<{
    id: string;
    jurisdiction: string;
    version_code: string;
    document_reference: string;
    content_sha256: string;
    legal_review_reference: string;
    note: string;
    created_by_user_id: string;
  }>;
  reviews: Array<{
    id: string;
    version_id: string;
    outcome: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
  proposals: Array<{
    id: string;
    application_id: string;
    principal_cents: string;
    drafted_by_user_id: string;
    buyer_display_name: string;
  }>;
  authorizations: Array<{
    proposal_id: string;
    decision: string;
    reviewed_by_user_id: string;
  }>;
  consents: Array<{
    id: string;
    proposal_id: string;
    version_id: string;
    consent_channel: string;
    consent_reference: string;
    recipient_reference: string;
    note: string;
    recorded_by_user_id: string;
  }>;
  signoffs: Array<{
    id: string;
    consent_id: string;
    decision: string;
    review_reference: string;
    note: string;
    reviewed_by_user_id: string;
  }>;
}
export function getDeliveryDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<DeliveryDashboard>;
export function registerDisclosureVersion(
  input: Record<string, unknown>,
): Promise<string>;
export function reviewDisclosureVersion(
  input: Record<string, unknown>,
): Promise<string>;
export function recordOfferDeliveryConsent(
  input: Record<string, unknown>,
): Promise<string>;
export function signoffOfferHandoff(
  input: Record<string, unknown>,
): Promise<string>;
export function closeDeliveryPoolForTests(): Promise<void>;
