import type { DeskPermissions } from "./core.mjs";

export interface DeskReservation {
  id: string;
  campgroundId: string;
  accommodationId: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  accommodationCode: string;
  accommodationName: string;
  guestDisplayName: string;
  inArrivalWindow: boolean;
  inDepartureWindow: boolean;
  checkedOutAt: string | null;
  plan: null | {
    state: string;
    assistanceRequested: boolean;
    reviewOutcome: string | null;
    reviewCurrent: boolean;
  };
  finance: null | {
    outstandingBalanceCents: number;
    financialReviewRequired: boolean;
    currencyCode: string;
  };
}
export interface DeskHold {
  id: string;
  campgroundId: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
  accommodationCode: string;
  accommodationName: string;
  expiresAt: string;
}
export interface DeskGroup {
  accommodationId: string | null;
  openCount: number;
  blockedCount: number;
}
export interface DeskCoverage {
  shown: number;
  total: number;
  complete: boolean;
}
export interface FrontDeskWorkboard {
  campground: { id: string; name: string; timezone: string; localDate: string };
  permissions: DeskPermissions;
  reservations: DeskReservation[];
  holds: DeskHold[];
  visitors: Array<{
    reservationId: string;
    issueCount: number;
    pendingCount: number;
  }>;
  maintenance: DeskGroup[];
  turnovers: DeskGroup[];
  coverage: {
    reservations: DeskCoverage;
    holds: DeskCoverage | null;
    visitors: DeskCoverage | null;
    maintenance: DeskCoverage | null;
    turnovers: DeskCoverage | null;
  };
}
export function listFrontDeskWorkboard(input: {
  userId: string;
  campgroundId: string;
}): Promise<FrontDeskWorkboard>;
export function closeFrontDeskWorkboardPoolForTests(): Promise<void>;
