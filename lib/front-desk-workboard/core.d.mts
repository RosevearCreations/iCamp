export interface DeskFilters {
  view: "all" | "arrivals" | "departures" | "exceptions" | "holds";
  sort: "urgency" | "date" | "accommodation";
  query: string;
}
export interface DeskFlag {
  label: string;
  severity: number;
}
import type { DeskReservation, DeskHold, DeskGroup } from "./postgres.mjs";

export interface DeskRow {
  id: string;
  key: string;
  kind: "arrivals" | "departures" | "holds";
  direction: string;
  date: string;
  campgroundId: string;
  guestDisplayName: string;
  accommodationCode: string;
  accommodationName: string;
  arrivalDate: string;
  departureDate: string;
  status?: string;
  flags: DeskFlag[];
  primaryHref: string;
  secondaryHref: string | null;
  finance?: DeskReservation["finance"];
}
export interface DeskPermissions {
  finance: boolean;
  visitors: boolean;
  maintenance: boolean;
  housekeeping: boolean;
  holds: boolean;
}
export function normalizeDeskFilters(
  input?: Record<string, unknown>,
): DeskFilters;
export function sourceCoverage(
  shown: number,
  total: number,
): { shown: number; total: number; complete: boolean };
export function buildDeskQueues(input: {
  reservations?: DeskReservation[];
  holds?: DeskHold[];
  visitors?: Array<{
    reservationId: string;
    issueCount: number;
    pendingCount: number;
  }>;
  maintenance?: DeskGroup[];
  turnovers?: DeskGroup[];
  permissions: DeskPermissions;
  filters?: Record<string, unknown>;
}): {
  rows: DeskRow[];
  counts: {
    arrivals: number;
    departures: number;
    exceptions: number;
    holds: number;
  };
  filters: DeskFilters;
};
