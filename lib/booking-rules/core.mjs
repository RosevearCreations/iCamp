const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PERIOD_KINDS = new Set(["holiday", "season"]);

export const defaultBookingRulePolicy = Object.freeze({
  checkInTime: "15:00",
  checkOutTime: "11:00",
  minimumBookingLeadDays: 0,
  maximumBookingLeadDays: 365,
  minimumStayNights: 1,
  maximumStayNights: 30,
  weekendIsoDays: Object.freeze([6, 7]),
});

function integerInRange(value, label, minimum, maximum) {
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

function optionalIntegerInRange(value, label, minimum, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  return integerInRange(value, label, minimum, maximum);
}

function normalizedTime(value, label) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, 5);
  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(label + " must use 24-hour HH:MM format.");
  }
  return normalized;
}

export function normalizeDate(value, label = "Date") {
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

function normalizedWeekendDays(values) {
  const input = Array.isArray(values) ? values : [values];
  const days = [...new Set(input.map((value) => Number(value)))].sort(
    (a, b) => a - b,
  );
  if (days.length < 1 || days.length > 7) {
    throw new Error("Choose between one and seven weekend days.");
  }
  for (const day of days) {
    integerInRange(day, "Weekend day", 1, 7);
  }
  return days;
}

export function validateBookingPolicyInput(input = {}) {
  const policy = {
    checkInTime: normalizedTime(input.checkInTime, "Check-in time"),
    checkOutTime: normalizedTime(input.checkOutTime, "Check-out time"),
    minimumBookingLeadDays: integerInRange(
      input.minimumBookingLeadDays,
      "Minimum booking lead",
      0,
      365,
    ),
    maximumBookingLeadDays: integerInRange(
      input.maximumBookingLeadDays,
      "Maximum booking lead",
      1,
      1095,
    ),
    minimumStayNights: integerInRange(
      input.minimumStayNights,
      "Minimum stay",
      1,
      365,
    ),
    maximumStayNights: integerInRange(
      input.maximumStayNights,
      "Maximum stay",
      1,
      365,
    ),
    weekendIsoDays: normalizedWeekendDays(input.weekendIsoDays),
  };

  if (policy.maximumBookingLeadDays < policy.minimumBookingLeadDays) {
    throw new Error(
      "Maximum booking lead must be on or after the minimum booking lead.",
    );
  }
  if (policy.maximumStayNights < policy.minimumStayNights) {
    throw new Error("Maximum stay must be at least the minimum stay.");
  }
  return policy;
}

export function validateCalendarPeriodInput(input = {}) {
  const kind = String(input.periodKind ?? "").trim();
  if (!PERIOD_KINDS.has(kind)) {
    throw new Error("Calendar period type must be holiday or season.");
  }
  const code = String(input.code ?? "")
    .trim()
    .toLowerCase();
  if (!CODE_PATTERN.test(code) || code.length > 64) {
    throw new Error(
      "Calendar period code must be a lowercase dash-separated code up to 64 characters.",
    );
  }
  const displayName = String(input.displayName ?? "").trim();
  if (displayName.length < 1 || displayName.length > 120) {
    throw new Error(
      "Calendar period name must be between 1 and 120 characters.",
    );
  }
  const startsOn = normalizeDate(input.startsOn, "Start date");
  const endsOn = normalizeDate(input.endsOn, "End date");
  if (endsOn < startsOn) {
    throw new Error("End date must be on or after the start date.");
  }
  const minimumStayNights = optionalIntegerInRange(
    input.minimumStayNights,
    "Period minimum stay",
    1,
    365,
  );
  const maximumStayNights = optionalIntegerInRange(
    input.maximumStayNights,
    "Period maximum stay",
    1,
    365,
  );
  if (
    minimumStayNights !== null &&
    maximumStayNights !== null &&
    maximumStayNights < minimumStayNights
  ) {
    throw new Error(
      "Period maximum stay must be at least the period minimum stay.",
    );
  }
  const notes = String(input.notes ?? "").trim();
  if (notes.length > 1000) {
    throw new Error("Calendar period notes must be 1000 characters or fewer.");
  }

  return {
    periodKind: kind,
    code,
    displayName,
    startsOn,
    endsOn,
    minimumStayNights,
    maximumStayNights,
    notes: notes || null,
  };
}

function utcDate(value) {
  return new Date(normalizeDate(value) + "T00:00:00Z");
}

function daysBetween(start, end) {
  return Math.round(
    (utcDate(end).getTime() - utcDate(start).getTime()) / 86400000,
  );
}

function addDays(value, amount) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isoDay(value) {
  const day = utcDate(value).getUTCDay();
  return day === 0 ? 7 : day;
}

function overlapsStay(period, arrivalDate, departureDate) {
  return (
    period.isActive !== false &&
    period.startsOn < departureDate &&
    period.endsOn >= arrivalDate
  );
}

export function evaluateBookingDateRules({
  policy,
  periods = [],
  arrivalDate,
  departureDate,
  bookingDate,
}) {
  const normalizedPolicy = validateBookingPolicyInput(policy);
  const arrival = normalizeDate(arrivalDate, "Arrival date");
  const departure = normalizeDate(departureDate, "Departure date");
  const bookedOn = normalizeDate(bookingDate, "Booking date");
  const nights = daysBetween(arrival, departure);
  const leadDays = daysBetween(bookedOn, arrival);
  const issues = [];

  if (nights < 1) {
    issues.push("Departure must be after arrival.");
  }

  const appliedPeriods = periods
    .filter((period) => overlapsStay(period, arrival, departure))
    .map((period) => ({
      ...period,
      minimumStayNights:
        period.minimumStayNights === null ||
        period.minimumStayNights === undefined
          ? null
          : Number(period.minimumStayNights),
      maximumStayNights:
        period.maximumStayNights === null ||
        period.maximumStayNights === undefined
          ? null
          : Number(period.maximumStayNights),
    }));

  const effectiveMinimumStay = Math.max(
    normalizedPolicy.minimumStayNights,
    ...appliedPeriods
      .map((period) => period.minimumStayNights)
      .filter((value) => value !== null),
  );
  const maximumCandidates = [
    normalizedPolicy.maximumStayNights,
    ...appliedPeriods
      .map((period) => period.maximumStayNights)
      .filter((value) => value !== null),
  ];
  const effectiveMaximumStay = Math.min(...maximumCandidates);

  if (nights >= 1 && nights < effectiveMinimumStay) {
    issues.push(
      "Stay is shorter than the effective " +
        effectiveMinimumStay +
        "-night minimum.",
    );
  }
  if (nights > effectiveMaximumStay) {
    issues.push(
      "Stay is longer than the effective " +
        effectiveMaximumStay +
        "-night maximum.",
    );
  }
  if (leadDays < normalizedPolicy.minimumBookingLeadDays) {
    issues.push(
      "Arrival is inside the " +
        normalizedPolicy.minimumBookingLeadDays +
        "-day minimum booking lead.",
    );
  }
  if (leadDays > normalizedPolicy.maximumBookingLeadDays) {
    issues.push(
      "Arrival is beyond the " +
        normalizedPolicy.maximumBookingLeadDays +
        "-day booking window.",
    );
  }

  let weekendNights = 0;
  if (nights > 0) {
    for (let index = 0; index < Math.min(nights, 366); index += 1) {
      const night = addDays(arrival, index);
      if (normalizedPolicy.weekendIsoDays.includes(isoDay(night))) {
        weekendNights += 1;
      }
    }
  }

  const holidayNames = [
    ...new Set(
      appliedPeriods
        .filter((period) => period.periodKind === "holiday")
        .map((period) => period.displayName),
    ),
  ];
  const seasonNames = [
    ...new Set(
      appliedPeriods
        .filter((period) => period.periodKind === "season")
        .map((period) => period.displayName),
    ),
  ];

  return {
    eligible: issues.length === 0,
    issues,
    nights,
    leadDays,
    checkInTime: normalizedPolicy.checkInTime,
    checkOutTime: normalizedPolicy.checkOutTime,
    effectiveMinimumStay,
    effectiveMaximumStay,
    weekendNights,
    holidayNames,
    seasonNames,
    appliedPeriodIds: appliedPeriods.map((period) => period.id).filter(Boolean),
  };
}

export function dateInTimeZone(timeZone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
}
