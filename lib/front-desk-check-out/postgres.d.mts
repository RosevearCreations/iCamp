import type { CheckOutSourceChannel } from "./core.mjs";

export interface FrontDeskDeparture {
  id: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  rowVersion: number;
  campgroundName: string;
  campgroundLocalDate: string;
  accommodationCode: string;
  accommodationName: string;
  accommodationKind: string;
  accommodationStatusState: string;
  guestDisplayName: string;
  reservationTotalCents: number;
  expectedPayableCents: number;
  capturedCents: number;
  outstandingBalanceCents: number;
  financialReviewRequired: boolean;
  currencyCode: string;
  checkedIn: boolean;
  checkedOut: boolean;
  checkedOutAt: string | null;
  turnoverState: string | null;
}

export interface FrontDeskCheckOutDetail {
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
    accommodationStatusState: string;
    guestDisplayName: string;
    reservationTotalCents: number;
    expectedPayableCents: number;
    capturedCents: number;
    outstandingBalanceCents: number;
    financialReviewRequired: boolean;
    currencyCode: string;
  };
  checkIn: null | {
    id: string;
    checkedInAt: string | null;
    credentialRequestCount: number;
    rentalRequestCount: number;
  };
  checkOut: null | {
    id: string;
    checkedOutAt: string | null;
    outstandingBalanceCents: number;
    financialHandoffState: string;
    rentalReturnState: string;
    keyReturnState: string;
    credentialReturnState: string;
    returnNotes: string | null;
    departureNotes: string | null;
    accommodationStatusBefore: string;
    accommodationStatusAfter: string;
    turnoverKind: string;
    turnoverState: string;
    cottageTurnoverId: string | null;
    cottageTurnoverTemplateId: string | null;
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
}

export function closeFrontDeskCheckOutPoolForTests(): Promise<void>;

export function listFrontDeskDepartures(input: {
  userId: string;
  campgroundId: string;
}): Promise<FrontDeskDeparture[]>;

export function getFrontDeskCheckOutDetail(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
}): Promise<FrontDeskCheckOutDetail | null>;

export function checkOutReservation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  reservationId: string;
  expectedRowVersion: number;
  input: Record<string, unknown>;
  sourceChannel?: CheckOutSourceChannel;
}): Promise<{
  reservationId: string;
  checkOutId: string;
  idempotent: boolean;
  checkedOutAt?: string | null;
  turnoverState: string;
  cottageTurnoverId: string | null;
}>;
