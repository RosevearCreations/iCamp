import { createHash, randomBytes } from "node:crypto";

const TYPES = new Set([
  "key_card",
  "fob",
  "keypad_pin",
  "qr_pass",
  "printed_pass",
  "wristband",
  "provider_reference",
]);

const SUBJECTS = new Set([
  "reservation",
  "guest",
  "visitor",
  "vehicle",
  "staff",
  "other",
]);

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

function choice(value, choices, label) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!choices.has(normalized)) throw new Error(label + " is invalid.");
  return normalized;
}

function optionalDate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + " is invalid.");
  return date.toISOString();
}

export function fingerprintCredentialSecret(secret) {
  const normalized = clean(secret, "Credential secret", 512, true);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function generateCredentialSecret(byteLength = 24) {
  const size = Number(byteLength);
  if (!Number.isInteger(size) || size < 16 || size > 64) {
    throw new Error("Credential secret byte length must be between 16 and 64.");
  }
  return randomBytes(size).toString("base64url");
}

export function maskCredentialHint(value, visibleSuffix = 4) {
  const normalized = clean(value, "Credential value", 512, true);
  const suffix = Math.max(0, Math.min(Number(visibleSuffix) || 0, 12));
  if (suffix === 0) return "••••";
  return "••••" + normalized.slice(-suffix);
}

export function normalizeAccessCredentialInput(input = {}) {
  const credentialType = choice(input.credentialType, TYPES, "Credential type");
  const subjectKind = choice(input.subjectKind, SUBJECTS, "Credential subject");
  const validFrom = optionalDate(input.validFrom, "Valid from") ?? new Date().toISOString();
  const validUntil = optionalDate(input.validUntil, "Valid until");
  if (validUntil && validUntil <= validFrom) {
    throw new Error("Valid until must be after valid from.");
  }

  const providerCode = clean(input.providerCode, "Provider code", 64);
  const providerCredentialReference = clean(
    input.providerCredentialReference,
    "Provider credential reference",
    240,
  );

  if (Boolean(providerCode) !== Boolean(providerCredentialReference)) {
    throw new Error(
      "Provider code and provider credential reference must be supplied together.",
    );
  }

  const rawSecret = clean(input.rawSecret, "Credential secret", 512);
  const digital = credentialType === "keypad_pin" || credentialType === "qr_pass";
  if (digital && !rawSecret) {
    throw new Error("Keypad PIN and QR credentials require credential secret material.");
  }
  if (!digital && rawSecret) {
    throw new Error("Only keypad PIN and QR credentials accept secret material.");
  }

  return {
    credentialType,
    subjectKind,
    subjectReferenceId: clean(input.subjectReferenceId, "Subject reference", 120),
    subjectLabel: clean(input.subjectLabel, "Subject label", 240, true),
    providerCode,
    providerCredentialReference,
    secretFingerprint: rawSecret ? fingerprintCredentialSecret(rawSecret) : null,
    displayHint:
      clean(input.displayHint, "Display hint", 80) ??
      (rawSecret ? maskCredentialHint(rawSecret) : null),
    validFrom,
    validUntil,
  };
}

export function normalizeCredentialRevocationReason(value) {
  return clean(value, "Revocation reason", 500, true);
}

export function effectiveCredentialStatus({
  status,
  validFrom,
  validUntil,
  now = new Date(),
}) {
  if (status === "revoked") return "revoked";
  const current = now instanceof Date ? now : new Date(now);
  const from = new Date(validFrom);
  if (current < from) return "scheduled";
  if (validUntil && current > new Date(validUntil)) return "expired";
  return "active";
}
