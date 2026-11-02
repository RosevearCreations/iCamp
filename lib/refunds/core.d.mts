export interface CancellationRefundPolicy {
  currencyCode: string;
  freeCancellationDaysBeforeArrival: number;
  earlyRefundBasisPoints: number;
  lateRefundBasisPoints: number;
  securityDepositRefundBasisPoints: number;
  cancellationFeeCents: number;
  approvalThresholdCents: number;
}

export const defaultCancellationRefundPolicy: Readonly<CancellationRefundPolicy>;

export function normalizeRefundReason(value: unknown): string;

export function validateCancellationRefundPolicyInput(
  input?: Partial<CancellationRefundPolicy>,
): CancellationRefundPolicy;

export function daysBeforeArrival(
  arrivalDate: string,
  asOfDate: string,
): number;

export function calculateCancellationRefundRecommendation(input: {
  arrivalDate: string;
  asOfDate: string;
  policy?: Partial<CancellationRefundPolicy>;
  payments?: Array<{
    id: string;
    paymentPurpose: string;
    amountCents: number;
    refundedCents?: number;
  }>;
}): {
  daysBeforeArrival: number;
  policyWindow: "early" | "late";
  capturedRemainingCents: number;
  recommendedRefundCents: number;
  retainedCents: number;
  feeAppliedCents: number;
  allocations: Array<{
    paymentId: string;
    paymentPurpose: string;
    remainingCents: number;
    basisPoints: number;
    recommendedCents: number;
  }>;
};

export function refundApprovalRequirement(input: {
  amountCents: number;
  approvalThresholdCents: number;
  policyRecommendedCents: number;
  batchRecommendedCents?: number | null;
}): {
  approvalRequired: boolean;
  exceedsThreshold: boolean;
  exceedsPolicy: boolean;
};

export function refundRemainingCents(input: {
  capturedCents: number;
  reservedOrRefundedCents?: number;
}): number;
