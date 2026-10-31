export interface SeasonalMonth {
  month: string;
  siteNights: number;
  bookedNights: number;
  seasonalNights: number;
  reservationNights: number;
  bookedPercent: number;
  seasonalPercent: number;
}

export interface SeasonalTrendsSummary {
  generatedAt: string;
  months: SeasonalMonth[];
  siteNights: number;
  bookedNights: number;
  seasonalNights: number;
  reservationNights: number;
  averageBookedPercent: number;
}

export function summarizeSeasonalTrends(
  rows: Array<Omit<SeasonalMonth, "bookedPercent" | "seasonalPercent">>,
  observedAt?: Date,
): SeasonalTrendsSummary;
