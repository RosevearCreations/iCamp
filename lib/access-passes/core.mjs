import { createHash, randomBytes } from "node:crypto";

const PRESENTATION_KINDS = new Set(["qr_code", "printed_pass", "wristband"]);

const LINK_KINDS = new Set(["visitor", "vehicle_pass", "event", "day_use"]);

const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);

function clean(value, label, max, required = false) {
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

function choice(value, values, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!values.has(normalized)) throw new Error(label + " is invalid.");
  return normalized;
}

function requiredDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + " is invalid.");
  return date.toISOString();
}

export function generatePassValidationToken(byteLength = 24) {
  const size = Number(byteLength);
  if (!Number.isInteger(size) || size < 16 || size > 64) {
    throw new Error(
      "Pass validation token length must be between 16 and 64 bytes.",
    );
  }
  return randomBytes(size).toString("base64url");
}

export function parsePassValidationPresentation(value) {
  const normalized = clean(value, "Pass validation value", 256, true);
  const token = normalized.startsWith("icamp-pass:v1:")
    ? normalized.slice("icamp-pass:v1:".length)
    : normalized;

  if (!/^[A-Za-z0-9_-]{22,128}$/u.test(token)) {
    throw new Error("Pass validation value is invalid.");
  }

  return token;
}

export function fingerprintPassValidationToken(value) {
  const token = parsePassValidationPresentation(value);
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function formatQrPassPayload(value) {
  const token = parsePassValidationPresentation(value);
  return "icamp-pass:v1:" + token;
}

export function maskPassValidationHint(value, visibleSuffix = 4) {
  const token = parsePassValidationPresentation(value);
  const suffix = Math.max(0, Math.min(Number(visibleSuffix) || 0, 12));
  if (suffix === 0) return "••••";
  return "••••" + token.slice(-suffix);
}

export function credentialTypeForPresentation(presentationKind) {
  const kind = choice(
    presentationKind,
    PRESENTATION_KINDS,
    "Pass presentation kind",
  );
  return {
    qr_code: "qr_pass",
    printed_pass: "printed_pass",
    wristband: "wristband",
  }[kind];
}

export function credentialSubjectKindForLink(linkKind) {
  const kind = choice(linkKind, LINK_KINDS, "Pass link kind");
  if (kind === "visitor") return "visitor";
  if (kind === "vehicle_pass") return "vehicle";
  return "other";
}

export function normalizeAccessPassInput(input = {}) {
  const presentationKind = choice(
    input.presentationKind,
    PRESENTATION_KINDS,
    "Pass presentation kind",
  );
  const linkKind = choice(input.linkKind, LINK_KINDS, "Pass link kind");
  const validFrom = requiredDate(input.validFrom ?? new Date(), "Valid from");
  const validUntil = requiredDate(input.validUntil, "Valid until");

  if (validUntil <= validFrom) {
    throw new Error("Valid until must be after valid from.");
  }

  const visitorRegistrationId = clean(
    input.visitorRegistrationId,
    "Visitor registration",
    120,
  );
  const vehiclePassId = clean(input.vehiclePassId, "Vehicle pass", 120);
  const eventReference = clean(input.eventReference, "Event reference", 160);
  const dayUseReference = clean(
    input.dayUseReference,
    "Day-use reference",
    160,
  );

  const expected = {
    visitor: Boolean(visitorRegistrationId),
    vehicle_pass: Boolean(vehiclePassId),
    event: Boolean(eventReference),
    day_use: Boolean(dayUseReference),
  };

  if (!expected[linkKind]) {
    throw new Error("The selected pass link requires its canonical reference.");
  }

  const suppliedReferences = [
    visitorRegistrationId,
    vehiclePassId,
    eventReference,
    dayUseReference,
  ].filter(Boolean).length;

  if (suppliedReferences !== 1) {
    throw new Error("Exactly one pass linkage reference is allowed.");
  }

  return {
    presentationKind,
    linkKind,
    visitorRegistrationId,
    vehiclePassId,
    eventReference,
    dayUseReference,
    subjectLabel: clean(input.subjectLabel, "Subject label", 240, true),
    validFrom,
    validUntil,
  };
}

export function normalizePassSourceChannel(value = "staff") {
  return choice(value, SOURCE_CHANNELS, "Pass source channel");
}

export function normalizePassRevocationReason(value) {
  const reason = clean(value, "Pass revocation reason", 500, true);
  if (reason.length < 3) {
    throw new Error("Pass revocation reason must be at least 3 characters.");
  }
  return reason;
}

export function effectivePassValidationStatus({
  credentialStatus,
  validFrom,
  validUntil,
  sourceActive = true,
  now = new Date(),
}) {
  if (credentialStatus === "revoked") return "revoked";
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime()))
    throw new Error("Validation time is invalid.");

  const from = new Date(validFrom);
  const until = new Date(validUntil);

  if (current < from) return "not_yet_valid";
  if (current > until) return "expired";
  if (!sourceActive) return "source_inactive";
  return "valid";
}
