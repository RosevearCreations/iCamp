export const facilityUpkeepKinds = Object.freeze([
  "washroom",
  "shower",
  "laundry",
  "combined",
]);

export const cleanlinessStates = Object.freeze([
  "clean",
  "service_due",
  "closed_for_service",
]);

export const fixtureStates = Object.freeze([
  "operational",
  "attention",
  "out_of_service",
]);

export const supplyStates = Object.freeze([
  "stocked",
  "low",
  "out",
  "not_applicable",
]);

export const facilityIssueKinds = Object.freeze([
  "cleanliness",
  "fixture",
  "supply",
  "safety",
  "laundry_machine",
  "other",
]);

function clean(value) {
  return String(value ?? "").trim();
}

function requiredText(value, min, max, label) {
  const text = clean(value);
  if (text.length < min || text.length > max) {
    throw new Error(`${label} must be between ${min} and ${max} characters.`);
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

function oneOf(value, choices, label) {
  const text = clean(value);
  if (!choices.includes(text)) {
    throw new Error(`${label} is invalid.`);
  }
  return text;
}

export function validateFacilityUpkeepKind(value) {
  return oneOf(value, facilityUpkeepKinds, "Facility upkeep type");
}

export function validateFacilityUpkeepProgramInput(input) {
  return {
    assetId: requiredText(input?.assetId, 1, 80, "Facility"),
    facilityKind: validateFacilityUpkeepKind(input?.facilityKind),
    inspectionTemplateId: requiredText(
      input?.inspectionTemplateId,
      1,
      80,
      "Inspection template",
    ),
    maintenanceScheduleId: requiredText(
      input?.maintenanceScheduleId,
      1,
      80,
      "Maintenance schedule",
    ),
    notes: optionalText(input?.notes, 2000, "Program notes"),
    isActive: input?.isActive !== false,
  };
}

export function validateFacilitySnapshotInput(input) {
  return {
    cleanlinessState: oneOf(
      input?.cleanlinessState,
      cleanlinessStates,
      "Cleanliness state",
    ),
    fixtureState: oneOf(input?.fixtureState, fixtureStates, "Fixture state"),
    supplyState: oneOf(input?.supplyState, supplyStates, "Supply state"),
    notes: optionalText(input?.notes, 2000, "Snapshot notes"),
  };
}

export function validateFacilityIssueInput(input) {
  return {
    issueKind: oneOf(input?.issueKind, facilityIssueKinds, "Issue type"),
    title: requiredText(input?.title, 3, 160, "Issue title"),
    description: optionalText(input?.description, 4000, "Issue description"),
    categoryId: requiredText(input?.categoryId, 1, 80, "Maintenance category"),
    priorityPolicyId: requiredText(
      input?.priorityPolicyId,
      1,
      80,
      "Maintenance priority",
    ),
  };
}

export function formatFacilityUpkeepKind(value) {
  const kind = validateFacilityUpkeepKind(value);
  if (kind === "combined") return "Combined comfort station";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function formatFacilityState(value) {
  return clean(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
