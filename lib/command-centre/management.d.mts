import type { MaintenanceWorkOrderBoard } from "../maintenance-work-orders/postgres.mjs";
import type { ReservationManagementConsole } from "../reservation-management/postgres.mjs";

export type CampgroundCommandSnapshot = {
  asOf: string;
  today: string;
  siteCount: number | null;
  availableSites: number | null;
  visibleReservationCount: number | null;
  reservationRowsCapped: boolean;
  arrivalsThisWeek: number | null;
  financialReviews: number | null;
  openWorkOrders: number | null;
  blockedWorkOrders: number | null;
  reservationAvailable: boolean;
  maintenanceAvailable: boolean;
  recentArrivals: Array<{
    id: string;
    date: string;
    site: string;
    label: string;
    status: string;
  }>;
  workOrderQueue: Array<{
    id: string;
    label: string;
    status: string;
    priority: string;
  }>;
};

export function buildManagementSnapshot(input: {
  reservations?: Pick<
    ReservationManagementConsole,
    "reservations" | "accommodations"
  > | null;
  maintenance?: Pick<
    MaintenanceWorkOrderBoard,
    "workOrders" | "accommodations"
  > | null;
  now?: Date;
  timezone?: string;
}): CampgroundCommandSnapshot;
