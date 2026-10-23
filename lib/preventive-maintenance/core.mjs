export const preventiveAssetClasses = ["facility", "equipment", "either"];

function clean(value) {
  return String(value ?? "").trim();
}

function optional(value, maxLength, label) {
  const normalized = clean(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return normalized;
}

export function validatePreventiveMaintenanceTemplateInput(input = {}) {
  const targetAssetClass = clean(input.targetAssetClass);
  const name = clean(input.name);
  const description = optional(input.description, 4000, "Description");
  const serviceInstructions = clean(input.serviceInstructions);

  if (!preventiveAssetClasses.includes(targetAssetClass)) {
    throw new Error("Preventive-maintenance target class is invalid.");
  }
  if (name.length < 3 || name.length > 160) {
    throw new Error("Template name must be between 3 and 160 characters.");
  }
  if (
    serviceInstructions.length < 3 ||
    serviceInstructions.length > 8000
  ) {
    throw new Error(
      "Service instructions must be between 3 and 8,000 characters.",
    );
  }

  return {
    targetAssetClass,
    name,
    description,
    serviceInstructions,
  };
}

export function validatePreventiveMaintenanceProgramInput(input = {}) {
  const assetId = clean(input.assetId);
  const templateId = clean(input.templateId);
  const maintenanceScheduleId = clean(input.maintenanceScheduleId);
  const notes = optional(input.notes, 2000, "Program notes");

  if (!assetId || !templateId || !maintenanceScheduleId) {
    throw new Error(
      "Asset, preventive-maintenance template and recurring schedule are required.",
    );
  }

  return {
    assetId,
    templateId,
    maintenanceScheduleId,
    notes,
    isActive: input.isActive !== false,
  };
}

export function preventiveInstructionSteps(value) {
  return String(value ?? "")
    .split(/\r?\n/u)
    .map((step) => step.trim())
    .filter(Boolean);
}

export function formatPreventiveAssetClass(value) {
  if (value === "either") return "Facility or equipment";
  return value === "equipment" ? "Equipment" : "Facility";
}
