import type { MyStayDetail } from "../my-stay/postgres.mjs";

export const RESERVATION_REVIEW_KINDS: readonly [
  "change_dates",
  "cancellation_review",
];

export interface ReviewRequestInput {
  kind: "change_dates" | "cancellation_review";
  reason: string;
  arrivalDate: string | null;
  departureDate: string | null;
  nights: number | null;
}

export interface CancellationPolicySource {
  id: string;
  rowVersion: number;
  currencyCode: string;
  freeCancellationDaysBeforeArrival: number;
  earlyRefundBasisPoints: number;
  lateRefundBasisPoints: number;
  securityDepositRefundBasisPoints: number;
  cancellationFeeCents: number;
  approvalThresholdCents: number;
}

export interface CapturedPaymentSource {
  id: string;
  paymentPurpose: string;
  amountCents: number;
  refundedCents: number;
  currencyCode: string;
}

export function parseReviewDates(
  input: Record<string, unknown>,
  today: string,
): { arrivalDate: string; departureDate: string; nights: number };

export function normalizeReviewRequest(
  input: Record<string, unknown>,
  today: string,
): ReviewRequestInput;

export function cancellationDecisionPreview(input: {
  stay: MyStayDetail;
  policy: CancellationPolicySource | null;
  payments: CapturedPaymentSource[];
  pendingRefunds: boolean;
  pendingPayments: boolean;
}): {
  status: "estimated" | "review_required";
  reason: string | null;
  capturedCents: number;
  refundedCents: number;
  recommendation: {
    daysBeforeArrival: number;
    policyWindow: string;
    capturedRemainingCents: number;
    recommendedRefundCents: number;
    retainedCents: number;
    feeAppliedCents: number;
  } | null;
};
