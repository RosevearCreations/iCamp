export function illustrativePayment(
  principalCents: number,
  annualRateBps: number,
  months: number,
): number;
export function normalizeOfferTerms(input: Record<string, unknown>): {
  id: string;
  applicationId: string;
  principalCents: number;
  annualRateBps: number;
  months: number;
  feeCents: number;
  estimatedMonthlyCents: number;
  policyReference: string;
  disclosureReference: string;
  note: string;
};
export function normalizeOfferAuthorization(input: Record<string, unknown>): {
  id: string;
  proposalId: string;
  decision: string;
  externalReviewReference: string;
  note: string;
};
