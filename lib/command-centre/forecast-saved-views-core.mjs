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

// An opt-in portable backup includes the authorized user/campground scope,
// so a recovery file cannot accidentally overwrite another scoped view list.
export function createSavedForecastBackup(views, { userId, campgroundId }) {
  if (!userId || !campgroundId || views.length > FORECAST_SAVED_LIMIT) {
    throw new Error("Invalid backup scope or number of saved views.");
  }
  const normalized = views.map(normalizeSavedForecastView);
  if (normalized.some((item) => !item)) {
    throw new Error("Invalid saved view in backup.");
  }
  return JSON.stringify({
    format: "icamp-scenario-preferences-v1",
    scope: { userId, campgroundId },
    views: normalized,
  });
}

export function recoverSavedForecastBackup(raw, { userId, campgroundId }) {
  if (typeof raw !== "string" || raw.length > 8_000) {
    throw new Error("Backup exceeds the 8 KB limit or is unreadable.");
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Backup is not valid JSON.");
  }
  if (
    payload?.format !== "icamp-scenario-preferences-v1" ||
    payload?.scope?.userId !== userId ||
    payload?.scope?.campgroundId !== campgroundId ||
    !Array.isArray(payload.views) ||
    payload.views.length > FORECAST_SAVED_LIMIT
  ) {
    throw new Error(
      "Backup format, signed-in user or campground does not match.",
    );
  }
  const views = payload.views.map(normalizeSavedForecastView);
  if (
    views.some((item) => !item) ||
    new Set(views.map((item) => item.key)).size !== views.length
  ) {
    throw new Error("Backup contains invalid or repeated scenario filters.");
  }
  return views;
}

// CSV values are quoted and formula-like labels are neutralized before they
// reach a spreadsheet. Figures come solely from the current authorized read.
function csvCell(value) {
  let cell = String(value ?? "Unavailable").replace(/[\r\n]+/g, " ");
  if (/^\s*[=+\-@\t]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function exportSavedForecastComparisonCsv(views, comparisons) {
  const header = [
    "Saved view",
    "Historical months",
    "Scenario",
    "Source observed at UTC",
    "Actual booked site nights",
    "Historical-rate estimate site nights",
    "Actual minus estimate site nights",
    "Comparable accommodation types",
    "Excluded accommodation types",
    "Interpretation",
  ];
  const rows = views.map((view) => {
    const item = comparisons.find(
      (candidate) =>
        candidate.lookbackMonths === view.lookbackMonths &&
        candidate.scenario === view.scenario,
    );
    return [
      view.label,
      view.lookbackMonths,
      view.scenario,
      item?.generatedAt ?? "Unavailable",
      item?.total?.actualBookedNights ?? "Unavailable",
      item?.total?.expectedNights ?? "Unavailable",
      item?.total?.varianceNights ?? "Unavailable",
      item?.total?.comparableKinds ?? "Unavailable",
      item?.total?.excludedKinds ?? "Unavailable",
      "Historical-rate sensitivity only; not future demand or authorization",
    ];
  });
  return (
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
