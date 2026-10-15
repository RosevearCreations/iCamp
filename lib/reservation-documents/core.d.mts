export interface ReservationConfirmationEligibility {
  eligible: boolean;
  requiredCents: number;
  capturedCents: number;
  shortfallCents: number;
}

export function reservationConfirmationEligibility(input: {
  bookingDueCents: number;
  capturedCents: number;
}): ReservationConfirmationEligibility;

export function deterministicDocumentNumber(
  prefix: string,
  seed: string,
): string;

export function confirmationSnapshot(input: {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    campgroundName: string;
    accommodationCode: string;
    accommodationName: string;
  };
  checkout: {
    contactName: string;
    contactEmail: string;
    occupants: number;
    visitors: number;
    pets: number;
    vehicles: number;
    currencyCode: string;
    staySubtotalCents: number;
    chargeTotalCents: number;
    totalCents: number;
  };
  schedule: {
    bookingDueCents: number;
    bookingDepositCents: number;
    reservationBalanceCents: number;
    securityDepositCents: number;
    securityDepositDueStage: string;
    balanceDueMode: string;
    balanceDueDate: string;
    totalPayableCents: number;
  };
  capturedCents: number;
}): Record<string, unknown>;
