function text(value, label, max = 160) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(label + " is required.");
  if (result.length > max) throw new Error(label + " is too long.");
  return result;
}

function optionalText(value, max = 1000) {
  const result = String(value ?? "").trim();
  if (!result) return null;
  if (result.length > max) throw new Error("Text value is too long.");
  return result;
}

function isoDate(value, label) {
  const result = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result)) {
    throw new Error(label + " must use YYYY-MM-DD.");
  }
  const date = new Date(result + "T00:00:00Z");
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== result
  ) {
    throw new Error(label + " is invalid.");
  }
  return result;
}

function optionalAmount(value) {
  if (value == null || String(value).trim() === "") return null;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(
      "Long-term charge must be a non-negative integer number of cents.",
    );
  }
  return amount;
}

function optionalCurrency(value) {
  const currencyCode = String(value ?? "").trim().toUpperCase();
  if (!currencyCode) return null;
  if (!/^[A-Z]{3}$/u.test(currencyCode)) {
    throw new Error("Currency code is invalid.");
  }
  return currencyCode;
}

function booleanValue(value) {
  return (
    value === true ||
    ["1", "true", "on", "yes"].includes(
      String(value ?? "").trim().toLowerCase(),
    )
  );
}

export function normalizeSourceChannel(value = "web") {
  const channel = String(value ?? "").trim().toLowerCase();
  if (!["web", "staff", "ivr", "sms", "import", "system"].includes(channel)) {
    throw new Error("Source channel is invalid.");
  }
  return channel;
}

export function normalizeLongTermAssignment(input) {
  const assignmentKind = String(input?.assignmentKind ?? "").trim();
  if (!["seasonal", "yearly"].includes(assignmentKind)) {
    throw new Error("Assignment kind must be seasonal or yearly.");
  }
  const startsOn = isoDate(input?.startsOn, "Start date");
  const endsOn = isoDate(input?.endsOn, "End date");
  if (endsOn < startsOn) {
    throw new Error("End date must be on or after start date.");
  }

  return {
    accommodationId: text(input?.accommodationId, "Accommodation ID"),
    assignmentKind,
    occupantDisplayName: text(input?.occupantDisplayName, "Occupant name"),
    contactEmail: optionalText(input?.contactEmail, 254),
    startsOn,
    endsOn,
    ratePlanId: text(input?.ratePlanId, "Rate plan ID"),
    chargeAmountCents: optionalAmount(input?.chargeAmountCents),
    currencyCode: optionalCurrency(input?.currencyCode),
    chargeDueOn: isoDate(input?.chargeDueOn ?? startsOn, "Charge due date"),
    reference: optionalText(input?.reference, 160),
    notes: optionalText(input?.notes),
    winterizationRequired: booleanValue(input?.winterizationRequired),
  };
}

export function normalizeAssignmentTransition(input) {
  const eventKind = String(input?.eventKind ?? "").trim();
  const supported = ["winter_closed", "reopened", "ended", "cancelled"];
  if (!supported.includes(eventKind)) {
    throw new Error("Assignment transition is invalid.");
  }

  const rawVersion = String(input?.expectedRowVersion ?? "").trim();
  let expectedRowVersion = null;
  if (rawVersion) {
    expectedRowVersion = Number(rawVersion);
    if (!Number.isInteger(expectedRowVersion) || expectedRowVersion < 1) {
      throw new Error("Assignment row version is invalid.");
    }
  }

  return {
    assignmentId: text(input?.assignmentId, "Assignment ID"),
    eventKind,
    effectiveOn: isoDate(input?.effectiveOn, "Effective date"),
    note: optionalText(input?.note),
    expectedRowVersion,
  };
}

export function occupancyStateForEvent(eventKind) {
  if (eventKind === "winter_closed") return "winter_closed";
  if (eventKind === "reopened") return "assigned";
  return null;
}

export function assignmentStateForEvent(eventKind) {
  if (eventKind === "ended") return "ended";
  if (eventKind === "cancelled") return "cancelled";
  return null;
}
