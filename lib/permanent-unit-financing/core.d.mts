export interface FinancingEvidenceType {
  key: string;
  label: string;
}
export const financingEvidenceTypes: readonly FinancingEvidenceType[];
export function dollarsToCents(input: unknown): number;
export function normalizeFinancingApplication(input: Record<string, unknown>): {
  id: string;
  caseId: string;
  requestedAmountCents: number;
  applicantContactReference: string;
  consentReference: string;
  purposeNote: string;
};
export function normalizeFinancingEvidence(input: Record<string, unknown>): {
  id: string;
  applicationId: string;
  documentType: string;
  outcome: string;
  sourceReference: string;
  note: string;
};
export function normalizeFinancingTriage(input: Record<string, unknown>): {
  id: string;
  applicationId: string;
  decision: string;
  note: string;
};
export function financingProgress(
  evidence: Array<{
    document_type: string;
    outcome: string;
    source_reference: string;
  }>,
  triage?: { decision: string },
): {
  requirements: Array<
    FinancingEvidenceType & { outcome: string; source: string | null }
  >;
  complete: boolean;
  triage: string;
};
