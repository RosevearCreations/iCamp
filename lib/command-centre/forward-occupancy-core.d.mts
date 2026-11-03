export type ForecastKind = "campsite" | "rental_cottage" | "permanent_unit";
export type ForwardScenario = "low" | "typical" | "high";
export interface ForecastMonthSource {
  month: string;
  siteNights: number;
  bookedNights: number;
}
export interface ForwardSource {
  generatedAt: string;
  asOfLocalDate: string;
  timezone: string;
  months: string[];
  operatingSites: Record<ForecastKind, number>;
  segments: Array<{ kind: ForecastKind; months: ForecastMonthSource[] }>;
}
export interface ForwardRow {
  kind: ForecastKind;
  month: string;
  capacityNights: number;
  sourceMonths: string[];
  coverage: number;
  observedSiteNights: number;
  scenario: ForwardScenario;
  reason: "no_operating_inventory" | "insufficient_recorded_history" | null;
  projectedNights: number | null;
  lowerNights: number | null;
  upperNights: number | null;
  selectedPercent: number | null;
  lowerPercent: number | null;
  upperPercent: number | null;
  confidence: "unavailable" | "low" | "limited";
}
export interface ForwardOccupancyReport {
  modelVersion: string;
  scenario: ForwardScenario;
  horizon: 1 | 2 | 3;
  generatedAt: string;
  timezone: string;
  asOfLocalDate: string;
  sourceFirstMonth: string;
  sourceLastMonth: string;
  sourceDescription: string;
  projections: Array<{
    month: string;
    rows: ForwardRow[];
    total: {
      comparableKinds: number;
      excludedKinds: number;
      projectedNights: number;
      lowerNights: number;
      upperNights: number;
    };
  }>;
  backtests: Array<
    ForwardRow & {
      actualBookedNights: number;
      actualSiteNights: number;
      absoluteErrorNights: number | null;
    }
  >;
  eligibleRows: number;
}
export const FORWARD_FORECAST_MODEL: string;
export const FORWARD_FORECAST_HORIZONS: Array<1 | 2 | 3>;
export const FORWARD_FORECAST_SCENARIOS: ForwardScenario[];
export function shiftForecastMonth(month: string, offset: number): string;
export function buildForwardOccupancyForecast(
  source: ForwardSource,
  options?: { horizon?: 1 | 2 | 3; scenario?: ForwardScenario },
): ForwardOccupancyReport;
export function forwardOccupancyCsv(
  report: ForwardOccupancyReport,
  campgroundId: string,
): string;
