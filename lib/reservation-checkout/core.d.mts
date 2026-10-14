export interface CheckoutChargeSelection {
  code: string;
  quantity: number;
}

export interface ReservationCheckoutInput {
  primaryFirstName: string;
  primaryLastName: string;
  contactEmail: string;
  contactPhone: string;
  occupants: number;
  visitors: number;
  pets: number;
  vehicles: number;
  lodgingKind: "tent" | "rv" | "cottage";
  rvLengthMeters: number | null;
  rvWidthMeters: number | null;
  rvHeightMeters: number | null;
  electricalAmperage: number;
  needsWaterAtSite: boolean;
  needsWastewaterAtSite: boolean;
  needsWifi: boolean;
  needsStepFreeAccess: boolean;
  needsAccessibleWashroom: boolean;
  selections: CheckoutChargeSelection[];
  rulesAcknowledged: true;
}

export function normalizeCheckoutChargeSelections(
  input?: Array<{ code?: unknown; quantity?: unknown }>,
): CheckoutChargeSelection[];

export function normalizeReservationCheckoutInput(
  input?: Record<string, unknown>,
): ReservationCheckoutInput;

export function finalReservationQuote(input: {
  stayQuote: {
    status: string;
    currencyCode: string | null;
    totalCents: number | null;
  };
  chargeQuote: {
    currencyCode: string;
    totalCents: number;
  };
}): {
  currencyCode: string;
  staySubtotalCents: number;
  chargeTotalCents: number;
  totalCents: number;
};

export function checkoutErrorCode(error: unknown): string | null;
