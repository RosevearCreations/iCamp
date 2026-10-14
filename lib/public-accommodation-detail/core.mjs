export function normalizePublicAccommodationDates(input = {}) {
  const arrivalDate = String(input.arrivalDate ?? "").trim();
  const departureDate = String(input.departureDate ?? "").trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

  if (!isoDate.test(arrivalDate) || !isoDate.test(departureDate)) {
    throw new Error("Arrival and departure dates are required.");
  }

  const arrival = Date.parse(arrivalDate + "T00:00:00Z");
  const departure = Date.parse(departureDate + "T00:00:00Z");
  if (
    !Number.isFinite(arrival) ||
    !Number.isFinite(departure) ||
    departure <= arrival
  ) {
    throw new Error("Departure must be after arrival.");
  }

  return {
    arrivalDate,
    departureDate,
    nights: Math.round((departure - arrival) / 86400000),
  };
}

export function humanizePublicFact(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function publicRateSummary() {
  return Object.freeze({
    status: "rate_plans_pending",
    label: "Rate plans are not published yet",
    detail:
      "Build 039 owns authoritative nightly, weekly, monthly, seasonal, yearly and cottage pricing. No price is shown until the server can calculate it from canonical rate plans.",
  });
}
