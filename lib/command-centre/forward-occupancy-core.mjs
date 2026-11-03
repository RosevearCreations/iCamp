import { SEGMENT_KINDS } from "./segment-comparison-core.mjs";

export const FORWARD_FORECAST_MODEL = "build195-seasonal-observation-v1";
export const FORWARD_FORECAST_HORIZONS = [1, 2, 3];
export const FORWARD_FORECAST_SCENARIOS = ["low", "typical", "high"];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const dateOf = (month) => new Date(`${month}T00:00:00.000Z`);
const monthOf = (date) => date.toISOString().slice(0, 7) + "-01";
const roundPercent = (rate) => Math.round(rate * 1000) / 10;

export function shiftForecastMonth(month, offset) {
  if (
    !MONTH.test(month) ||
    !Number.isInteger(offset) ||
    Math.abs(offset) > 48
  ) {
    throw new Error("Invalid forecast calendar month.");
  }
  const date = dateOf(month);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return monthOf(date);
}

function daysInMonth(month) {
  const date = dateOf(month);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function validateSource(source) {
  if (
    !source ||
    !Array.isArray(source.months) ||
    source.months.length !== 27 ||
    !Array.isArray(source.segments) ||
    source.segments.length !== SEGMENT_KINDS.length ||
    !source.operatingSites ||
    !Number.isFinite(Date.parse(source.generatedAt)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(source.asOfLocalDate ?? "") ||
    typeof source.timezone !== "string" ||
    source.timezone.length > 80
  )
    throw new Error("Complete and dated forecast source is required.");
  if (
    !source.months.every(
      (m, i) =>
        MONTH.test(m) &&
        (i === 0 || shiftForecastMonth(source.months[i - 1], 1) === m),
    )
  ) {
    throw new Error("Forecast source months must be consecutive.");
  }
  if (source.asOfLocalDate.slice(0, 7) + "-01" !== source.months.at(-1)) {
    throw new Error(
      "Forecast source current month does not match its local date.",
    );
  }
  const found = new Set();
  for (const segment of source.segments) {
    if (
      !SEGMENT_KINDS.includes(segment.kind) ||
      found.has(segment.kind) ||
      !Number.isSafeInteger(source.operatingSites[segment.kind]) ||
      source.operatingSites[segment.kind] < 0 ||
      !Array.isArray(segment.months) ||
      segment.months.length !== 27
    ) {
      throw new Error("Invalid forecast accommodation source.");
    }
    found.add(segment.kind);
    segment.months.forEach((row, index) => {
      if (
        row.month !== source.months[index] ||
        !Number.isSafeInteger(row.siteNights) ||
        row.siteNights < 0 ||
        !Number.isSafeInteger(row.bookedNights) ||
        row.bookedNights < 0 ||
        row.bookedNights > row.siteNights
      ) {
        throw new Error("Invalid or duplicate forecast source counts.");
      }
    });
  }
}

function estimate(segment, month, capacityNights, scenario, source) {
  const sourceMonths = [
    shiftForecastMonth(month, -24),
    shiftForecastMonth(month, -12),
  ];
  const observations = sourceMonths.map((target) =>
    segment.months.find((row) => row.month === target),
  );
  const coverage = observations.filter(
    (row) =>
      row && row.siteNights >= daysInMonth(row.month) && row.bookedNights > 0,
  ).length;
  const observedSiteNights = observations.reduce(
    (sum, row) => sum + (row?.siteNights ?? 0),
    0,
  );
  const common = {
    kind: segment.kind,
    month,
    capacityNights,
    sourceMonths,
    coverage,
    observedSiteNights,
  };
  const reason =
    capacityNights === 0
      ? "no_operating_inventory"
      : coverage !== 2 || observedSiteNights < 60
        ? "insufficient_recorded_history"
        : null;
  if (reason)
    return {
      ...common,
      reason,
      scenario,
      projectedNights: null,
      lowerNights: null,
      upperNights: null,
      selectedPercent: null,
      lowerPercent: null,
      upperPercent: null,
      confidence: "unavailable",
    };
  const rates = observations.map((row) => row.bookedNights / row.siteNights);
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  const typical =
    observations.reduce((sum, row) => sum + row.bookedNights, 0) /
    observedSiteNights;
  const selectedRate =
    scenario === "low" ? low : scenario === "high" ? high : typical;
  return {
    ...common,
    reason: null,
    scenario,
    projectedNights: Math.min(
      capacityNights,
      Math.round(selectedRate * capacityNights),
    ),
    lowerNights: Math.min(capacityNights, Math.round(low * capacityNights)),
    upperNights: Math.min(capacityNights, Math.round(high * capacityNights)),
    selectedPercent: roundPercent(selectedRate),
    lowerPercent: roundPercent(low),
    upperPercent: roundPercent(high),
    // Two seasonal observations cannot justify a calibrated statistical confidence claim.
    confidence: roundPercent(high - low) >= 20 ? "low" : "limited",
  };
}

export function buildForwardOccupancyForecast(
  source,
  { horizon = 3, scenario = "typical" } = {},
) {
  if (
    !FORWARD_FORECAST_HORIZONS.includes(horizon) ||
    !FORWARD_FORECAST_SCENARIOS.includes(scenario)
  ) {
    throw new Error("Invalid forward forecast options.");
  }
  validateSource(source);
  const currentMonth = source.months.at(-1);
  const projections = Array.from({ length: horizon }, (_, i) => {
    const month = shiftForecastMonth(currentMonth, i + 1);
    const rows = source.segments.map((segment) =>
      estimate(
        segment,
        month,
        source.operatingSites[segment.kind] * daysInMonth(month),
        scenario,
        source,
      ),
    );
    return {
      month,
      rows,
      total: {
        comparableKinds: rows.filter((row) => !row.reason).length,
        excludedKinds: rows.filter((row) => row.reason).length,
        projectedNights: rows.reduce(
          (sum, row) => sum + (row.projectedNights ?? 0),
          0,
        ),
        lowerNights: rows.reduce((sum, row) => sum + (row.lowerNights ?? 0), 0),
        upperNights: rows.reduce((sum, row) => sum + (row.upperNights ?? 0), 0),
      },
    };
  });
  const backtests = [2, 1].flatMap((offset) => {
    const month = shiftForecastMonth(currentMonth, -offset);
    return source.segments.map((segment) => {
      const actual = segment.months.find((row) => row.month === month);
      const comparison = estimate(
        segment,
        month,
        actual.siteNights,
        "typical",
        source,
      );
      return {
        ...comparison,
        actualBookedNights: actual.bookedNights,
        actualSiteNights: actual.siteNights,
        absoluteErrorNights:
          comparison.projectedNights === null
            ? null
            : Math.abs(actual.bookedNights - comparison.projectedNights),
      };
    });
  });
  return {
    modelVersion: FORWARD_FORECAST_MODEL,
    scenario,
    horizon,
    generatedAt: source.generatedAt,
    timezone: source.timezone,
    asOfLocalDate: source.asOfLocalDate,
    sourceFirstMonth: source.months[0],
    sourceLastMonth: source.months.at(-2),
    sourceDescription:
      "Confirmed/checked-in/completed reservations and active/ended seasonal assignments; current active inventory is used as a historical capacity proxy.",
    projections,
    backtests,
    eligibleRows: projections
      .flatMap((period) => period.rows)
      .filter((row) => !row.reason).length,
  };
}

const CSV_HEADERS = [
  "record_type",
  "campground_id",
  "model_version",
  "source_generated_at_utc",
  "campground_timezone",
  "source_first_month",
  "source_last_completed_month",
  "scenario",
  "month",
  "accommodation_kind",
  "historical_season_months",
  "historical_coverage",
  "historical_site_nights",
  "capacity_site_nights",
  "projected_booked_nights",
  "observed_range_low_nights",
  "observed_range_high_nights",
  "qualitative_confidence",
  "actual_booked_nights",
  "backtest_absolute_error_nights",
  "unavailable_reason",
  "source_limitations",
];

function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function forwardOccupancyCsv(report, campgroundId) {
  if (
    !report ||
    report.modelVersion !== FORWARD_FORECAST_MODEL ||
    typeof campgroundId !== "string" ||
    !/^[a-f\d-]{36}$/i.test(campgroundId)
  ) {
    throw new Error("Invalid authorized forecast export.");
  }
  const common = {
    campground_id: campgroundId,
    model_version: report.modelVersion,
    source_generated_at_utc: report.generatedAt,
    campground_timezone: report.timezone,
    source_first_month: report.sourceFirstMonth,
    source_last_completed_month: report.sourceLastMonth,
    scenario: report.scenario,
    source_limitations: `${report.sourceDescription} Two seasonal observations and observed ranges are not a calibrated probability interval, current availability, or a booking/revenue decision.`,
  };
  const records = [{ ...common, record_type: "provenance" }];
  for (const period of report.projections) {
    for (const row of period.rows)
      records.push({
        ...common,
        record_type: "projection",
        month: row.month,
        accommodation_kind: row.kind,
        historical_season_months: row.sourceMonths.join(" | "),
        historical_coverage: `${row.coverage}/2`,
        historical_site_nights: row.observedSiteNights,
        capacity_site_nights: row.capacityNights,
        projected_booked_nights: row.projectedNights,
        observed_range_low_nights: row.lowerNights,
        observed_range_high_nights: row.upperNights,
        qualitative_confidence: row.confidence,
        unavailable_reason: row.reason,
      });
  }
  for (const row of report.backtests)
    records.push({
      ...common,
      record_type: "backtest",
      month: row.month,
      accommodation_kind: row.kind,
      historical_season_months: row.sourceMonths.join(" | "),
      historical_coverage: `${row.coverage}/2`,
      historical_site_nights: row.observedSiteNights,
      capacity_site_nights: row.actualSiteNights,
      projected_booked_nights: row.projectedNights,
      observed_range_low_nights: row.lowerNights,
      observed_range_high_nights: row.upperNights,
      qualitative_confidence: row.confidence,
      actual_booked_nights: row.actualBookedNights,
      backtest_absolute_error_nights: row.absoluteErrorNights,
      unavailable_reason: row.reason,
    });
  return [
    CSV_HEADERS.join(","),
    ...records.map((record) =>
      CSV_HEADERS.map((header) => csvCell(record[header])).join(","),
    ),
    "",
  ].join("\r\n");
}
