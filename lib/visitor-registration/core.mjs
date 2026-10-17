const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);
const VISIT_KINDS = new Set(["day", "week"]);
const IDENTITY_MODES = new Set(["none", "host_attested", "staff_visual"]);
const CONTACT_REQUIREMENTS = new Set([
  "none",
  "phone",
  "email",
  "either",
  "both",
]);
const LOCAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

function cleanText(value, label, max, required = false) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(label + " is required.");
    return null;
  }
  if (normalized.length > max) {
    throw new Error(label + " must be " + max + " characters or fewer.");
  }
  return normalized;
}

function optionalId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function choice(value, choices, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!choices.has(normalized)) throw new Error(label + " is invalid.");
  return normalized;
}

function localTimestamp(value, label) {
  const normalized = String(value ?? "").trim();
  if (!LOCAL_TIMESTAMP_PATTERN.test(normalized)) {
    throw new Error(label + " must use YYYY-MM-DDTHH:MM.");
  }
  const parsed = new Date(normalized + ":00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 16) !== normalized
  ) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

export function normalizeVisitorSourceChannel(value) {
  return choice(value ?? "staff", SOURCE_CHANNELS, "Visitor source channel");
}

export function normalizeVisitorPolicyInput(input = {}) {
  return {
    dayVisitChargeId: optionalId(input.dayVisitChargeId),
    weekVisitChargeId: optionalId(input.weekVisitChargeId),
    identityVerificationMode: choice(
      input.identityVerificationMode ?? "host_attested",
      IDENTITY_MODES,
      "Identity verification mode",
    ),
    contactRequirement: choice(
      input.contactRequirement ?? "either",
      CONTACT_REQUIREMENTS,
      "Contact requirement",
    ),
    visitorRule: cleanText(input.visitorRule, "Visitor rule", 1000, true),
  };
}

export function normalizeVisitorRegistrationInput(input = {}) {
  const visitKind = choice(input.visitKind, VISIT_KINDS, "Visit kind");
  const validFromLocal = localTimestamp(input.validFromLocal, "Valid from");
  const validUntilLocal = localTimestamp(input.validUntilLocal, "Valid until");
  if (validUntilLocal <= validFromLocal) {
    throw new Error("Valid until must be after valid from.");
  }

  const durationMs =
    new Date(validUntilLocal + ":00Z").getTime() -
    new Date(validFromLocal + ":00Z").getTime();
  const maxMs =
    visitKind === "day" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (durationMs > maxMs) {
    throw new Error(
      visitKind === "day"
        ? "Day visitor registration validity cannot exceed 24 hours."
        : "Week visitor registration validity cannot exceed 7 days.",
    );
  }

  return {
    reservationId: cleanText(
      input.reservationId,
      "Host reservation",
      120,
      true,
    ),
    visitorName: cleanText(input.visitorName, "Visitor name", 160, true),
    contactPhone: cleanText(input.contactPhone, "Visitor phone", 40),
    contactEmail: cleanText(input.contactEmail, "Visitor email", 254),
    identityVerified:
      input.identityVerified === true ||
      String(input.identityVerified ?? "").toLowerCase() === "true" ||
      String(input.identityVerified ?? "").toLowerCase() === "on",
    visitKind,
    validFromLocal,
    validUntilLocal,
    notes: cleanText(input.notes, "Visitor notes", 2000),
  };
}

export function assertVisitorContactRequirement(
  contactRequirement,
  { contactPhone, contactEmail },
) {
  const requirement = choice(
    contactRequirement,
    CONTACT_REQUIREMENTS,
    "Contact requirement",
  );
  if (requirement === "phone" && !contactPhone) {
    throw new Error("Visitor phone is required by campground policy.");
  }
  if (requirement === "email" && !contactEmail) {
    throw new Error("Visitor email is required by campground policy.");
  }
  if (requirement === "either" && !contactPhone && !contactEmail) {
    throw new Error("Visitor phone or email is required by campground policy.");
  }
  if (requirement === "both" && (!contactPhone || !contactEmail)) {
    throw new Error(
      "Visitor phone and email are both required by campground policy.",
    );
  }
}

export function normalizeVisitorRevocationReason(value) {
  return cleanText(value, "Revocation reason", 500, true);
}

export function effectiveVisitorStatus({
  registrationStatus,
  validFrom,
  validUntil,
  now = new Date(),
}) {
  if (
    registrationStatus === "revoked" ||
    registrationStatus === "pending_payment"
  ) {
    return registrationStatus;
  }
  const current = now instanceof Date ? now : new Date(now);
  const from = new Date(validFrom);
  const until = new Date(validUntil);
  if (current < from) return "scheduled";
  if (current > until) return "expired";
  return "active";
}
