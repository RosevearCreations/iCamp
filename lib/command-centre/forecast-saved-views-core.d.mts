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
