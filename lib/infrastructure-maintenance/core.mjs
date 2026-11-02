export const infrastructureMaintenanceKinds = Object.freeze([
  "road",
  "parking",
  "utility",
  "garbage_area",
  "septic_area",
]);

export const surfaceStates = Object.freeze([
  "ready",
  "attention",
  "unsafe",
  "not_applicable",
]);

export const safetyStates = Object.freeze([
  "clear",
  "monitor",
  "restrict_use",
  "close_area",
]);

export const serviceStates = Object.freeze([
  "operational",
  "attention",
  "out_of_service",
  "not_applicable",
]);

export const infrastructureIssueKinds = Object.freeze([
  "road_surface",
  "parking_surface",
  "drainage",
  "electrical",
  "water_supply",
  "sewer_septic",
  "garbage_recycling",
  "lighting",
  "signage",
  "safety",
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

export function validateInfrastructureMaintenanceKind(value) {
  return oneOf(
    value,
    infrastructureMaintenanceKinds,
    "Infrastructure maintenance type",
  );
}

export function validateInfrastructureMaintenanceProgramInput(input) {
  return {
    assetId: requiredText(input?.assetId, 1, 80, "Facility"),
    profileKind: validateInfrastructureMaintenanceKind(input?.profileKind),
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

export function validateInfrastructureSnapshotInput(input) {
  return {
    surfaceState: oneOf(input?.surfaceState, surfaceStates, "Surface state"),
    safetyState: oneOf(input?.safetyState, safetyStates, "Safety state"),
    serviceState: oneOf(
      input?.serviceState,
      serviceStates,
      "Infrastructure service state",
    ),
    notes: optionalText(input?.notes, 2000, "Snapshot notes"),
  };
}

export function validateInfrastructureIssueInput(input) {
  return {
    issueKind: oneOf(input?.issueKind, infrastructureIssueKinds, "Issue type"),
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

export function formatInfrastructureMaintenanceKind(value) {
  const kind = validateInfrastructureMaintenanceKind(value);
  if (kind === "road") return "Road";
  if (kind === "parking") return "Parking area";
  if (kind === "utility") return "Utility";
  if (kind === "garbage_area") return "Garbage / recycling area";
  return "Septic area";
}

export function formatInfrastructureState(value) {
  return clean(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
