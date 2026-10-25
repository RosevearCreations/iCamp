export const closingSteps: ReadonlyArray<{ key: string; label: string }>;
export function normalizeSaleApplication(input: Record<string, unknown>): {
  id: string;
  listingId: string;
  inquiryId: string;
  applicationReference: string;
  applicationNote: string;
};
export function normalizeSaleEvidence(input: Record<string, unknown>): {
  id: string;
  caseId: string;
  stepKey: string;
  outcome: string;
  sourceReference: string;
  note: string;
  feeAmountCents: number | null;
};
export function normalizeSaleDecision(input: Record<string, unknown>): {
  id: string;
  caseId: string;
  decision: string;
  note: string;
};
export function normalizeSaleHandoff(input: Record<string, unknown>): {
  id: string;
  caseId: string;
  newOwnershipEventId: string;
  agreementReference: string;
  closingReference: string;
  note: string;
};
export function closingProgress(
  evidence: Array<{
    step_key: string;
    outcome: string;
    source_reference?: string;
  }>,
  decision?: { decision: string } | null,
  handoff?: unknown,
): {
  steps: Array<{
    key: string;
    label: string;
    outcome: string;
    source: string | null;
  }>;
  ready: boolean;
  decision: string | null;
  recorded: boolean;
};
