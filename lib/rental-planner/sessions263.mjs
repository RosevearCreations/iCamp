const UUID263 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const ACTIVITIES263 = Object.freeze([
  "guided_horse",
  "paddling_instruction",
  "kite_clinic",
  "guided_nature",
  "other_guided",
]);

function minute263(input, label) {
  const value = String(input ?? "").trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value))
    throw new Error(label + " must be a valid local 24-hour time.");
  const [hour, minute] = value.split(":").map(Number);
  if (minute % 15 !== 0)
    throw new Error(label + " must be on a 15-minute boundary.");
  return hour * 60 + minute;
}

function validDay263(input) {
  const value = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new Error("Proposed session date must be YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  if (
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !==
    value
  )
    throw new Error("Proposed session date is not a calendar day.");
  return value;
}

export function normalizeRentalSession263(input) {
  const offerId = String(input?.offerId ?? "").trim();
  if (!UUID263.test(offerId))
    throw new Error("Original rental offer ID is invalid.");
  const plannedDay = validDay263(input?.plannedDay);
  const startMinute = minute263(input?.start, "Start time");
  const endMinute = minute263(input?.end, "End time");
  if (endMinute <= startMinute || endMinute - startMinute > 360)
    throw new Error(
      "Staff-planned sessions must last 15 minutes to six hours on one day.",
    );
  const participantLimit = Number(input?.participantLimit);
  if (
    !Number.isSafeInteger(participantLimit) ||
    participantLimit < 1 ||
    participantLimit > 30
  )
    throw new Error("Participant planning cap must be 1 to 30.");
  const activityKind = String(input?.activityKind ?? "").trim();
  if (!ACTIVITIES263.includes(activityKind))
    throw new Error("Unrecognized supervised activity kind.");
  const safetyBrief = String(input?.safetyBrief ?? "").trim();
  if (
    safetyBrief.length < 15 ||
    safetyBrief.length > 500 ||
    /\p{Cc}/u.test(safetyBrief)
  )
    throw new Error(
      "Human-reviewed safety brief must have 15–500 readable characters.",
    );
  return {
    offerId,
    plannedDay,
    startMinute,
    endMinute,
    participantLimit,
    activityKind,
    safetyBrief,
    status: "planned",
    guestBookingsCreated: false,
  };
}

export function inventoryReadiness263(assets, offers) {
  const items = Array.isArray(assets) ? assets : [];
  const listing = Array.isArray(offers) ? offers : [];
  const ids = new Set(items.map((asset) => asset.id));
  const listingIds = new Set(listing.map((item) => item.assetId));
  return {
    registeredEligibleAssetsObserved: ids.size,
    publishedOffersObserved: listing.filter((item) => item.isPublished).length,
    unpublishedOffersObserved: listing.filter((item) => !item.isPublished)
      .length,
    operationalCandidatesObserved: items.filter(
      (item) =>
        item.operatingState === "operational" &&
        item.lifecycleState === "active",
    ).length,
    notYetListedCandidatesObserved: items.filter(
      (item) => !listingIds.has(item.id),
    ).length,
    evidenceMayBeTruncated: items.length >= 200 || listing.length >= 150,
    originalInventoryVerifiedComplete: false,
    rentalReservationsConfirmed: 0,
  };
}

export function sessionLocalClock263(minute) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440)
    throw new Error("Invalid session local clock time.");
  return (
    String(Math.floor(minute / 60)).padStart(2, "0") +
    ":" +
    String(minute % 60).padStart(2, "0")
  );
}
