const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const LODGING_KINDS = new Set(["tent", "rv", "cottage"]);

function text(value, label, minimum, maximum) {
  const normalized = String(value ?? "").trim();
  if (
    normalized.length < minimum ||
    normalized.length > maximum
  ) {
    throw new Error(
      label + " must be between " + minimum + " and " + maximum + " characters.",
    );
  }
  return normalized;
}

function integer(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      label +
        " must be a whole number between " +
        minimum +
        " and " +
        maximum +
        ".",
    );
  }
  return number;
}

function optionalPositive(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1000) {
    throw new Error(label + " must be greater than zero.");
  }
  return Math.round(number * 100) / 100;
}

function yes(value) {
  return (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === "on" ||
    value === "yes"
  );
}

export function normalizeCheckoutChargeSelections(input = []) {
  const selections = [];
  const seen = new Set();

  for (const raw of input) {
    const code = String(raw?.code ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(code) || code.length > 80) {
      throw new Error("Booking charge selection code is invalid.");
    }
    if (seen.has(code)) {
      throw new Error("Duplicate booking charge selection: " + code + ".");
    }
    seen.add(code);
    selections.push({
      code,
      quantity: integer(raw?.quantity, "Charge quantity", 1, 1000),
    });
  }

  return selections;
}

export function normalizeReservationCheckoutInput(input = {}) {
  const email = text(input.contactEmail, "Contact email", 3, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("A valid contact email is required.");
  }

  const lodgingKind = String(input.lodgingKind ?? "").trim();
  if (!LODGING_KINDS.has(lodgingKind)) {
    throw new Error("Stay type must be tent, RV or cottage.");
  }

  if (!yes(input.rulesAcknowledged)) {
    throw new Error("Campground booking rules must be acknowledged.");
  }

  return {
    primaryFirstName: text(input.primaryFirstName, "First name", 1, 80),
    primaryLastName: text(input.primaryLastName, "Last name", 1, 80),
    contactEmail: email,
    contactPhone: text(input.contactPhone, "Contact phone", 7, 40),
    occupants: integer(input.occupants, "Occupants", 1, 80),
    visitors: integer(input.visitors ?? 0, "Visitors", 0, 80),
    pets: integer(input.pets ?? 0, "Pets", 0, 20),
    vehicles: integer(input.vehicles ?? 0, "Vehicles", 0, 20),
    lodgingKind,
    rvLengthMeters: optionalPositive(input.rvLengthMeters, "RV length"),
    rvWidthMeters: optionalPositive(input.rvWidthMeters, "RV width"),
    rvHeightMeters: optionalPositive(input.rvHeightMeters, "RV height"),
    electricalAmperage: integer(
      input.electricalAmperage ?? 0,
      "Electrical amperage",
      0,
      50,
    ),
    needsWaterAtSite: yes(input.needsWaterAtSite),
    needsWastewaterAtSite: yes(input.needsWastewaterAtSite),
    needsWifi: yes(input.needsWifi),
    needsStepFreeAccess: yes(input.needsStepFreeAccess),
    needsAccessibleWashroom: yes(input.needsAccessibleWashroom),
    selections: normalizeCheckoutChargeSelections(input.selections ?? []),
    rulesAcknowledged: true,
  };
}

export function finalReservationQuote({ stayQuote, chargeQuote }) {
  if (!stayQuote || stayQuote.status !== "quoted") {
    const error = new Error("A current accommodation rate is required.");
    error.code = "ICAMP_CHECKOUT_RATE_UNAVAILABLE";
    throw error;
  }
  if (!chargeQuote || chargeQuote.currencyCode !== stayQuote.currencyCode) {
    const error = new Error("Reservation quote currency is inconsistent.");
    error.code = "ICAMP_CHECKOUT_CURRENCY_MISMATCH";
    throw error;
  }

  return {
    currencyCode: stayQuote.currencyCode,
    staySubtotalCents: stayQuote.totalCents,
    chargeTotalCents: chargeQuote.totalCents,
    totalCents: stayQuote.totalCents + chargeQuote.totalCents,
  };
}

export function checkoutErrorCode(error) {
  const message = String(error?.message ?? "");
  const explicit = String(error?.code ?? "");
  if (explicit.startsWith("ICAMP_CHECKOUT_")) return explicit;
  const match = message.match(/ICAMP_CHECKOUT_[A-Z_]+/u);
  if (match) return match[0];
  if (/Accommodation conflicts with/u.test(message)) {
    return "ICAMP_CHECKOUT_HOLD_REVALIDATION_FAILED";
  }
  return null;
}
