import {
  FORECAST_SCENARIOS,
  FORECAST_WINDOWS,
} from "./capacity-forecast-core.mjs";

export const FORECAST_SAVED_LIMIT = 8;

export function normalizeSavedForecastView(input) {
  if (!input || typeof input !== "object") return null;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (
    !label ||
    label.length > 48 ||
    !FORECAST_WINDOWS.includes(input.lookbackMonths) ||
    !FORECAST_SCENARIOS.includes(input.scenario)
  ) {
    return null;
  }
  return {
    key: `${input.lookbackMonths}:${input.scenario}`,
    label,
    lookbackMonths: input.lookbackMonths,
    scenario: input.scenario,
  };
}

// Only labels and validated filter choices are stored; never booking data,
// occupancy figures, campground names or evidence records.
export function parseSavedForecastViews(raw) {
  if (typeof raw !== "string" || raw.length > 8_000) return [];
  try {
    const payload = JSON.parse(raw);
    if (payload.version !== 1 || !Array.isArray(payload.views)) return [];
    const unique = new Set();
    const views = [];
    for (const item of payload.views.slice(0, FORECAST_SAVED_LIMIT)) {
      const normalized = normalizeSavedForecastView(item);
      if (normalized && !unique.has(normalized.key)) {
        unique.add(normalized.key);
        views.push(normalized);
      }
    }
    return views;
  } catch {
    return [];
  }
}

export function upsertSavedForecastView(views, input) {
  const next = normalizeSavedForecastView(input);
  if (!next) throw new Error("Enter a name and supported scenario filters.");
  const existing = views.filter((view) => view.key !== next.key);
  if (existing.length >= FORECAST_SAVED_LIMIT) {
    throw new Error("Remove a saved view before adding another.");
  }
  return [...existing, next];
}

export function serializeSavedForecastViews(views) {
  return JSON.stringify({ version: 1, views });
}
