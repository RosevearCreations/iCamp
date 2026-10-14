import type { ReservationCheckoutInput } from "./core.mjs";

export interface ReservationCheckoutContext {
  hold: {
    id: string;
    state: string;
    expiresAt: Date | string;
  };
  campground: {
    id: string;
    name: string;
    slug: string;
  };
  accommodation: {
    id: string;
    code: string;
    displayName: string;
    kind: "campsite" | "rental_cottage";
    campsiteType: "tent" | "rv" | "mixed" | null;
  };
  dates?: {
    arrivalDate: string;
    departureDate: string;
    nights: number;
  };
  guest: {
    email: string;
  };
  dateRules?: {
    eligible: boolean;
    issues: string[];
    nights: number;
    checkInTime: string;
    checkOutTime: string;
    effectiveMinimumStay: number;
    effectiveMaximumStay: number;
    holidayNames: string[];
    seasonNames: string[];
  };
  rateQuote?: {
    status: string;
    currencyCode: string | null;
    totalCents: number | null;
  };
  capacity?: {
    eligible: boolean;
    issues: string[];
    effectiveLimits: {
      maxOccupants: number | null;
      maxVisitors: number | null;
      maxVehicles: number | null;
    };
  };
  defaultLodgingKind?: "tent" | "rv" | "cottage";
  bookingCharges?: {
    automaticTotalCents: number;
    items: Array<{
      id: string;
      code: string;
      displayName: string;
      description: string | null;
      chargeKind: string;
      applicationMode: string;
      priceLabel: string;
      minimumQuantity: number;
      maximumQuantity: number;
    }>;
  };
}

export function closeReservationCheckoutPoolForTests(): Promise<void>;

export function startReservationCheckout(input: {
  userId: string;
  campgroundSlug: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<{ holdId: string; expiresAt: Date | string }>;

export function getReservationCheckout(input: {
  userId: string;
  holdId: string;
}): Promise<ReservationCheckoutContext | null>;

export function finalizeReservationCheckout(input: {
  userId: string;
  holdId: string;
  input: ReservationCheckoutInput | Record<string, unknown>;
}): Promise<{
  reservationId: string;
  currencyCode: string;
  totalCents: number;
  idempotent: boolean;
}>;

export function getPendingReservationCheckout(input: {
  userId: string;
  reservationId: string;
}): Promise<
  | {
      id: string;
      status: string;
      campground: { name: string; slug: string };
      accommodation: { code: string; displayName: string };
      dates: { arrivalDate: string; departureDate: string };
      contact: { name: string; email: string };
      party: {
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
      rulesAcknowledgedAt: Date | string;
    }
  | null
>;
