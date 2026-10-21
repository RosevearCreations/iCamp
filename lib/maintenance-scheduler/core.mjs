export const maintenanceRecurrenceKinds = Object.freeze([
  "hourly",
  "every_n_hours",
  "daily",
  "weekly",
  "monthly",
  "seasonal",
  "custom",
]);

export const maintenanceCatchUpModes = Object.freeze([
  "create_late",
  "mark_missed",
]);

function clean(value) {
  return String(value ?? "").trim();
}

function requiredText(value, min, max, label) {
  const text = clean(value);
  if (text.length < min || text.length > max) {
    throw new Error(
      `${label} must be between ${min} and ${max} characters.`,
    );
  }
  return text;
}

function optionalText(value, max, label) {
  const text = clean(value);
  if (!text) return null;
  if (text.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return text;
}

function optionalId(value) {
  return clean(value) || null;
}

function integer(value, min, max, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

export function validateMaintenanceRecurrenceKind(value) {
  const kind = clean(value);
  if (!maintenanceRecurrenceKinds.includes(kind)) {
    throw new Error("Maintenance recurrence kind is invalid.");
  }
  return kind;
}

export function validateMaintenanceCatchUpMode(value) {
  const mode = clean(value);
  if (!maintenanceCatchUpModes.includes(mode)) {
    throw new Error("Maintenance catch-up mode is invalid.");
  }
  return mode;
}

export function validateFirstOccurrenceLocal(value) {
  const text = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    throw new Error("First occurrence must be a local date and time.");
  }
  return text;
}

export function validateMaintenanceScheduleInput(input) {
  const title = requiredText(input?.title, 3, 160, "Schedule title");
  const description = optionalText(
    input?.description,
    4000,
    "Schedule description",
  );
  const categoryId = requiredText(input?.categoryId, 1, 80, "Category");
  const priorityPolicyId = requiredText(
    input?.priorityPolicyId,
    1,
    80,
    "Priority",
  );
  const sectionId = optionalId(input?.sectionId);
  const assetId = optionalId(input?.assetId);
  const accommodationId = optionalId(input?.accommodationId);
  const locationDescription = optionalText(
    input?.locationDescription,
    240,
    "Location description",
  );

  if (!sectionId && !assetId && !accommodationId && !locationDescription) {
    throw new Error(
      "Choose a section, asset, accommodation, or enter a location description.",
    );
  }

  const recurrenceKind = validateMaintenanceRecurrenceKind(
    input?.recurrenceKind,
  );
  let intervalValue = null;
  let weekday = null;
  let monthDay = null;
  let seasonMonth = null;
  let seasonDay = null;

  if (recurrenceKind === "hourly") {
    intervalValue = 1;
  } else if (recurrenceKind === "every_n_hours") {
    intervalValue = integer(input?.intervalValue, 2, 168, "Hour interval");
  } else if (recurrenceKind === "daily") {
    intervalValue = 1;
  } else if (recurrenceKind === "weekly") {
    weekday = integer(input?.weekday, 0, 6, "Weekday");
  } else if (recurrenceKind === "monthly") {
    monthDay = integer(input?.monthDay, 1, 31, "Month day");
  } else if (recurrenceKind === "seasonal") {
    seasonMonth = integer(input?.seasonMonth, 1, 12, "Season month");
    seasonDay = integer(input?.seasonDay, 1, 31, "Season day");
  } else if (recurrenceKind === "custom") {
    intervalValue = integer(
      input?.intervalValue,
      60,
      525600,
      "Custom interval minutes",
    );
  }

  const firstOccurrenceLocal = validateFirstOccurrenceLocal(
    input?.firstOccurrenceLocal,
  );
  const missedAfterMinutes = integer(
    input?.missedAfterMinutes ?? 1440,
    0,
    10080,
    "Missed-after threshold",
  );
  const catchUpMode = validateMaintenanceCatchUpMode(
    input?.catchUpMode ?? "create_late",
  );

  return {
    title,
    description,
    categoryId,
    priorityPolicyId,
    sectionId,
    assetId,
    accommodationId,
    locationDescription,
    recurrenceKind,
    intervalValue,
    weekday,
    monthDay,
    seasonMonth,
    seasonDay,
    firstOccurrenceLocal,
    missedAfterMinutes,
    catchUpMode,
  };
}

export function recurrenceLabel(schedule) {
  switch (schedule.recurrenceKind) {
    case "hourly":
      return "Hourly";
    case "every_n_hours":
      return `Every ${schedule.intervalValue} hours`;
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return `Monthly on day ${schedule.monthDay}`;
    case "seasonal":
      return `Seasonal on ${schedule.seasonMonth}/${schedule.seasonDay}`;
    case "custom":
      return `Every ${schedule.intervalValue} minutes`;
    default:
      return "Recurring";
  }
}

export function formatOccurrenceState(value) {
  return clean(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
