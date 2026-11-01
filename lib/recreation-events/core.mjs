export const recreationCategories = Object.freeze([
  "family",
  "sports",
  "nature",
  "arts",
  "community",
  "other",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function recreationUuid(value, label = "Identifier") {
  const parsed = String(value ?? "").trim();
  if (!UUID.test(parsed)) throw new Error(`${label} must be a UUID.`);
  return parsed;
}

function text(value, label, maximum, minimum = 0) {
  const parsed = String(value ?? "").trim();
  if (
    /\p{Cc}/u.test(parsed) ||
    parsed.length < minimum ||
    parsed.length > maximum
  ) {
    throw new Error(
      `${label} must contain ${minimum}–${maximum} readable characters.`,
    );
  }
  return parsed;
}

function day(value) {
  const candidate = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate))
    throw new Error("Event date must be YYYY-MM-DD.");
  const [year, month, date] = candidate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  if (parsed.toISOString().slice(0, 10) !== candidate)
    throw new Error("Event date is invalid.");
  return candidate;
}

function clock(value) {
  const candidate = String(value ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(candidate))
    throw new Error("Event time must be HH:MM local campground time.");
  return candidate;
}

export function normalizeRecreationEvent(input) {
  const category = String(input?.category ?? "").trim();
  if (!recreationCategories.includes(category))
    throw new Error("Event category is invalid.");
  const eventDate = day(input?.eventDate);
  const startTime = clock(input?.startTime);
  const endTime = clock(input?.endTime);
  if (startTime >= endTime)
    throw new Error("Event end time must be after start time on the same day.");
  const capacityText = String(input?.capacityPlaces ?? "").trim();
  const capacityPlaces = capacityText === "" ? null : Number(capacityText);
  if (
    capacityPlaces !== null &&
    (!Number.isSafeInteger(capacityPlaces) ||
      capacityPlaces < 1 ||
      capacityPlaces > 500)
  ) {
    throw new Error("Event request capacity must be between 1 and 500.");
  }
  const isPublished = input?.isPublished === true;
  const requiresRegistration = input?.requiresRegistration === true;
  const acceptingRequests = input?.acceptingRequests === true;
  const status = input?.status === "cancelled" ? "cancelled" : "scheduled";
  if (
    acceptingRequests &&
    (!isPublished ||
      !requiresRegistration ||
      capacityPlaces === null ||
      status !== "scheduled")
  ) {
    throw new Error(
      "Requests may open only for a published, scheduled, registration-required event with source capacity.",
    );
  }
  return {
    category,
    title: text(input?.title, "Title", 160, 3),
    description: text(input?.description, "Description", 2000, 10),
    locationName: text(input?.locationName, "Venue", 160, 3),
    eventDate,
    startTime,
    endTime,
    capacityPlaces,
    requiresRegistration,
    acceptingRequests,
    accessibilityNote: text(
      input?.accessibilityNote,
      "Accessibility note",
      500,
    ),
    ageGuidance: text(input?.ageGuidance, "Age guidance", 240),
    isPublished,
    status,
  };
}

export function normalizeRecreationRequest(input) {
  const partySize = Number(input?.partySize);
  if (!Number.isSafeInteger(partySize) || partySize < 1 || partySize > 20) {
    throw new Error("Requested party size must be between 1 and 20.");
  }
  return {
    partySize,
    guestNote: text(input?.guestNote, "Guest note", 400),
    clientRequestId: recreationUuid(input?.clientRequestId, "Request ID"),
  };
}

export function recreationCapacityLabel(event) {
  if (event.status === "cancelled") return "Cancelled by campground";
  if (!event.requiresRegistration) return "No registration request needed";
  if (!event.acceptingRequests) return "Registration requests closed";
  if (event.capacityPlaces === null) return "Request capacity not supplied";
  const remaining = Math.max(
    0,
    event.capacityPlaces - (event.requestedPlaces ?? 0),
  );
  return remaining === 0
    ? "Request capacity reached"
    : `${remaining} of ${event.capacityPlaces} request places remain (not confirmed admission)`;
}

export function guestStayEligibleForEvent(stay, event) {
  return (
    stay.campgroundId === event.campgroundId &&
    ["confirmed", "checked_in"].includes(stay.status) &&
    event.eventDate >= stay.arrivalDate &&
    event.eventDate < stay.departureDate &&
    event.status === "scheduled" &&
    event.requiresRegistration &&
    event.acceptingRequests &&
    event.capacityPlaces !== null &&
    event.requestedPlaces < event.capacityPlaces
  );
}
