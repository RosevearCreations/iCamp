export const recreationMaintenanceKinds = Object.freeze(["baseball_softball","sports_field","playground","hall"]);

export const surfaceStates = Object.freeze(["ready","attention","unsafe","not_applicable"]);

export const safetyStates = Object.freeze(["clear","monitor","restrict_use","close_area"]);

export const amenityStates = Object.freeze(["operational","attention","out_of_service","not_applicable"]);

export const recreationIssueKinds = Object.freeze(["playing_surface","field_markings","drainage","fencing","sports_equipment","playground_equipment","hall_fixture","lighting","cleanliness","safety","other"]);

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

export function validateRecreationMaintenanceKind(value) {
  return oneOf(value, recreationMaintenanceKinds, "Recreation maintenance type");
}

export function validateRecreationMaintenanceProgramInput(input) {
  return {
    assetId: requiredText(input?.assetId, 1, 80, "Facility"),
    profileKind: validateRecreationMaintenanceKind(input?.profileKind),
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

export function validateRecreationSnapshotInput(input) {
  return {
    surfaceState: oneOf(
      input?.surfaceState,
      surfaceStates,
      "Cleanliness state",
    ),
    safetyState: oneOf(input?.safetyState, safetyStates, "Fixture state"),
    amenityState: oneOf(input?.amenityState, amenityStates, "Supply state"),
    notes: optionalText(input?.notes, 2000, "Snapshot notes"),
  };
}

export function validateRecreationIssueInput(input) {
  return {
    issueKind: oneOf(input?.issueKind, recreationIssueKinds, "Issue type"),
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

export function formatRecreationMaintenanceKind(value) {
  const kind = validateRecreationMaintenanceKind(value);
  if (kind === "baseball_softball") return "Baseball / softball field";
  if (kind === "sports_field") return "Sports field";
  if (kind === "playground") return "Playground";
  return "Hall / recreation building";
}

export function formatRecreationState(value) {
  return clean(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
