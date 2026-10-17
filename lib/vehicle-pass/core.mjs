const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);
const NON_STAY_PASS_KINDS = new Set(["day", "week"]);
const LOCAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

function cleanText(value, label, max, required = false) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(label + " is required.");
    return null;
  }
  if (normalized.length > max) {
    throw new Error(label + " must be " + max + " characters or fewer.");
  }
  return normalized;
}

function optionalId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function integer(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(label + " is invalid.");
  }
  return parsed;
}

function localTimestamp(value, label) {
  const normalized = String(value ?? "").trim();
  if (!LOCAL_TIMESTAMP_PATTERN.test(normalized)) {
    throw new Error(label + " must use YYYY-MM-DDTHH:MM.");
  }
  const parsed = new Date(normalized + ":00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 16) !== normalized
  ) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function upperIdentifier(value, label, max) {
  const normalized = cleanText(value, label, max, true).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 .-]*$/u.test(normalized)) {
    throw new Error(label + " contains unsupported characters.");
  }
  return normalized;
}

export function normalizeVehiclePassSourceChannel(value) {
  const channel = String(value ?? "staff")
    .trim()
    .toLowerCase();
  if (!SOURCE_CHANNELS.has(channel)) {
    throw new Error("Vehicle pass source channel is invalid.");
  }
  return channel;
}

export function normalizeNonStayVehiclePassInput(input = {}) {
  const passKind = String(input.passKind ?? "")
    .trim()
    .toLowerCase();
  if (!NON_STAY_PASS_KINDS.has(passKind)) {
    throw new Error("Non-stay vehicle pass kind must be day or week.");
  }

  const validFromLocal = localTimestamp(input.validFromLocal, "Valid from");
  const validUntilLocal = localTimestamp(input.validUntilLocal, "Valid until");
  if (validUntilLocal <= validFromLocal) {
    throw new Error("Valid until must be after valid from.");
  }

  const durationMs =
    new Date(validUntilLocal + ":00Z").getTime() -
    new Date(validFromLocal + ":00Z").getTime();
  const maxMs =
    passKind === "day" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (durationMs > maxMs) {
    throw new Error(
      passKind === "day"
        ? "Day vehicle pass validity cannot exceed 24 hours."
        : "Week vehicle pass validity cannot exceed 7 days.",
    );
  }

  return {
    passKind,
    plateNumber: upperIdentifier(input.plateNumber, "Plate number", 24),
    plateJurisdiction: upperIdentifier(
      input.plateJurisdiction,
      "Plate jurisdiction",
      40,
    ),
    vehicleDescription: cleanText(
      input.vehicleDescription,
      "Vehicle description",
      240,
      true,
    ),
    driverName: cleanText(input.driverName, "Driver name", 160, true),
    validFromLocal,
    validUntilLocal,
    notes: cleanText(input.notes, "Vehicle pass notes", 2000),
  };
}

export function normalizeExtraVehiclePassInput(input = {}) {
  const roadVehicleRegistrationId = optionalId(input.roadVehicleRegistrationId);
  if (!roadVehicleRegistrationId) {
    throw new Error("Road vehicle registration is required.");
  }

  const validFromLocal = localTimestamp(input.validFromLocal, "Valid from");
  const validUntilLocal = localTimestamp(input.validUntilLocal, "Valid until");
  if (validUntilLocal <= validFromLocal) {
    throw new Error("Valid until must be after valid from.");
  }

  return {
    roadVehicleRegistrationId,
    validFromLocal,
    validUntilLocal,
    notes: cleanText(input.notes, "Extra-vehicle pass notes", 2000),
  };
}

export function normalizeVehiclePassPolicyInput(input = {}) {
  return {
    dayPassChargeId: optionalId(input.dayPassChargeId),
    weekPassChargeId: optionalId(input.weekPassChargeId),
    extraVehicleChargeId: optionalId(input.extraVehicleChargeId),
    includedStayVehicleCount: integer(
      input.includedStayVehicleCount ?? 1,
      "Included stay vehicle count",
      0,
      20,
    ),
    parkingRule: cleanText(input.parkingRule, "Parking rule", 1000, true),
    accessRule: cleanText(input.accessRule, "Access rule", 1000, true),
  };
}

export function normalizeVehiclePassRevocationReason(value) {
  return cleanText(value, "Revocation reason", 500, true);
}

export function effectiveVehiclePassStatus({
  passStatus,
  validFrom,
  validUntil,
  now = new Date(),
}) {
  if (passStatus === "revoked" || passStatus === "pending_payment") {
    return passStatus;
  }
  const current = now instanceof Date ? now : new Date(now);
  const from = new Date(validFrom);
  const until = new Date(validUntil);
  if (current < from) return "scheduled";
  if (current > until) return "expired";
  return "active";
}
