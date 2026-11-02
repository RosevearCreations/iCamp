export interface TemporaryReservationHold {
  id: string;
  campgroundId: string;
  accommodationId: string;
  accommodationCode: string | null;
  accommodationName: string | null;
  arrivalDate: string;
  departureDate: string;
  holdState: "active" | "released" | "expired" | "converted";
  expiresAt: string;
  holdKey: string;
  rowVersion: number;
}
export interface TemporaryHoldWorkbench {
  holdDurationMinutes: number;
  holds: TemporaryReservationHold[];
}
export function getTemporaryHoldWorkbench(input: {
  userId: string;
  campgroundId: string;
}): Promise<TemporaryHoldWorkbench>;
export function createTemporaryHold(input: {
  userId: string;
  campgroundId: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
  holdKey: string;
}): Promise<TemporaryReservationHold>;
export function releaseTemporaryHold(input: {
  userId: string;
  campgroundId: string;
  holdId: string;
  holdKey: string;
}): Promise<TemporaryReservationHold>;
export function updateTemporaryHoldDuration(input: {
  userId: string;
  campgroundId: string;
  durationMinutes: number;
}): Promise<{ holdDurationMinutes: number; rowVersion: number }>;
export function closeReservationHoldPoolForTests(): Promise<void>;
