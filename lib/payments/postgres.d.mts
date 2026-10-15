import type {
  PaymentPolicy,
  PaymentProgress,
  PaymentSchedule,
} from "./core.mjs";
import type {
  PaymentProviderAdapter,
  PaymentProviderEvent,
} from "./provider.mjs";

export interface CampgroundPaymentPolicy extends PaymentPolicy {
  id: string | null;
  rowVersion: number;
  persisted: boolean;
}

export interface ReservationPayment {
  id: string;
  reservationId: string;
  paymentScheduleId: string;
  providerKey: string;
  providerPaymentReference: string | null;
  paymentPurpose: "booking_due" | "balance" | "security_deposit";
  amountCents: number;
  currencyCode: string;
  state:
    | "created"
    | "submitted"
    | "authorized"
    | "captured"
    | "failed"
    | "cancelled";
  authorizedAt: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export function closePaymentsPoolForTests(): Promise<void>;
export function getCampgroundPaymentPolicy(
  userId: string,
  campgroundId: string,
): Promise<{
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  policy: CampgroundPaymentPolicy;
}>;
export function saveCampgroundPaymentPolicy(
  input: PaymentPolicy & {
    actorUserId: string;
    actorSessionId?: string | null;
    campgroundId: string;
    expectedRowVersion: number;
  },
): Promise<CampgroundPaymentPolicy>;
export function ensureReservationPaymentSchedule(input: {
  userId: string;
  reservationId: string;
}): Promise<(PaymentSchedule & { id: string }) | null>;
export function getReservationPaymentSummary(input: {
  userId: string;
  reservationId: string;
}): Promise<{
  reservation: {
    id: string;
    status: string;
    campgroundName: string;
    campgroundSlug: string;
    accommodationCode: string;
    accommodationName: string;
  };
  schedule: PaymentSchedule & { id: string };
  progress: PaymentProgress;
  payments: ReservationPayment[];
} | null>;
export function startReservationPayment(input: {
  userId: string;
  reservationId: string;
  provider: PaymentProviderAdapter;
}): Promise<{
  payment: ReservationPayment | null;
  alreadySatisfied: boolean;
  active?: boolean;
} | null>;
export function ingestPaymentProviderEvent(
  event: PaymentProviderEvent,
): Promise<{
  duplicate: boolean;
  payment: ReservationPayment;
}>;
