const SOURCE_CHANNELS = new Set([
  "web",
  "staff",
  "ivr",
  "sms",
  "system",
]);
const RETURN_STATES = new Set([
  "not_applicable",
  "complete",
  "follow_up_required",
]);

function cleanText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > max) {
    throw new Error(label + " must be " + max + " characters or fewer.");
  }
  return normalized;
}

function asBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function returnState(value, label) {
  const normalized = String(value ?? "not_applicable")
    .trim()
    .toLowerCase();
  if (!RETURN_STATES.has(normalized)) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

export function normalizeCheckOutSourceChannel(value) {
  const normalized = String(value ?? "staff")
    .trim()
    .toLowerCase();
  if (!SOURCE_CHANNELS.has(normalized)) {
    throw new Error("Checkout source channel is invalid.");
  }
  return normalized;
}

export function normalizeReservationCheckOutInput(input = {}) {
  if (!asBoolean(input.departureConfirmed)) {
    throw new Error("Departure must be confirmed before checkout.");
  }

  return {
    departureConfirmed: true,
    financialFollowUpAcknowledged: asBoolean(
      input.financialFollowUpAcknowledged,
    ),
    rentalReturnState: returnState(
      input.rentalReturnState,
      "Rental return state",
    ),
    keyReturnState: returnState(input.keyReturnState, "Key return state"),
    credentialReturnState: returnState(
      input.credentialReturnState,
      "Credential return state",
    ),
    returnNotes: cleanText(input.returnNotes, "Return notes", 2000),
    departureNotes: cleanText(
      input.departureNotes,
      "Departure notes",
      2000,
    ),
  };
}
