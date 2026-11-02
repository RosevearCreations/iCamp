export const campsiteTypes = Object.freeze(["tent", "rv", "mixed"]);

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

export function validateCampsiteType(value) {
  const text = clean(value);
  if (!campsiteTypes.includes(text)) {
    throw new Error("Campsite type is invalid.");
  }
  return text;
}

export function validateDepartureCleanupProgramInput(input) {
  return {
    accommodationId: requiredText(input?.accommodationId, 1, 80, "Campsite"),
    campsiteType: validateCampsiteType(input?.campsiteType),
    inspectionTemplateId: requiredText(
      input?.inspectionTemplateId,
      1,
      80,
      "Inspection template",
    ),
    blockRebookingUntilClear: input?.blockRebookingUntilClear !== false,
    notes: optionalText(input?.notes, 2000, "Program notes"),
    isActive: input?.isActive !== false,
  };
}

export function formatCampsiteType(value) {
  const type = validateCampsiteType(value);
  if (type === "rv") return "RV";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatCleanupState(task) {
  if (task?.clearedAt) return "Cleared";
  if (!task?.programId) return "Configuration required";
  if (!task?.inspectionOccurrenceId) return "Ready for inspection";
  if (task?.inspectionStatus === "in_progress") return "Inspection in progress";
  if (task?.inspectionStatus === "submitted") return "Awaiting sign-off";
  if (task?.inspectionStatus === "rejected") return "Inspection rejected";
  if (Number(task?.openCorrectiveWorkOrders ?? 0) > 0) {
    return "Corrective work open";
  }
  if (task?.inspectionStatus === "signed_off") return "Ready to clear";
  return "Cleanup pending";
}
