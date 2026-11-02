export interface PaymentPolicy {
  depositMode: "full" | "fixed" | "percentage";
  depositFixedCents: number | null;
  depositPercentageBasisPoints: number | null;
  securityDepositCents: number;
  securityDepositDueStage: "with_deposit" | "with_balance" | "on_arrival";
  balanceDueMode: "at_booking" | "days_before_arrival" | "on_arrival";
  balanceDueDaysBeforeArrival: number | null;
  currencyCode: string;
}

export interface PaymentSchedule {
  policy: PaymentPolicy;
  bookingDate: string;
  arrivalDate: string;
  currencyCode: string;
  reservationTotalCents: number;
  bookingDepositCents: number;
  reservationBalanceCents: number;
  securityDepositCents: number;
  securityDepositDueStage: PaymentPolicy["securityDepositDueStage"];
  balanceDueMode: PaymentPolicy["balanceDueMode"];
  balanceDueDate: string;
  bookingDueCents: number;
  totalPayableCents: number;
}

export interface PaymentProgress {
  capturedCents: number;
  dueToDateCents: number;
  dueNowCents: number;
  outstandingCents: number;
  paidInFull: boolean;
  currentDueSatisfied: boolean;
}

export const defaultPaymentPolicy: Readonly<PaymentPolicy>;
export function moneyInputToCents(value: unknown, label?: string): number;
export function percentInputToBasisPoints(value: unknown): number;
export function validatePaymentPolicyInput(input?: unknown): PaymentPolicy;
export function calculateReservationPaymentSchedule(input: {
  totalCents: number;
  currencyCode: string;
  arrivalDate: string;
  bookingDate: string;
  policy: PaymentPolicy;
}): PaymentSchedule;
export function calculatePaymentProgress(input: {
  schedule: PaymentSchedule;
  capturedCents?: number;
  asOfDate: string;
}): PaymentProgress;
