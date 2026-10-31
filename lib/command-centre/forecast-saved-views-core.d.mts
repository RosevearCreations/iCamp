import type { CapacityForecastVariance } from "./capacity-forecast-core.mjs";

export interface SavedForecastView {
  key: string;
  label: string;
  lookbackMonths: CapacityForecastVariance["lookbackMonths"];
  scenario: CapacityForecastVariance["scenario"];
}
export const FORECAST_SAVED_LIMIT: number;
export const FORECAST_ACTIVITY_LIMIT: number;
export interface ForecastActivityEvent {
  action:
    | "backup"
    | "comparison_csv"
    | "recovery"
    | "verification_match"
    | "verification_mismatch";
  occurredAt: string;
  viewCount: number;
  sha256: string;
}
export function sha256Hex(contents: string): Promise<string>;
export function sha256ArrayBuffer(bytes: ArrayBuffer): Promise<string>;
export function parseExpectedSha256(raw: unknown, filename: string): string;
export function verifyExportChecksum(
  bytes: ArrayBuffer,
  expected: string,
  filename: string,
): Promise<{ actualSha256: string; expectedSha256: string; matches: boolean }>;
export function parseForecastActivityHistory(
  raw: unknown,
): ForecastActivityEvent[];
export function recordForecastActivity(
  history: ForecastActivityEvent[],
  event: ForecastActivityEvent,
): ForecastActivityEvent[];
export function serializeForecastActivityHistory(
  history: ForecastActivityEvent[],
): string;
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
