export function normalizeDisclosureVersion(input: Record<string, unknown>): {
  id: string;
  jurisdiction: string;
  versionCode: string;
  documentReference: string;
  sha256: string;
  legalReviewReference: string;
  note: string;
};
export function normalizeDisclosureReview(input: Record<string, unknown>): {
  id: string;
  versionId: string;
  outcome: string;
  note: string;
};
export function normalizeDeliveryConsent(input: Record<string, unknown>): {
  id: string;
  proposalId: string;
  versionId: string;
  channel: string;
  consentReference: string;
  recipientReference: string;
  note: string;
};
export function normalizeDeliverySignoff(input: Record<string, unknown>): {
  id: string;
  consentId: string;
  decision: string;
  reviewReference: string;
  note: string;
};
