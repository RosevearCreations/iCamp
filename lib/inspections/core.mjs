export const inspectionTargetKinds = Object.freeze([
  "asset",
  "site",
  "cottage",
]);

export const inspectionResultValues = Object.freeze([
  "pass",
  "fail",
  "not_applicable",
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

export function validateInspectionTargetKind(value) {
  const kind = clean(value);
  if (!inspectionTargetKinds.includes(kind)) {
    throw new Error("Inspection target kind is invalid.");
  }
  return kind;
}

export function validateInspectionResultValue(value) {
  const result = clean(value);
  if (!inspectionResultValues.includes(result)) {
    throw new Error("Inspection result is invalid.");
  }
  return result;
}

export function parseInspectionItems(value) {
  const lines = String(value ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1 || lines.length > 100) {
    throw new Error("Inspection template requires 1 to 100 checklist items.");
  }

  const seen = new Set();
  return lines.map((label, index) => {
    if (label.length > 240) {
      throw new Error("Inspection item labels must be 240 characters or fewer.");
    }
    const key =
      label
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "")
        .slice(0, 80) || `item-${index + 1}`;
    let uniqueKey = key;
    let suffix = 2;
    while (seen.has(uniqueKey)) {
      uniqueKey = `${key.slice(0, 72)}-${suffix}`;
      suffix += 1;
    }
    seen.add(uniqueKey);
    return {
      itemKey: uniqueKey,
      position: index + 1,
      label,
      required: true,
      failureCreatesWorkOrder: true,
    };
  });
}

export function validateInspectionTemplateInput(input) {
  const targetKind = validateInspectionTargetKind(input?.targetKind);
  const assetId = clean(input?.assetId) || null;
  const accommodationId = clean(input?.accommodationId) || null;

  if (targetKind === "asset" && (!assetId || accommodationId)) {
    throw new Error("Asset inspection templates require exactly one asset.");
  }
  if (
    (targetKind === "site" || targetKind === "cottage") &&
    (!accommodationId || assetId)
  ) {
    throw new Error(
      "Site/cottage inspection templates require exactly one accommodation.",
    );
  }

  return {
    targetKind,
    assetId,
    accommodationId,
    name: requiredText(input?.name, 3, 160, "Template name"),
    description: optionalText(
      input?.description,
      2000,
      "Template description",
    ),
    versionInstructions: optionalText(
      input?.versionInstructions,
      4000,
      "Version instructions",
    ),
    signoffRequired: input?.signoffRequired === true,
    failureCategoryId: requiredText(
      input?.failureCategoryId,
      1,
      80,
      "Failure category",
    ),
    failurePriorityPolicyId: requiredText(
      input?.failurePriorityPolicyId,
      1,
      80,
      "Failure priority",
    ),
    items: parseInspectionItems(input?.itemsText),
  };
}

export function validateInspectionVersionInput(input) {
  return {
    versionInstructions: optionalText(
      input?.versionInstructions,
      4000,
      "Version instructions",
    ),
    signoffRequired: input?.signoffRequired === true,
    failureCategoryId: requiredText(
      input?.failureCategoryId,
      1,
      80,
      "Failure category",
    ),
    failurePriorityPolicyId: requiredText(
      input?.failurePriorityPolicyId,
      1,
      80,
      "Failure priority",
    ),
    items: parseInspectionItems(input?.itemsText),
  };
}

export function validateInspectionResultInput(input) {
  return {
    resultValue: validateInspectionResultValue(input?.resultValue),
    note: optionalText(input?.note, 2000, "Inspection result note"),
  };
}

export function validateInspectionSignoffInput(input) {
  const decision = clean(input?.decision);
  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Inspection sign-off decision is invalid.");
  }
  return {
    decision,
    note:
      decision === "rejected"
        ? requiredText(input?.note, 3, 2000, "Rejection note")
        : optionalText(input?.note, 2000, "Sign-off note"),
  };
}

export function formatInspectionTargetKind(value) {
  const kind = validateInspectionTargetKind(value);
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function formatInspectionStatus(value) {
  return clean(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
