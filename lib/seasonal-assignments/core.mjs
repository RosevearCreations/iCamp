const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CHANNELS = new Set(["web", "staff", "ivr", "sms", "import", "system"]);

function requiredText(value, label, maxLength = 160) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(label + " is required.");
  if (text.length > maxLength) throw new Error(label + " is too long.");
  return text;
}

function optionalText(value, label, maxLength = 160) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) throw new Error(label + " is too long.");
  return text;
}

function isoDate(value, label) {
  const text = String(value ?? "").trim();
  if (!DATE.test(text)) throw new Error(label + " must be YYYY-MM-DD.");
  return text;
}

export function normalizeAssignmentKind(value) {
  const kind = String(value ?? "").trim().toLowerCase();
  if (kind !== "seasonal" && kind !== "yearly") {
    throw new Error("Assignment kind must be seasonal or yearly.");
  }
  return kind;
}

export function normalizeSourceChannel(value = "web") {
  const channel = String(value ?? "").trim().toLowerCase();
  if (!CHANNELS.has(channel)) throw new Error("Source channel is invalid.");
  return channel;
}

export function normalizeSeasonalAssignmentInput(input = {}) {
  const startsOn = isoDate(input.startsOn, "Start date");
  const endsOn = isoDate(input.endsOn, "End date");
  if (endsOn < startsOn) throw new Error("End date cannot be before start date.");

  return {
    accommodationId: requiredText(input.accommodationId, "Accommodation"),
    assignmentKind: normalizeAssignmentKind(input.assignmentKind),
    startsOn,
    endsOn,
    occupantDisplayName: requiredText(
      input.occupantDisplayName,
      "Occupant display name",
    ),
    reference: optionalText(input.reference, "Reference"),
    ratePlanId: requiredText(input.ratePlanId, "Rate plan"),
    winterizationRequired:
      input.winterizationRequired === true ||
      ["1", "true", "on", "yes"].includes(
        String(input.winterizationRequired ?? "").trim().toLowerCase(),
      ),
  };
}

export function normalizeSeasonalReason(value) {
  return requiredText(value, "Reason", 1000);
}

export function normalizeSeasonalTransition(value) {
  const action = String(value ?? "").trim().toLowerCase();
  if (action !== "end" && action !== "cancel") {
    throw new Error("Seasonal assignment transition is invalid.");
  }
  return action;
}

export function longTermPriceFromPlan(plan, assignmentKind) {
  const kind = normalizeAssignmentKind(assignmentKind);
  const value =
    kind === "seasonal" ? plan?.seasonalCents : plan?.yearlyCents;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      kind === "seasonal"
        ? "Selected rate plan has no seasonal price."
        : "Selected rate plan has no yearly price.",
    );
  }
  return value;
}
