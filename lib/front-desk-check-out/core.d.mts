export type CheckOutSourceChannel = "web" | "staff" | "ivr" | "sms" | "system";

export type ReturnState = "not_applicable" | "complete" | "follow_up_required";

export interface ReservationCheckOutInput {
  departureConfirmed: true;
  financialFollowUpAcknowledged: boolean;
  rentalReturnState: ReturnState;
  keyReturnState: ReturnState;
  credentialReturnState: ReturnState;
  returnNotes: string | null;
  departureNotes: string | null;
}

export function normalizeCheckOutSourceChannel(
  value?: unknown,
): CheckOutSourceChannel;

export function normalizeReservationCheckOutInput(
  input?: Record<string, unknown>,
): ReservationCheckOutInput;
