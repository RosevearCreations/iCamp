export interface ReservationDocumentBundle {
  reservation: {
    id: string;
    status: string;
    campgroundName: string;
    campgroundSlug: string;
    accommodationCode: string;
    accommodationName: string;
    arrivalDate: string;
    departureDate: string;
  };
  guest: {
    name: string;
    email: string;
    phone: string;
    occupants: number;
    visitors: number;
    pets: number;
    vehicles: number;
  };
  quote: {
    currencyCode: string;
    staySubtotalCents: number;
    chargeTotalCents: number;
    totalCents: number;
  };
  payment: {
    bookingDepositCents: number;
    reservationBalanceCents: number;
    securityDepositCents: number;
    securityDepositDueStage: string;
    balanceDueMode: string;
    balanceDueDate: string;
    bookingDueCents: number;
    totalPayableCents: number;
    capturedCents: number;
  };
  confirmation: null | {
    id: string;
    number: string;
    currencyCode: string;
    reservationTotalCents: number;
    bookingDueCents: number;
    capturedAtConfirmationCents: number;
    securityDepositCents: number;
    balanceDueDate: string;
    confirmedAt: string | null;
  };
  invoice: null | {
    id: string;
    number: string;
    currencyCode: string;
    reservationAmountCents: number;
    securityDepositCents: number;
    totalPayableCents: number;
    issuedAt: string | null;
  };
  receipts: Array<{
    id: string;
    number: string;
    paymentId: string;
    paymentPurpose: string;
    currencyCode: string;
    amountCents: number;
    issuedAt: string | null;
  }>;
  email: { state: string };
}

export function closeReservationDocumentsPoolForTests(): Promise<void>;

export function syncReservationDocuments(input: {
  userId: string;
  reservationId: string;
}): Promise<
  | (ReservationDocumentBundle & {
      confirmed: boolean;
      emailState?: string;
      shortfallCents?: number;
    })
  | { confirmed: false; shortfallCents: number }
  | null
>;

export function getReservationDocumentBundle(input: {
  userId: string;
  reservationId: string;
}): Promise<ReservationDocumentBundle | null>;
