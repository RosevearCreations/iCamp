import type { CancellationRefundPolicy } from "./core.mjs";
import type { RefundProviderAdapter } from "./provider.mjs";

export interface RefundPolicySnapshot {
  campground: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  policy: CancellationRefundPolicy & {
    id: string | null;
    rowVersion: number;
    persisted: boolean;
  };
}

export interface ReservationRefundRecord {
  id: string;
  reservationId: string;
  originalPaymentId: string;
  policyId: string | null;
  requestedByUserId: string;
  approvedByUserId: string | null;
  refundKind: "partial" | "full" | "cancellation";
  amountCents: number;
  currencyCode: string;
  reason: string;
  policySnapshot: Record<string, unknown>;
  approvalRequired: boolean;
  approvalState: "not_required" | "pending" | "approved" | "rejected";
  refundState:
    | "pending_approval"
    | "approved"
    | "submitted"
    | "succeeded"
    | "failed"
    | "rejected";
  providerKey: string;
  providerRefundReference: string | null;
  idempotencyKey: string;
  lastErrorCode: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  rowVersion: number;
}


export interface ReservationFinancialSafeguards {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    currencyCode: string;
    financialReviewRequired: boolean;
    financialReviewReason: string | null;
    currentTotalCents: number | null;
  };
  policy: CancellationRefundPolicy & {
    id: string | null;
    rowVersion: number;
    persisted: boolean;
  };
  recommendation: {
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
  payments: Array<{
    id: string;
    paymentPurpose: string;
    amountCents: number;
    currencyCode: string;
    providerKey: string;
    providerPaymentReference: string | null;
    capturedAt: string | null;
    reservedRefundCents: number;
    succeededRefundCents: number;
    remainingRefundableCents: number;
    policyRecommendedCents: number;
  }>;
  refunds: ReservationRefundRecord[];
  adjustments: Array<{
    id: string;
    reservationId: string;
    refundId: string | null;
    originalPaymentId: string | null;
    adjustmentKind: string;
    financialEffect: string;
    amountCents: number;
    currencyCode: string;
    reason: string;
    evidence: Record<string, unknown>;
    actorUserId: string;
    idempotencyKey: string;
    occurredAt: string | null;
  }>;
}

export function closeRefundsPoolForTests(): Promise<void>;

export function getCampgroundCancellationRefundPolicy(input: {
  userId: string;
  campgroundId: string;
}): Promise<RefundPolicySnapshot>;

export function saveCampgroundCancellationRefundPolicy(
  input: {
    actorUserId: string;
    campgroundId: string;
    expectedRowVersion: number;
  } & CancellationRefundPolicy,
): Promise<
  CancellationRefundPolicy & {
    id: string | null;
    rowVersion: number;
    persisted: boolean;
  }
>;

export function getReservationFinancialSafeguards(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
}): Promise<ReservationFinancialSafeguards | null>;

export function requestReservationRefund(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  originalPaymentId: string;
  amountCents: number;
  refundKind?: "partial" | "full" | "cancellation";
  reason: string;
  providerKey: string;
  idempotencyKey?: string;
}): Promise<ReservationRefundRecord>;

export function approveReservationRefund(input: {
  actorUserId: string;
  campgroundId: string;
  refundId: string;
  reason: string;
}): Promise<ReservationRefundRecord>;

export function rejectReservationRefund(input: {
  actorUserId: string;
  campgroundId: string;
  refundId: string;
  reason: string;
}): Promise<ReservationRefundRecord>;

export function executeReservationRefund(input: {
  actorUserId: string;
  campgroundId: string;
  refundId: string;
  provider: RefundProviderAdapter;
}): Promise<{ refund: ReservationRefundRecord; duplicate: boolean }>;

export function recordReservationFinancialAdjustment(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  adjustmentKind: "credit" | "charge" | "forfeit" | "writeoff";
  financialEffect: "customer_credit" | "customer_debit" | "retained" | "none";
  amountCents: number;
  currencyCode: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<Record<string, unknown>>;

export function recordCancellationForfeit(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<{
  retainedCents: number;
  currencyCode: string;
  financialReviewRequired: false;
}>;
