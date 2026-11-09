export const FULFILLMENT_FORECAST_HORIZON_DAYS = 30;
export const FULFILLMENT_FORECAST_WINDOW_NAMES = Object.freeze([
  "morning",
  "afternoon",
  "evening",
]);

const localTimePattern = /^(?:0[4-9]|1[0-9]|2[0-3]):[0-5][0-9]$/u;

export function validateFulfillmentPlanningSettings(input) {
  const windows = {};
  let previousEnd = null;
  for (const window of FULFILLMENT_FORECAST_WINDOW_NAMES) {
    const start = String(input?.[`${window}Start`] ?? "").trim();
    const end = String(input?.[`${window}End`] ?? "").trim();
    if (
      !localTimePattern.test(start) ||
      !localTimePattern.test(end) ||
      start >= end ||
      (previousEnd !== null && start < previousEnd)
    ) {
      throw new Error(
        "Set nonoverlapping campground-local service windows between 04:00 and 23:59.",
      );
    }
    windows[`${window}Start`] = start;
    windows[`${window}End`] = end;
    previousEnd = end;
  }
  const rawLimit = String(input?.maxUnitsPerStaffWindow ?? "").trim();
  let maxUnitsPerStaffWindow = null;
  if (rawLimit !== "") {
    if (!/^[1-9][0-9]*$/u.test(rawLimit)) {
      throw new Error("The staff-window limit must be a whole number.");
    }
    maxUnitsPerStaffWindow = Number(rawLimit);
    if (
      !Number.isSafeInteger(maxUnitsPerStaffWindow) ||
      maxUnitsPerStaffWindow > 1000
    ) {
      throw new Error("The staff-window limit must be from 1 to 1000 units.");
    }
  }
  const expectedRowVersion = Number(input?.expectedRowVersion);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0) {
    throw new Error("The settings version is invalid; refresh and retry.");
  }
  return { ...windows, maxUnitsPerStaffWindow, expectedRowVersion };
}

export function classifyFulfillmentForecast({
  assignedUserId,
  activeStaff,
  serviceWindow,
  windowsConfigured,
  declaredUnavailable,
  hasCoveringShift,
  hasOverlappingShift,
  units,
  maxUnitsPerStaffWindow,
}) {
  if (!assignedUserId) return "unassigned";
  if (!activeStaff) return "inactive_staff";
  if (serviceWindow === "anytime") return "window_unspecified";
  if (!windowsConfigured) return "windows_unconfigured";
  if (declaredUnavailable) return "declared_unavailable";
  if (!hasCoveringShift) {
    return hasOverlappingShift ? "partial_shift" : "no_shift_on_record";
  }
  if (
    maxUnitsPerStaffWindow !== null &&
    Number(units) > Number(maxUnitsPerStaffWindow)
  ) {
    return "over_capacity";
  }
  return maxUnitsPerStaffWindow === null ? "coverage_only" : "within_limit";
}

export const FULFILLMENT_FORECAST_LABELS = Object.freeze({
  unassigned: "Unassigned work",
  inactive_staff: "Assigned employee not currently eligible",
  window_unspecified: "Choose a specific service window",
  windows_unconfigured: "Local service windows not configured",
  declared_unavailable: "Recorded staff unavailability overlaps",
  partial_shift: "Shift only partially covers service window",
  no_shift_on_record: "No covering shift on record",
  over_capacity: "Above configured workload limit",
  coverage_only: "Shift coverage recorded; no unit limit set",
  within_limit: "Shift coverage and unit limit satisfied",
});
