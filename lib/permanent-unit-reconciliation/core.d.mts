export function normalizeEvidenceReconciliation(
  input: Record<string, unknown>,
): {
  id: string;
  consentId: string;
  receiptId: string | null;
  acknowledgementId: string | null;
  disclosureVersionId: string;
  disclosureSha256: string;
  lastExceptionEventId: string | null;
  completeness: string;
  reconciliationReference: string;
  note: string;
};
export function normalizeClosureReview(input: Record<string, unknown>): {
  id: string;
  reconciliationId: string;
  decision: string;
  reviewReference: string;
  note: string;
};
