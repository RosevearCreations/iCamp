import type { SegmentComparisonSummary } from "./segment-comparison-core.mjs";

export interface ForecastVarianceRow {
  kind: SegmentComparisonSummary["segments"][number]["kind"];
  currentSiteNights: number;
  actualBookedNights: number;
  baselineSiteNights: number;
  baselineBookedNights: number;
  baselinePercent: number | null;
  actualPercent: number | null;
  expectedNights: number | null;
  varianceNights: number | null;
  variancePoints: number | null;
  reason: "no_current_inventory" | "no_baseline_inventory" | null;
}

export interface CapacityForecastVariance {
  currentMonth: string;
  baselineMonths: string[];
  generatedAt: string;
  rows: ForecastVarianceRow[];
  total: {
    actualBookedNights: number;
    expectedNights: number;
    currentSiteNights: number;
    excludedKinds: number;
    comparableKinds: number;
    varianceNights: number;
  };
}

export function summarizeCapacityForecastVariance(
  summary: SegmentComparisonSummary,
): CapacityForecastVariance;
