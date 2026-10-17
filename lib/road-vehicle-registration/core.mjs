const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);
const VEHICLE_KINDS = new Set([
  "car",
  "truck",
  "suv",
  "van",
  "motorcycle",
  "tow_vehicle",
  "other",
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

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

function requiredDate(value, label) {
  const normalized = String(value ?? "").trim();
  if (!DATE_PATTERN.test(normalized)) {
    throw new Error(label + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(normalized + "T00:00:00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
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

export function normalizeRoadVehicleSourceChannel(value) {
  const channel = String(value ?? "staff")
    .trim()
    .toLowerCase();
  if (!SOURCE_CHANNELS.has(channel)) {
    throw new Error("Road vehicle source channel is invalid.");
  }
  return channel;
}

export function normalizeRoadVehicleRegistrationInput(input = {}) {
  const vehicleKind = String(input.vehicleKind ?? "")
    .trim()
    .toLowerCase();
  if (!VEHICLE_KINDS.has(vehicleKind)) {
    throw new Error("Vehicle kind is invalid.");
  }

  const validFrom = requiredDate(input.validFrom, "Valid from");
  const validUntil = requiredDate(input.validUntil, "Valid until");
  if (validUntil < validFrom) {
    throw new Error("Valid until must be on or after valid from.");
  }

  return {
    vehicleKind,
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
    registeredOwnerName: cleanText(
      input.registeredOwnerName,
      "Registered owner",
      160,
      true,
    ),
    primaryDriverName: cleanText(
      input.primaryDriverName,
      "Primary driver",
      160,
      true,
    ),
    validFrom,
    validUntil,
    notes: cleanText(input.notes, "Vehicle registration notes", 2000),
  };
}

export function normalizeRoadVehicleRevocationReason(value) {
  return cleanText(value, "Revocation reason", 500, true);
}
