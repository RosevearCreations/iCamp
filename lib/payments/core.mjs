export const defaultPaymentPolicy = Object.freeze({
  depositMode: "full",
  depositFixedCents: null,
  depositPercentageBasisPoints: null,
  securityDepositCents: 0,
  securityDepositDueStage: "with_deposit",
  balanceDueMode: "at_booking",
  balanceDueDaysBeforeArrival: null,
  currencyCode: "CAD",
});

function integer(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(label + " is invalid.");
  }
  return parsed;
}

function isoDate(value, label) {
  const normalized = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
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

function addDays(value, days) {
  const date = new Date(isoDate(value, "Date") + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function currencyCode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    throw new Error("Payment currency code is invalid.");
  }
  return normalized;
}

export function moneyInputToCents(value, label = "Amount") {
  const normalized = String(value ?? "").trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new Error(label + " must be a positive currency amount.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

export function percentInputToBasisPoints(value) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    throw new Error(
      "Deposit percentage must be greater than 0 and at most 100.",
    );
  }
  return Math.round(parsed * 100);
}

export function validatePaymentPolicyInput(input = {}) {
  const depositMode = String(input.depositMode ?? "full").trim();
  if (!["full", "fixed", "percentage"].includes(depositMode)) {
    throw new Error("Deposit mode is invalid.");
  }

  let depositFixedCents = null;
  let depositPercentageBasisPoints = null;

  if (depositMode === "fixed") {
    depositFixedCents = integer(
      input.depositFixedCents,
      "Fixed deposit",
      1,
      100_000_000,
    );
  }

  if (depositMode === "percentage") {
    depositPercentageBasisPoints = integer(
      input.depositPercentageBasisPoints,
      "Deposit percentage",
      1,
      10_000,
    );
  }

  const securityDepositCents = integer(
    input.securityDepositCents ?? 0,
    "Security deposit",
    0,
    100_000_000,
  );

  const securityDepositDueStage = String(
    input.securityDepositDueStage ?? "with_deposit",
  ).trim();
  if (
    !["with_deposit", "with_balance", "on_arrival"].includes(
      securityDepositDueStage,
    )
  ) {
    throw new Error("Security-deposit due stage is invalid.");
  }

  const balanceDueMode = String(input.balanceDueMode ?? "at_booking").trim();
  if (
    !["at_booking", "days_before_arrival", "on_arrival"].includes(
      balanceDueMode,
    )
  ) {
    throw new Error("Balance due mode is invalid.");
  }

  const balanceDueDaysBeforeArrival =
    balanceDueMode === "days_before_arrival"
      ? integer(input.balanceDueDaysBeforeArrival, "Balance due days", 1, 365)
      : null;

  return {
    depositMode,
    depositFixedCents,
    depositPercentageBasisPoints,
    securityDepositCents,
    securityDepositDueStage,
    balanceDueMode,
    balanceDueDaysBeforeArrival,
    currencyCode: currencyCode(input.currencyCode ?? "CAD"),
  };
}

export function calculateReservationPaymentSchedule({
  totalCents,
  currencyCode: quoteCurrencyCode,
  arrivalDate,
  bookingDate,
  policy,
}) {
  const total = integer(totalCents, "Reservation total", 0, 100_000_000);
  const arrival = isoDate(arrivalDate, "Arrival date");
  const booking = isoDate(bookingDate, "Booking date");
  const normalized = validatePaymentPolicyInput(policy);
  const quoteCurrency = currencyCode(quoteCurrencyCode);

  if (normalized.currencyCode !== quoteCurrency) {
    throw new Error(
      "Payment policy currency does not match the reservation quote.",
    );
  }

  let bookingDepositCents;
  if (normalized.depositMode === "full") {
    bookingDepositCents = total;
  } else if (normalized.depositMode === "fixed") {
    bookingDepositCents = Math.min(normalized.depositFixedCents, total);
  } else {
    bookingDepositCents = Math.min(
      total,
      Math.ceil((total * normalized.depositPercentageBasisPoints) / 10_000),
    );
  }

  const reservationBalanceCents = total - bookingDepositCents;
  let balanceDueDate = booking;

  if (normalized.balanceDueMode === "days_before_arrival") {
    balanceDueDate = addDays(arrival, -normalized.balanceDueDaysBeforeArrival);
  } else if (normalized.balanceDueMode === "on_arrival") {
    balanceDueDate = arrival;
  }

  const balanceDueAtBooking = balanceDueDate <= booking;
  let bookingDueCents =
    bookingDepositCents + (balanceDueAtBooking ? reservationBalanceCents : 0);

  if (normalized.securityDepositDueStage === "with_deposit") {
    bookingDueCents += normalized.securityDepositCents;
  } else if (
    normalized.securityDepositDueStage === "with_balance" &&
    balanceDueAtBooking
  ) {
    bookingDueCents += normalized.securityDepositCents;
  } else if (
    normalized.securityDepositDueStage === "on_arrival" &&
    arrival <= booking
  ) {
    bookingDueCents += normalized.securityDepositCents;
  }

  return {
    policy: normalized,
    bookingDate: booking,
    arrivalDate: arrival,
    currencyCode: quoteCurrency,
    reservationTotalCents: total,
    bookingDepositCents,
    reservationBalanceCents,
    securityDepositCents: normalized.securityDepositCents,
    securityDepositDueStage: normalized.securityDepositDueStage,
    balanceDueMode: normalized.balanceDueMode,
    balanceDueDate,
    bookingDueCents,
    totalPayableCents: total + normalized.securityDepositCents,
  };
}

export function calculatePaymentProgress({
  schedule,
  capturedCents = 0,
  asOfDate,
}) {
  const captured = integer(capturedCents, "Captured amount", 0, 200_000_000);
  const asOf = isoDate(asOfDate, "Payment as-of date");
  const bookingDate = isoDate(schedule.bookingDate, "Booking date");
  const arrivalDate = isoDate(schedule.arrivalDate, "Arrival date");
  const balanceDueDate = isoDate(schedule.balanceDueDate, "Balance due date");

  let dueToDateCents = Number(schedule.bookingDepositCents);

  if (balanceDueDate <= asOf) {
    dueToDateCents += Number(schedule.reservationBalanceCents);
  }

  const securityStage = schedule.securityDepositDueStage;
  if (
    securityStage === "with_deposit" ||
    (securityStage === "with_balance" && balanceDueDate <= asOf) ||
    (securityStage === "on_arrival" && arrivalDate <= asOf)
  ) {
    dueToDateCents += Number(schedule.securityDepositCents);
  }

  if (asOf < bookingDate) {
    dueToDateCents = 0;
  }

  const totalPayableCents = Number(schedule.totalPayableCents);
  const boundedCaptured = Math.min(captured, totalPayableCents);
  const outstandingCents = Math.max(0, totalPayableCents - boundedCaptured);
  const dueNowCents = Math.max(
    0,
    Math.min(dueToDateCents, totalPayableCents) - boundedCaptured,
  );

  return {
    capturedCents: boundedCaptured,
    dueToDateCents: Math.min(dueToDateCents, totalPayableCents),
    dueNowCents,
    outstandingCents,
    paidInFull: outstandingCents === 0,
    currentDueSatisfied: dueNowCents === 0,
  };
}
