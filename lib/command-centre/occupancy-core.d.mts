export interface OccupancyDay {
  date: string;
  totalSites: number;
  operatingSites: number;
  pausedSites: number;
  bookedSites: number;
  heldSites: number;
  pendingSites: number;
  bookedPercent: number;
  pausedPercent: number;
}

export interface OccupancySummary {
  generatedAt: string;
  firstDate: string;
  days: OccupancyDay[];
  totalSites: number;
  averageBookedPercent: number;
  bookedSiteNights: number;
  heldSiteNights: number;
  pausedSiteNights: number;
}

export function summarizeOccupancyRows(
  rows: Array<Omit<OccupancyDay, "bookedPercent" | "pausedPercent">>,
  observedAt?: Date,
): OccupancySummary;
