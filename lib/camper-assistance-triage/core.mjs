import {
  CAMPER_ASSISTANCE_CATEGORIES,
  CAMPER_ASSISTANCE_SEVERITIES,
} from "../camper-assistance/core.mjs";

export const ASSISTANCE_CASE_STATES = Object.freeze([
  "new",
  "triaged",
  "assigned",
  "escalated",
  "closed",
]);

export const ASSISTANCE_ESCALATION_LEVELS = Object.freeze([
  "main_foreman",
  "manager",
  "owner",
]);

export const ASSISTANCE_OUTCOMES = Object.freeze([
  "resolved",
  "referred",
  "duplicate",
  "guest_cancelled",
  "not_reproducible",
  "other",
]);

export const ASSISTANCE_MESSAGE_CHANNELS = Object.freeze([
  "in_app",
  "email",
  "sms",
  "phone",
]);

const categories = new Set(CAMPER_ASSISTANCE_CATEGORIES);
const severities = new Set(CAMPER_ASSISTANCE_SEVERITIES);
const levels = new Set(ASSISTANCE_ESCALATION_LEVELS);
const outcomes = new Set(ASSISTANCE_OUTCOMES);
const channels = new Set(ASSISTANCE_MESSAGE_CHANNELS);

function normalizedChoice(value, allowed, label) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!allowed.has(normalized)) throw new Error(label + " is invalid.");
  return normalized;
}

function requiredText(value, label, minimum, maximum) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(
      label + " must be between " + minimum + " and " + maximum + " characters.",
    );
  }
  return normalized;
}

function optionalUuid(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      normalized,
    )
  ) {
    throw new Error("Assigned staff id must be a UUID.");
  }
  return normalized;
}

export function normalizeAssistanceTriage(input = {}) {
  return {
    category: normalizedChoice(input.category, categories, "Assistance category"),
    severity: normalizedChoice(input.severity, severities, "Assistance priority"),
    assignedToUserId: optionalUuid(input.assignedToUserId),
    note: requiredText(input.note, "Triage note", 3, 2000),
  };
}

export function normalizeAssistanceEscalation(input = {}) {
  return {
    level: normalizedChoice(input.level, levels, "Escalation level"),
    reason: requiredText(input.reason, "Escalation reason", 3, 2000),
  };
}

export function normalizeAssistanceGuestMessage(input = {}) {
  return {
    channel: normalizedChoice(input.channel, channels, "Guest contact channel"),
    message: requiredText(input.message, "Guest message", 3, 2000),
  };
}

export function normalizeAssistanceClosure(input = {}) {
  return {
    outcomeCode: normalizedChoice(input.outcomeCode, outcomes, "Outcome"),
    outcomeSummary: requiredText(
      input.outcomeSummary,
      "Outcome summary",
      3,
      2000,
    ),
  };
}
