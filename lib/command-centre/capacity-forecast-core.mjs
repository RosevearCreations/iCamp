const KINDS = ["campsite", "rental_cottage", "permanent_unit"];
export const FORECAST_SCENARIOS = ["low", "weighted", "high"];
export const FORECAST_WINDOWS = [2, 3, 5];

function forecastSegment(segment, currentMonth, baselineMonths, scenario) {
  const current = segment.months.find((row) => row.month === currentMonth);
  const history = baselineMonths.map((month) =>
    segment.months.find((row) => row.month === month),
  );
  if (!current || history.some((row) => !row)) {
    throw new Error("Incomplete source months for capacity comparison.");
  }
  const previousSiteNights = history.reduce(
    (sum, row) => sum + row.siteNights,
    0,
  );
  const previousBookedNights = history.reduce(
    (sum, row) => sum + row.bookedNights,
    0,
  );
  const reason = !current.siteNights
    ? "no_current_inventory"
    : !previousSiteNights
      ? "no_baseline_inventory"
      : null;
  const monthlyRates = history
    .filter((row) => row.siteNights > 0)
    .map((row) => row.bookedNights / row.siteNights);
  const baselineRate = reason
    ? null
    : scenario === "low"
      ? Math.min(...monthlyRates)
      : scenario === "high"
        ? Math.max(...monthlyRates)
        : previousBookedNights / previousSiteNights;
  const expectedNights =
    baselineRate === null
      ? null
      : Math.round(baselineRate * current.siteNights);
  return {
    kind: segment.kind,
    currentSiteNights: current.siteNights,
    actualBookedNights: current.bookedNights,
    baselineSiteNights: previousSiteNights,
    baselineBookedNights: previousBookedNights,
    observedMonths: monthlyRates.length,
    baselinePercent:
      baselineRate === null ? null : Math.round(baselineRate * 1000) / 10,
    actualPercent: current.siteNights
      ? Math.round((current.bookedNights / current.siteNights) * 1000) / 10
      : null,
    expectedNights,
    varianceNights:
      expectedNights === null ? null : current.bookedNights - expectedNights,
    variancePoints:
      baselineRate === null
        ? null
        : Math.round(
            (current.bookedNights / current.siteNights - baselineRate) * 1000,
          ) / 10,
    reason,
  };
}

export function summarizeCapacityForecastVariance(
  summary,
  { lookbackMonths = 3, scenario = "weighted" } = {},
) {
  if (
    !FORECAST_WINDOWS.includes(lookbackMonths) ||
    !FORECAST_SCENARIOS.includes(scenario)
  ) {
    throw new Error("Unsupported historical forecast scenario or window.");
  }
  if (
    !summary ||
    !Array.isArray(summary.months) ||
    summary.months.length !== 6 ||
    !Array.isArray(summary.segments) ||
    summary.segments.length !== KINDS.length ||
    new Set(summary.segments.map((segment) => segment.kind)).size !==
      KINDS.length ||
    !KINDS.every((kind) => summary.segments.some((s) => s.kind === kind))
  ) {
    throw new Error("Complete six-month segment sources are required.");
  }
  const currentMonth = summary.months.at(-1);
  const baselineMonths = summary.months.slice(-lookbackMonths - 1, -1);
  const rows = summary.segments.map((segment) =>
    forecastSegment(segment, currentMonth, baselineMonths, scenario),
  );
  if (
    rows.some((row) =>
      [
        row.currentSiteNights,
        row.actualBookedNights,
        row.baselineSiteNights,
        row.baselineBookedNights,
      ].some((n) => !Number.isSafeInteger(n) || n < 0),
    ) ||
    rows.some(
      (row) =>
        row.actualBookedNights > row.currentSiteNights ||
        row.baselineBookedNights > row.baselineSiteNights,
    )
  ) {
    throw new Error("Invalid source counts for capacity comparison.");
  }
  const comparable = rows.filter((row) => row.reason === null);
  const total = {
    actualBookedNights: comparable.reduce(
      (sum, row) => sum + row.actualBookedNights,
      0,
    ),
    expectedNights: comparable.reduce(
      (sum, row) => sum + row.expectedNights,
      0,
    ),
    currentSiteNights: comparable.reduce(
      (sum, row) => sum + row.currentSiteNights,
      0,
    ),
    excludedKinds: rows.filter((row) => row.reason !== null).length,
  };
  return {
    currentMonth,
    baselineMonths,
    lookbackMonths,
    scenario,
    generatedAt: summary.generatedAt,
    rows,
    total: {
      ...total,
      varianceNights: total.actualBookedNights - total.expectedNights,
      comparableKinds: comparable.length,
    },
  };
}
