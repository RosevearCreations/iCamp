const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function rentalUuid(value, label = "Identifier") {
  const parsed = String(value ?? "").trim();
  if (!UUID.test(parsed)) throw new Error(`${label} must be a UUID.`);
  return parsed;
}

function readable(value, label, min, max) {
  const parsed = String(value ?? "").trim();
  if (/\p{Cc}/u.test(parsed) || parsed.length < min || parsed.length > max)
    throw new Error(`${label} must contain ${min}–${max} readable characters.`);
  return parsed;
}

function date(value) {
  const parsed = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed))
    throw new Error("Rental date must be YYYY-MM-DD.");
  const [y, m, d] = parsed.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== parsed)
    throw new Error("Rental date is invalid.");
  return parsed;
}

export function normalizeRentalWindow(input) {
  const start = String(input?.startDate ?? "").trim();
  const end = String(input?.endDate ?? "").trim();
  if (!start && !end) return null;
  if (!start || !end)
    throw new Error("Both pickup and return dates are required.");
  const startDate = date(start);
  const endDate = date(end);
  const days =
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)) /
        86400000,
    ) + 1;
  if (days < 1 || days > 14)
    throw new Error("Rental planning window must be 1–14 calendar days.");
  return { startDate, endDate, days };
}

export function normalizeRentalOffer(input) {
  const maxDays = Number(input?.maxDays);
  if (!Number.isSafeInteger(maxDays) || maxDays < 1 || maxDays > 14)
    throw new Error("Maximum rental days must be 1–14.");
  const isPublished = input?.isPublished === true;
  const acceptingRequests = input?.acceptingRequests === true;
  if (acceptingRequests && !isPublished)
    throw new Error("Request intake requires publication.");
  return {
    description: readable(input?.description, "Description", 10, 1200),
    accessibilityNote: readable(
      input?.accessibilityNote,
      "Accessibility note",
      0,
      500,
    ),
    returnGuidance: readable(input?.returnGuidance, "Return guidance", 0, 500),
    maxDays,
    isPublished,
    acceptingRequests,
  };
}

export function normalizeRentalRequest(input) {
  const window = normalizeRentalWindow(input);
  if (!window) throw new Error("Pickup and return dates are required.");
  return {
    ...window,
    guestNote: readable(input?.guestNote, "Guest note", 0, 400),
    clientRequestId: rentalUuid(input?.clientRequestId, "Request ID"),
  };
}

export function rentalAvailabilityLabel(offer, window) {
  if (!offer.sourceReady)
    return "Unavailable: the registered asset is not operational";
  if (!offer.acceptingRequests) return "Rental planning requests are closed";
  if (!window)
    return "Choose pickup and return dates to check planning capacity";
  if (window.days > offer.maxDays)
    return `Maximum planning window is ${offer.maxDays} days`;
  if (window.startDate < offer.localDate)
    return "These dates have passed at this campground";
  return offer.available
    ? "One provisional planning request slot for these dates (not an allocation)"
    : "No provisional planning slot for these dates";
}

export function guestStayEligibleForRental(stay, offer, window) {
  return Boolean(
    window &&
    stay.campgroundId === offer.campgroundId &&
    ["confirmed", "checked_in"].includes(stay.status) &&
    stay.arrivalDate <= window.startDate &&
    stay.departureDate >= window.endDate &&
    offer.sourceReady &&
    offer.isPublished &&
    offer.acceptingRequests &&
    offer.available &&
    window.startDate >= offer.localDate &&
    window.days <= offer.maxDays,
  );
}
