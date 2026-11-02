import type { MyStayDetail } from "../my-stay/postgres.mjs";
import type {
  CancellationPolicySource,
  CapturedPaymentSource,
  ReviewRequestInput,
} from "./core.mjs";

export interface GuestReservationReviewRequest {
  id: string;
  reservationId: string;
  campgroundId: string;
  kind: "change_dates" | "cancellation_review";
  state: "submitted" | "withdrawn";
  arrivalDate: string | null;
  departureDate: string | null;
  reason: string;
  submittedAt: string;
  withdrawnAt: string | null;
  sourceReservationVersion: number;
  sourcePolicyVersion: number | null;
  campgroundName: string | null;
  accommodationCode: string | null;
}

export function getOwnReservationDecisionSource(input: {
  userId: string;
  reservationId: string;
}): Promise<{
  stay: MyStayDetail;
  policy: CancellationPolicySource | null;
  payments: CapturedPaymentSource[];
  pendingPayments: boolean;
  pendingRefunds: boolean;
  cancellation: {
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
} | null>;

export function listOwnReservationReviewRequests(input: {
  userId: string;
  reservationId: string;
}): Promise<GuestReservationReviewRequest[]>;

export function submitOwnReservationReviewRequest(input: {
  userId: string;
  reservationId: string;
  idempotencyKey: string;
  expectedReservationVersion: number;
  expectedPolicyVersion: number | null;
  input: ReviewRequestInput;
}): Promise<string>;

export function withdrawOwnReservationReviewRequest(input: {
  userId: string;
  reservationId: string;
  requestId: string;
}): Promise<boolean>;

export function listStaffReservationReviewRequests(input: {
  userId: string;
}): Promise<GuestReservationReviewRequest[]>;

export function closeReservationDecisionsPoolForTests(): Promise<void>;
