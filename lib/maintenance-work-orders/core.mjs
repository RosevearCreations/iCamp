export const maintenanceWorkOrderStatuses = Object.freeze([
  "open",
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
]);

const transitionMap = Object.freeze({
  open: new Set(["assigned", "in_progress", "cancelled"]),
  assigned: new Set(["open", "in_progress", "blocked", "cancelled"]),
  in_progress: new Set(["assigned", "blocked", "completed", "cancelled"]),
  blocked: new Set(["assigned", "in_progress", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
});

function cleanText(value) {
  return String(value ?? "").trim();
}

function optionalText(value, maxLength, label) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function requiredText(value, minLength, maxLength, label) {
  const text = cleanText(value);
  if (text.length < minLength || text.length > maxLength) {
    throw new Error(
      `${label} must be between ${minLength} and ${maxLength} characters.`,
    );
  }
  return text;
}

function optionalId(value) {
  const text = cleanText(value);
  return text || null;
}

export function validateMaintenanceWorkOrderInput(input) {
  const title = requiredText(input?.title, 3, 160, "Work-order title");
  const description = optionalText(
    input?.description,
    4000,
    "Work-order description",
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

  return {
    title,
    description,
    categoryId,
    priorityPolicyId,
    sectionId,
    assetId,
    accommodationId,
    locationDescription,
  };
}

export function validateWorkOrderStatus(value) {
  const status = cleanText(value);
  if (!maintenanceWorkOrderStatuses.includes(status)) {
    throw new Error("Maintenance work-order status is invalid.");
  }
  return status;
}

export function validateMaintenanceStatusTransition(fromStatus, toStatus) {
  const from = validateWorkOrderStatus(fromStatus);
  const to = validateWorkOrderStatus(toStatus);

  if (from === to) {
    return to;
  }
  if (!transitionMap[from].has(to)) {
    throw new Error(
      `Unsupported maintenance status transition: ${from} → ${to}.`,
    );
  }
  return to;
}

export function validateMaintenanceNote(value) {
  return requiredText(value, 1, 4000, "Maintenance note");
}

export function validateMaintenanceMaterialInput(input) {
  const itemName = requiredText(input?.itemName, 1, 160, "Material name");
  const unit = requiredText(input?.unit, 1, 40, "Material unit");
  const quantity = Number(input?.quantity);
  const unitCostCents =
    input?.unitCostCents === null ||
    input?.unitCostCents === undefined ||
    cleanText(input?.unitCostCents) === ""
      ? null
      : Number(input.unitCostCents);

  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    throw new Error("Material quantity must be greater than zero.");
  }
  if (
    unitCostCents !== null &&
    (!Number.isInteger(unitCostCents) ||
      unitCostCents < 0 ||
      unitCostCents > 1_000_000_000)
  ) {
    throw new Error(
      "Material unit cost must be a valid non-negative cent value.",
    );
  }

  return { itemName, unit, quantity, unitCostCents };
}

export function validateMaintenanceLaborInput(input) {
  const minutes = Number(input?.minutes);
  const note = optionalText(input?.note, 1000, "Labour note");

  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) {
    throw new Error("Labour minutes must be between 1 and 10,080.");
  }

  return {
    workerUserId: optionalId(input?.workerUserId),
    minutes,
    note,
  };
}

export function validateCompletionSummary(value) {
  return requiredText(value, 8, 4000, "Completion summary");
}

export function formatMaintenanceStatus(value) {
  return validateWorkOrderStatus(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
