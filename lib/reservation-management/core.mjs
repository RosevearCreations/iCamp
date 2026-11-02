const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function dateText(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new Error(label + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(text + "T00:00:00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(label + " is invalid.");
  }
  return text;
}

function boundedText(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max) {
    throw new Error(
      label + " must be between " + min + " and " + max + " characters.",
    );
  }
  return text;
}

function cents(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 200000000) {
    throw new Error(label + " is invalid.");
  }
  return parsed;
}

function quantity(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error(label + " must be between 1 and 1000.");
  }
  return parsed;
}

export function parseManagementChargeSelections(value) {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      code: boundedText(item?.code, "Charge code", 1, 80),
      quantity: quantity(item?.quantity, "Charge quantity"),
    }));
  }

  const text = String(value ?? "").trim();
  if (!text) return [];

  const selections = [];
  const seen = new Set();
  for (const token of text.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const [rawCode, rawQuantity = "1"] = trimmed.split(":");
    const code = boundedText(rawCode, "Charge code", 1, 80);
    if (seen.has(code)) {
      throw new Error("Duplicate charge selection: " + code + ".");
    }
    seen.add(code);
    selections.push({
      code,
      quantity: quantity(rawQuantity, "Charge quantity"),
    });
  }
  return selections;
}

export function normalizeReservationManagementInput(input = {}) {
  const accommodationId = String(input.accommodationId ?? "").trim();
  if (!UUID_PATTERN.test(accommodationId)) {
    throw new Error("Accommodation is invalid.");
  }

  const arrivalDate = dateText(input.arrivalDate, "Arrival date");
  const departureDate = dateText(input.departureDate, "Departure date");
  if (departureDate <= arrivalDate) {
    throw new Error("Departure must be after arrival.");
  }

  const guestDisplayName = boundedText(
    input.guestDisplayName,
    "Guest display name",
    1,
    160,
  );
  const contactEmail = String(input.contactEmail ?? "")
    .trim()
    .toLowerCase();
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    throw new Error("Contact email is invalid.");
  }

  return {
    accommodationId,
    arrivalDate,
    departureDate,
    guestDisplayName,
    contactEmail: contactEmail || null,
    selections: parseManagementChargeSelections(
      input.selections ?? input.chargeSelections ?? [],
    ),
  };
}

export function normalizeManagementReason(value) {
  return boundedText(value, "Change reason", 3, 1000);
}

export function classifyReservationChange(before, after) {
  if (before.status !== "cancelled" && after.status === "cancelled") {
    return "cancel";
  }

  if (String(before.accommodationId) !== String(after.accommodationId)) {
    return "move";
  }

  const arrivalChanged = before.arrivalDate !== after.arrivalDate;
  const departureChanged = before.departureDate !== after.departureDate;

  if (arrivalChanged || departureChanged) {
    const extended =
      after.arrivalDate < before.arrivalDate ||
      after.departureDate > before.departureDate;
    const shortened =
      after.arrivalDate > before.arrivalDate ||
      after.departureDate < before.departureDate;

    if (extended && !shortened) return "extend";
    if (shortened && !extended) return "shorten";
    return "edit";
  }

  if (
    cents(before.currentTotalCents, "Previous total") !==
      cents(after.currentTotalCents, "Revised total") ||
    JSON.stringify(before.chargeSelections ?? []) !==
      JSON.stringify(after.chargeSelections ?? [])
  ) {
    return "fees";
  }

  return "edit";
}

export function calculateReservationFinancialDelta({
  previousTotalCents,
  revisedTotalCents,
  capturedCents = 0,
  hasPaymentSchedule = false,
  cancelled = false,
}) {
  const previous = cents(previousTotalCents, "Previous total");
  const revised = cents(revisedTotalCents, "Revised total");
  const captured = cents(capturedCents, "Captured amount");
  const deltaCents = revised - previous;
  const financialReviewRequired =
    (cancelled && captured > 0) ||
    (deltaCents !== 0 && (captured > 0 || hasPaymentSchedule));

  let financialReviewReason = null;
  if (cancelled && captured > 0) {
    financialReviewReason =
      "Captured payment exists. Refund/forfeit handling is deferred to Build 045.";
  } else if (financialReviewRequired) {
    financialReviewReason =
      "Managed total changed after payment scheduling/payment activity. Build 045 must reconcile the financial adjustment.";
  }

  return {
    previousTotalCents: previous,
    revisedTotalCents: revised,
    deltaCents,
    capturedCents: captured,
    financialReviewRequired,
    financialReviewReason,
  };
}

export function reservationManagementSnapshot({
  reservation,
  guestDisplayName,
  contactEmail = null,
  currencyCode,
  staySubtotalCents,
  chargeTotalCents,
  chargeSelections = [],
  financialReviewRequired = false,
  financialReviewReason = null,
}) {
  const stay = cents(staySubtotalCents, "Stay subtotal");
  const charges = cents(chargeTotalCents, "Charge total");
  const currency = String(currencyCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new Error("Currency code is invalid.");
  }

  return {
    version: 1,
    reservation: {
      id: reservation.id,
      status: reservation.status,
      accommodationId: reservation.accommodationId,
      accommodationCode: reservation.accommodationCode,
      accommodationName: reservation.accommodationName,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
    },
    guest: {
      displayName: guestDisplayName,
      contactEmail,
    },
    pricing: {
      currencyCode: currency,
      staySubtotalCents: stay,
      chargeTotalCents: charges,
      currentTotalCents: stay + charges,
      chargeSelections,
    },
    financialReviewRequired,
    financialReviewReason,
    immutableSourcesPreserved: {
      build041Checkout: true,
      build042PaymentSchedule: true,
      build043Documents: true,
    },
  };
}
