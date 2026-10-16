export interface ManagedReservationListItem {
  id: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  rowVersion: number;
  sourceChannel: string;
  accommodationCode: string;
  accommodationName: string;
  guestDisplayName: string;
  currentTotalCents: number;
  currencyCode: string;
  capturedCents: number;
  financialReviewRequired: boolean;
}

export interface ReservationManagementConsole {
  campground: {
    id: string;
    name: string;
    slug: string;
  };
  accommodations: Array<{
    id: string;
    code: string;
    displayName: string;
    accommodationKind: string;
    statusState: string;
  }>;
  reservations: ManagedReservationListItem[];
}

export interface ReservationManagementDetail {
  reservation: {
    id: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    rowVersion: number;
    sourceChannel: string;
    accommodationId: string;
    accommodationCode: string;
    accommodationName: string;
    accommodationKind: string;
    campgroundName: string;
    campgroundSlug: string;
    capturedCents: number;
    hasPaymentSchedule: boolean;
  };
  state: {
    id: string | null;
    rowVersion: number;
    guestDisplayName: string;
    contactEmail: string | null;
    currencyCode: string;
    staySubtotalCents: number;
    chargeTotalCents: number;
    currentTotalCents: number;
    chargeSelections: Array<{ code: string; quantity: number }>;
    financialReviewRequired: boolean;
    financialReviewReason: string | null;
    sourceQuoteKind: string;
  };
  accommodations: ReservationManagementConsole["accommodations"];
  stayAdjustments: Array<{
    id: string;
    adjustmentKind: string;
    priorAccommodationId: string;
    revisedAccommodationId: string;
    priorArrivalDate: string;
    priorDepartureDate: string;
    revisedArrivalDate: string;
    revisedDepartureDate: string;
    currencyCode: string;
    previousTotalCents: number;
    revisedTotalCents: number;
    deltaCents: number;
    capturedCents: number;
    financialReviewRequired: boolean;
    housekeepingReviewRequired: boolean;
    maintenanceReviewRequired: boolean;
    priorAccommodationStatus: string | null;
    revisedAccommodationStatus: string | null;
    operationalSummary: string;
    sourceChannel: string;
    occurredAt: string;
  }>;
  chargeCatalog: Array<{
    code: string;
    displayName: string;
    chargeKind: string;
    applicationMode: string;
    minimumQuantity: number;
    maximumQuantity: number;
    priceLabel: string;
  }>;
  history: Array<{
    id: string;
    sequenceNo: number;
    changeKind: string;
    sourceChannel: string;
    reason: string;
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown>;
    currencyCode: string;
    previousTotalCents: number;
    revisedTotalCents: number;
    deltaCents: number;
    capturedCents: number;
    financialReviewRequired: boolean;
    occurredAt: string;
  }>;
}

export function closeReservationManagementPoolForTests(): Promise<void>;

export function listReservationManagementConsole(input: {
  userId: string;
  campgroundId: string;
}): Promise<ReservationManagementConsole>;

export function getReservationManagementDetail(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
}): Promise<ReservationManagementDetail | null>;

export function createManagedReservation(input: {
  actorUserId: string;
  campgroundId: string;
  input: Record<string, unknown>;
  reason: string;
  idempotencyKey?: string;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "system";
  intake?: {
    bookingMode: "office" | "walk_up" | "overflow";
    overflowAreaId?: string | null;
    officeNote?: string | null;
  } | null;
}): Promise<{
  reservationId: string;
  idempotent: boolean;
  bookingMode?: "office" | "walk_up" | "overflow" | null;
}>;

export function updateManagedReservation(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  expectedRowVersion: number;
  input: Record<string, unknown>;
  reason: string;
  idempotencyKey?: string;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "system";
}): Promise<{
  reservationId: string;
  idempotent: boolean;
  changeKind: string;
  financialReviewRequired?: boolean;
  stayAdjustmentRecorded?: boolean;
  housekeepingReviewRequired?: boolean;
  maintenanceReviewRequired?: boolean;
}>;

export function cancelManagedReservation(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  expectedRowVersion: number;
  reason: string;
  idempotencyKey?: string;
  sourceChannel?: "web" | "staff" | "ivr" | "sms" | "system";
}): Promise<{
  reservationId: string;
  idempotent: boolean;
  financialReviewRequired?: boolean;
}>;
