export const offlineMaintenanceOperationKinds = Object.freeze([
  "work_order_note",
  "inspection_result",
  "work_order_media",
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function clean(value) {
  return String(value ?? "").trim();
}

function uuid(value, label) {
  const normalized = clean(value);
  if (!uuidPattern.test(normalized)) {
    throw new Error(label + " must be a UUID.");
  }
  return normalized.toLowerCase();
}

function rowVersion(value, label, allowNull = false) {
  if (allowNull && (value === null || value === undefined || value === "")) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(label + " must be a positive row version.");
  }
  return parsed;
}

function text(value, min, max, label, optional = false) {
  const normalized = clean(value);
  if (optional && !normalized) return null;
  if (normalized.length < min || normalized.length > max) {
    throw new Error(
      label + " must be between " + min + " and " + max + " characters.",
    );
  }
  return normalized;
}

export function validateOfflineMaintenanceOperation(input) {
  const operationKind = clean(input?.operationKind);
  if (!offlineMaintenanceOperationKinds.includes(operationKind)) {
    throw new Error(
      "Offline maintenance only accepts note, checklist-result, and media-evidence operations.",
    );
  }

  const common = {
    clientOperationId: uuid(input?.clientOperationId, "Client operation ID"),
    campgroundId: uuid(input?.campgroundId, "Campground ID"),
    operationKind,
    targetId: uuid(input?.targetId, "Target ID"),
  };

  if (operationKind === "work_order_note") {
    return {
      ...common,
      expectedWorkOrderRowVersion: rowVersion(
        input?.expectedWorkOrderRowVersion,
        "Expected work-order row version",
      ),
      note: text(input?.note, 1, 4000, "Maintenance note"),
    };
  }

  if (operationKind === "inspection_result") {
    const resultValue = clean(input?.resultValue);
    if (!["pass", "fail", "not_applicable"].includes(resultValue)) {
      throw new Error("Offline inspection result is invalid.");
    }
    return {
      ...common,
      templateItemId: uuid(input?.templateItemId, "Inspection item ID"),
      expectedOccurrenceRowVersion: rowVersion(
        input?.expectedOccurrenceRowVersion,
        "Expected inspection row version",
      ),
      expectedResultRowVersion: rowVersion(
        input?.expectedResultRowVersion,
        "Expected inspection-result row version",
        true,
      ),
      resultValue,
      note: text(
        input?.note,
        1,
        2000,
        "Inspection result note",
        true,
      ),
    };
  }

  const checksum = clean(input?.fileChecksumSha256).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(checksum)) {
    throw new Error("Offline media checksum must be SHA-256.");
  }

  return {
    ...common,
    expectedWorkOrderRowVersion: rowVersion(
      input?.expectedWorkOrderRowVersion,
      "Expected work-order row version",
    ),
    caption: text(input?.caption, 1, 500, "Media caption", true),
    fileChecksumSha256: checksum,
  };
}

export function offlineMaintenanceSyncState(value) {
  const state = clean(value);
  if (!["pending", "syncing", "conflict", "blocked"].includes(state)) {
    throw new Error("Offline maintenance sync state is invalid.");
  }
  return state;
}
