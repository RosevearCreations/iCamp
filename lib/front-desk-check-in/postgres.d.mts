import type { CapacityEvaluation } from "../capacity-rules/core.mjs";
import type { FrontDeskSourceChannel } from "./core.mjs";

export interface FrontDeskArrival {
  id: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  rowVersion: number;
  campgroundName: string;
  campgroundLocalDate: string;
  accommodationCode: string;
  accommodationName: string;
  guestDisplayName: string;
  reservationTotalCents: number;
  expectedPayableCents: number;
  capturedCents: number;
  outstandingBalanceCents: number;
  financialReviewRequired: boolean;
  currencyCode: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface FrontDeskCheckInDetail {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    rowVersion: number;
    campgroundName: string;
    campgroundLocalDate: string;
    accommodationId: string;
    accommodationCode: string;
    accommodationName: string;
    accommodationKind: string;
    guestProfileId: string | null;
    guestDisplayName: string;
    checkoutCounts: {
      occupants: number;
      visitors: number;
      pets: number;
      vehicles: number;
    };
    petsAllowed: boolean;
    maxPets: number;
    reservationTotalCents: number;
    expectedPayableCents: number;
    capturedCents: number;
    outstandingBalanceCents: number;
    financialReviewRequired: boolean;
    currencyCode: string;
  };
  capacity: CapacityEvaluation;
  saved: {
    vehicles: Array<{
      id: string;
      nickname: string;
      vehicleKind: string;
      make: string | null;
      model: string | null;
      color: string | null;
      modelYear: number | null;
    }>;
    pets: Array<{
      id: string;
      name: string;
      species: string;
      breed: string | null;
      weightKg: number | null;
    }>;
  };
  checkIn: null | {
    id: string;
    checkedInAt: string | null;
    occupantCount: number;
    visitorCount: number;
    petCount: number;
    vehicleCount: number;
    reservationTotalCents: number;
    expectedPayableCents: number;
    capturedCents: number;
    outstandingBalanceCents: number;
    balanceOverrideUsed: boolean;
    balanceOverrideReason: string | null;
    rulesAcknowledgedAt: string | null;
    savedStaySnapshot: Record<string, unknown>;
    credentialRequestCount: number;
    credentialHandoffState: string;
    notes: string | null;
  };
  arrivalRequests: Array<{
    id: string;
    requestKind: string;
    requestCode: string;
    displayName: string;
    quantity: number;
    fulfillmentState: string;
    notes: string | null;
    createdAt: string | null;
  }>;
  canOverride: boolean;
}

export function closeFrontDeskCheckInPoolForTests(): Promise<void>;

export function listFrontDeskArrivals(input: {
  userId: string;
  campgroundId: string;
}): Promise<FrontDeskArrival[]>;

export function getFrontDeskCheckInDetail(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
}): Promise<FrontDeskCheckInDetail | null>;

export function checkInReservation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  reservationId: string;
  expectedRowVersion: number;
  input: Record<string, unknown>;
  sourceChannel?: FrontDeskSourceChannel;
}): Promise<{
  reservationId: string;
  checkInId: string;
  idempotent: boolean;
  checkedInAt?: string | null;
  outstandingBalanceCents: number;
  balanceOverrideUsed: boolean;
}>;
