export const aquaticFacilityTypes = Object.freeze(["pool", "water_park"]);
export const aquaticPublicStates = Object.freeze(["open", "limited", "closed"]);

const publicToOperational = Object.freeze({
  open: "operational",
  limited: "limited",
  closed: "closed",
});

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

export function validateAquaticFacilityType(value) {
  const kind = clean(value);
  if (!aquaticFacilityTypes.includes(kind)) {
    throw new Error("Aquatic facility type is invalid.");
  }
  return kind;
}

export function validateAquaticPublicState(value) {
  const state = clean(value);
  if (!aquaticPublicStates.includes(state)) {
    throw new Error("Aquatic operating state is invalid.");
  }
  return state;
}

export function aquaticOperationalState(value) {
  return publicToOperational[validateAquaticPublicState(value)];
}

export function aquaticPublicStateFromOperational(value) {
  const state = clean(value);
  if (state === "operational") return "open";
  if (state === "limited") return "limited";
  return "closed";
}

export function validateAquaticProgramInput(input) {
  const minutes = Number(input?.reopenInspectionMaxAgeMinutes ?? 240);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 10_080) {
    throw new Error(
      "Reopen inspection freshness must be between 15 and 10,080 minutes.",
    );
  }

  return {
    assetId: requiredText(input?.assetId, 1, 80, "Aquatic facility"),
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
    reopenInspectionMaxAgeMinutes: minutes,
    notes: optionalText(input?.notes, 2000, "Program notes"),
    isActive: input?.isActive !== false,
  };
}

export function validateAquaticDecisionInput(input) {
  const publicState = validateAquaticPublicState(input?.publicState);
  return {
    publicState,
    operationalState: aquaticOperationalState(publicState),
    reason: requiredText(input?.reason, 8, 1000, "Operating decision reason"),
  };
}

export function formatAquaticFacilityType(value) {
  const kind = validateAquaticFacilityType(value);
  return kind === "water_park" ? "Water park" : "Pool";
}

export function formatAquaticPublicState(value) {
  const state = validateAquaticPublicState(value);
  return state.charAt(0).toUpperCase() + state.slice(1);
}
