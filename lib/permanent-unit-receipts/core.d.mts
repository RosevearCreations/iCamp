export function normalizeManualReceipt(input: Record<string, unknown>): {
  id: string;
  consentId: string;
  signoffId: string;
  channel: string;
  deliveredAt: string;
  evidenceReference: string;
  recipientVerificationReference: string;
  note: string;
};
export function normalizeApplicantResponse(input: Record<string, unknown>): {
  id: string;
  receiptId: string;
  response: string;
  responseAt: string;
  evidenceReference: string;
  note: string;
};
export function normalizeExceptionEvent(input: Record<string, unknown>): {
  id: string;
  consentId: string;
  eventType: string;
  reasonCode: string;
  evidenceReference: string;
  note: string;
};
