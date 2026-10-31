import type { CapacityForecastVariance } from "./capacity-forecast-core.mjs";

export interface SavedForecastView {
  key: string;
  label: string;
  lookbackMonths: CapacityForecastVariance["lookbackMonths"];
  scenario: CapacityForecastVariance["scenario"];
}
export const FORECAST_SAVED_LIMIT: number;
export function normalizeSavedForecastView(
  input: unknown,
): SavedForecastView | null;
export function parseSavedForecastViews(raw: unknown): SavedForecastView[];
export function upsertSavedForecastView(
  views: SavedForecastView[],
  input: unknown,
): SavedForecastView[];
export function serializeSavedForecastViews(views: SavedForecastView[]): string;
export function createSavedForecastBackup(
  views: SavedForecastView[],
  scope: { userId: string; campgroundId: string },
): string;
export function recoverSavedForecastBackup(
  raw: unknown,
  scope: { userId: string; campgroundId: string },
): SavedForecastView[];
export function exportSavedForecastComparisonCsv(
  views: SavedForecastView[],
  comparisons: Array<{
    lookbackMonths: SavedForecastView["lookbackMonths"];
    scenario: SavedForecastView["scenario"];
    generatedAt: string;
    total: {
      actualBookedNights: number;
      expectedNights: number;
      varianceNights: number;
      comparableKinds: number;
      excludedKinds: number;
    };
  }>,
): string;
