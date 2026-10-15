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
}): any;
export function calculatePaymentProgress(input: {
  schedule: any;
  capturedCents?: number;
  asOfDate: string;
}): any;
