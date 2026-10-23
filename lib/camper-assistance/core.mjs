import { createHash } from "node:crypto";

export const CAMPER_ASSISTANCE_CATEGORIES = Object.freeze([
  "maintenance",
  "garbage",
  "septic",
  "electrical",
  "water",
  "wifi",
  "noise",
  "security",
  "rental",
  "store",
  "other",
]);

export const CAMPER_ASSISTANCE_SEVERITIES = Object.freeze([
  "routine",
  "soon",
  "urgent",
]);

export const CAMPER_ASSISTANCE_CONTACT_PREFERENCES = Object.freeze([
  "in_app",
  "email",
  "sms",
  "phone",
  "none",
]);

const SOURCES = new Set(["web", "ivr", "sms", "staff", "system"]);
const CATEGORY_SET = new Set(CAMPER_ASSISTANCE_CATEGORIES);
const SEVERITY_SET = new Set(CAMPER_ASSISTANCE_SEVERITIES);
const CONTACT_SET = new Set(CAMPER_ASSISTANCE_CONTACT_PREFERENCES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requiredText(value, label, minimum, maximum) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(
      label +
        " must be between " +
        minimum +
        " and " +
        maximum +
        " characters.",
    );
  }
  return normalized;
}

function optionalText(value, maximum) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > maximum) {
    throw new Error("Assistance request detail is too long.");
  }
  return normalized;
}

export function normalizeCamperAssistanceSource(value = "web") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!SOURCES.has(normalized)) {
    throw new Error("Assistance request source channel is invalid.");
  }
  return normalized;
}

export function normalizeCamperAssistanceInput(input = {}) {
  const category = String(input.category ?? "")
    .trim()
    .toLowerCase();
  if (!CATEGORY_SET.has(category)) {
    throw new Error("Assistance category is invalid.");
  }

  const severity = String(input.severity ?? "")
    .trim()
    .toLowerCase();
  if (!SEVERITY_SET.has(severity)) {
    throw new Error("Assistance severity is invalid.");
  }

  const contactPreference = String(input.contactPreference ?? "in_app")
    .trim()
    .toLowerCase();
  if (!CONTACT_SET.has(contactPreference)) {
    throw new Error("Contact preference is invalid.");
  }

  return {
    category,
    severity,
    summary: requiredText(input.summary, "Summary", 3, 160),
    details: optionalText(input.details, 4000),
    contactPreference,
  };
}

export function normalizeCamperAssistanceClientRequestId(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("Assistance request idempotency key is invalid.");
  }
  return normalized;
}

export function camperAssistanceFingerprint({
  reservationId,
  sourceChannel,
  input,
}) {
  const normalized = normalizeCamperAssistanceInput(input);
  const source = normalizeCamperAssistanceSource(sourceChannel);
  return createHash("sha256")
    .update(
      JSON.stringify({
        reservationId: String(reservationId ?? "")
          .trim()
          .toLowerCase(),
        source,
        ...normalized,
      }),
    )
    .digest("hex");
}
