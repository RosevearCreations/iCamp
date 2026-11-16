export const BOOKING258_SCHEMA = "icamp.booking-date-window.v1";
export const BOOKING258_PROTOCOL = Object.freeze({
  major: 1,
  minor: 1,
  legacyMinor: 0,
  independentRelease: true,
  crossAppConnected: false,
  automaticWaitlistPromotion: false,
});
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DAY = 86400000;
const isDate = (s) => {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const ms = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s;
};
const hold = (code) => ({
  valid: false,
  code,
  siteHeld: false,
  bookingConfirmed: false,
  waitlistOffered: false,
});

export function reviewBookingWindow({
  arrivalDate,
  departureDate,
  maxNights = 90,
  nowDate = null,
} = {}) {
  if (!isDate(arrivalDate) || !isDate(departureDate))
    return hold("HOLD_INVALID_CALENDAR_DATE");
  const nights = Math.round(
    (Date.parse(departureDate + "T00:00:00Z") -
      Date.parse(arrivalDate + "T00:00:00Z")) /
      DAY,
  );
  if (nights < 1 || nights > maxNights)
    return hold("HOLD_STAY_LENGTH_OUTSIDE_BOUNDS");
  if (nowDate !== null && (!isDate(nowDate) || arrivalDate < nowDate))
    return hold("HOLD_ARRIVAL_IN_PAST");
  return {
    valid: true,
    status: "READ_ONLY_AVAILABILITY_WINDOW",
    arrivalDate,
    departureDate,
    nights,
    nightsLabel: nights === 1 ? "1 night" : nights + " nights",
    departureExclusive: true,
    siteHeld: false,
    bookingConfirmed: false,
  };
}

/** UI-only aggregation from one canonical live map snapshot. */
export function summarizePublicInventory(items, window) {
  if (!window?.valid || !Array.isArray(items))
    return { status: "HOLD_UNVERIFIED_AVAILABILITY", counts: null };
  const counters = {
    available: 0,
    reservedOrHeld: 0,
    maintenance: 0,
    closed: 0,
    total: 0,
  };
  for (const item of items) {
    const tone = item?.tone;
    if (!["green", "grey", "yellow", "red"].includes(tone))
      return { status: "HOLD_UNKNOWN_MAP_STATUS", counts: null };
    const key =
      tone === "green"
        ? "available"
        : tone === "grey"
          ? "reservedOrHeld"
          : tone === "yellow"
            ? "maintenance"
            : "closed";
    // A supplied green tone cannot defeat the canonical selectable flag.
    if ((tone === "green") !== (item.selectable === true))
      return { status: "HOLD_MAP_AVAILABILITY_MISMATCH", counts: null };
    counters[key] += 1;
    counters.total += 1;
  }
  return {
    status: "LIVE_SOURCE_SUMMARY_READ_ONLY",
    counts: counters,
    generatedAtRequired: true,
    noInventoryReservation: true,
    noWaitlistOffer: true,
  };
}

/** Source-health adapter for a future three-Master instrument dashboard.
 * No PII, tenant names, site identifiers, infrastructure controls or secrets.
 * Cannot assert YW state and cannot unlock an unauthenticated remote reader. */
export function buildICampInstrumentSignal({
  sourceRevision,
  observedAt,
  availability = null,
  integrationStatus = "HOLD",
  databaseStatus = "UNKNOWN",
} = {}) {
  if (
    !/^[0-9a-f]{40}$/u.test(String(sourceRevision ?? "")) ||
    !Number.isFinite(Date.parse(observedAt ?? ""))
  )
    return { status: "HOLD_UNVERIFIED_SOURCE_REVISION" };
  return {
    schema: "rosevear.master-instrument.source-signal.v1",
    sourceAppId: "icamp",
    platformRole: "GOVERNED_EXTERNAL_SHELL",
    protocol: "1.1",
    backwardCompatible: "1.0",
    revision: sourceRevision,
    observedAt,
    bookingInventory:
      availability?.status === "LIVE_SOURCE_SUMMARY_READ_ONLY"
        ? availability.counts
        : null,
    database: databaseStatus === "HEALTHY" ? "HEALTHY" : "UNVERIFIED",
    integration:
      integrationStatus === "CONNECTED_AUTHENTICATED"
        ? "UNVERIFIED_RUNTIME_ACK"
        : "HOLD",
    issues: [
      ...(databaseStatus === "HEALTHY" ? [] : ["DATABASE_NOT_VERIFIED"]),
      "INDEPENDENT_MASTER_AUTH_REQUIRED",
    ],
    customerDataIncluded: false,
    crossAppDeliveryAuthorized: false,
    homeAutomationCommandsAllowed: false,
    receiverConnected: false,
  };
}

export function reviewWaitlistInterest({
  campgroundId,
  accommodationId,
  requestKey,
  arrivalDate,
  departureDate,
  availabilityBlockers,
}) {
  const window = reviewBookingWindow({ arrivalDate, departureDate });
  if (!window.valid) return hold(window.code);
  if (
    !/^[0-9a-f-]{36}$/iu.test(String(campgroundId ?? "")) ||
    !/^[0-9a-f-]{36}$/iu.test(String(accommodationId ?? "")) ||
    !/^[a-zA-Z0-9_-]{12,100}$/u.test(String(requestKey ?? ""))
  )
    return hold("HOLD_SOURCE_IDENTITIES_OR_IDEMPOTENCY");
  if (!Array.isArray(availabilityBlockers) || availabilityBlockers.length === 0)
    return hold("HOLD_WAITLIST_ONLY_FOR_UNAVAILABLE_SITE");
  return {
    valid: true,
    status: "STAFF_WAITLIST_INTEREST_REVIEW_ONLY",
    sourceWindow: window,
    automaticPromotion: false,
    allocatesInventory: false,
    requiresStaffVerification: true,
    bookingConfirmed: false,
  };
}
