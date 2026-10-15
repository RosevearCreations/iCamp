export function closePaymentsPoolForTests(): Promise<void>;
export function getCampgroundPaymentPolicy(
  userId: string,
  campgroundId: string,
): Promise<any>;
export function saveCampgroundPaymentPolicy(input: any): Promise<any>;
export function ensureReservationPaymentSchedule(input: {
  userId: string;
  reservationId: string;
}): Promise<any>;
export function getReservationPaymentSummary(input: {
  userId: string;
  reservationId: string;
}): Promise<any>;
export function startReservationPayment(input: {
  userId: string;
  reservationId: string;
  provider: any;
}): Promise<any>;
export function ingestPaymentProviderEvent(event: any): Promise<any>;
