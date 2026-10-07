import { createHash, randomInt } from "node:crypto";

import { hashPassword, verifyPassword } from "../auth/crypto.mjs";

export const VERIFICATION_CODE_DIGITS = 6;
export const STAFF_PIN_MIN_DIGITS = 4;
export const STAFF_PIN_MAX_DIGITS = 8;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_CHALLENGE_SECONDS = 5 * 60;
export const VERIFICATION_LOCK_SECONDS = 15 * 60;
export const VERIFICATION_ISSUE_WINDOW_SECONDS = 15 * 60;
export const VERIFICATION_ISSUE_LIMIT = 5;

const CHANNELS = new Set(["voice", "sms"]);
const ACTOR_KINDS = new Set(["guest", "staff"]);
const SUBJECT_KINDS = new Set(["site", "reservation", "pass", "staff"]);
const PURPOSES = new Set(["guest_lookup", "staff_access", "staff_privileged"]);

function normalizeChoice(value, allowed, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!allowed.has(normalized)) {
    throw new Error(`${label} is invalid.`);
  }

  return normalized;
}

export function normalizeVerificationChannel(value) {
  return normalizeChoice(value, CHANNELS, "Verification channel");
}

export function normalizeVerificationActorKind(value) {
  return normalizeChoice(value, ACTOR_KINDS, "Verification actor kind");
}

export function normalizeVerificationPurpose(value) {
  return normalizeChoice(value, PURPOSES, "Verification purpose");
}

export function normalizeVerificationSubjectKind(value) {
  return normalizeChoice(value, SUBJECT_KINDS, "Verification subject kind");
}

export function normalizeSubjectReference(value) {
  const normalized = String(value ?? "").trim();

  if (!/^[0-9]{1,12}$/u.test(normalized)) {
    throw new Error("Verification subject reference must contain 1-12 digits.");
  }

  return normalized;
}

export function hashSubjectReference(subjectKind, value) {
  const kind = normalizeVerificationSubjectKind(subjectKind);
  const reference = normalizeSubjectReference(value);

  return createHash("sha256")
    .update(`${kind}:${reference}`, "utf8")
    .digest();
}

export function normalizeVerificationCode(value) {
  const normalized = String(value ?? "").trim();

  if (!new RegExp(`^[0-9]{${VERIFICATION_CODE_DIGITS}}$`, "u").test(normalized)) {
    throw new Error(
      `Verification code must contain exactly ${VERIFICATION_CODE_DIGITS} digits.`,
    );
  }

  return normalized;
}

export function generateVerificationCode() {
  const upperBound = 10 ** VERIFICATION_CODE_DIGITS;

  return String(randomInt(0, upperBound)).padStart(
    VERIFICATION_CODE_DIGITS,
    "0",
  );
}

export async function hashVerificationCode(value) {
  const code = normalizeVerificationCode(value);

  return hashPassword(`verification:${code}`);
}

export async function verifyVerificationCode(value, encodedHash) {
  let code;

  try {
    code = normalizeVerificationCode(value);
  } catch {
    return false;
  }

  return verifyPassword(`verification:${code}`, encodedHash);
}

export function normalizeStaffPin(value) {
  const normalized = String(value ?? "").trim();
  const pattern = new RegExp(
    `^[0-9]{${STAFF_PIN_MIN_DIGITS},${STAFF_PIN_MAX_DIGITS}}$`,
    "u",
  );

  if (!pattern.test(normalized)) {
    throw new Error(
      `Staff PIN must contain ${STAFF_PIN_MIN_DIGITS}-${STAFF_PIN_MAX_DIGITS} digits.`,
    );
  }

  return normalized;
}

export async function hashStaffPin(value) {
  const pin = normalizeStaffPin(value);

  return hashPassword(`staff-pin:${pin}`);
}

export async function verifyStaffPin(value, encodedHash) {
  let pin;

  try {
    pin = normalizeStaffPin(value);
  } catch {
    return false;
  }

  return verifyPassword(`staff-pin:${pin}`, encodedHash);
}

export function requiredVerificationFactors({
  actorKind,
  purpose,
  riskLevel = "standard",
}) {
  const actor = normalizeVerificationActorKind(actorKind);
  const normalizedPurpose = normalizeVerificationPurpose(purpose);

  if (!["standard", "elevated", "high"].includes(riskLevel)) {
    throw new Error("Verification risk level is invalid.");
  }

  if (actor === "guest") {
    if (normalizedPurpose !== "guest_lookup") {
      throw new Error("Guest verification purpose is invalid.");
    }

    return Object.freeze(["subject_reference", "one_time_code"]);
  }

  if (normalizedPurpose === "guest_lookup") {
    throw new Error("Staff verification purpose is invalid.");
  }

  if (normalizedPurpose === "staff_privileged" || riskLevel === "high") {
    return Object.freeze([
      "staff_pin",
      "one_time_code_or_recent_session_reauthentication",
    ]);
  }

  return Object.freeze(["staff_pin"]);
}

export function evaluateVerificationAvailability({
  status,
  expiresAt,
  lockedUntil = null,
  attemptCount = 0,
  maxAttempts = VERIFICATION_MAX_ATTEMPTS,
  now = new Date(),
}) {
  const current = now instanceof Date ? now : new Date(now);
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const lock = lockedUntil
    ? lockedUntil instanceof Date
      ? lockedUntil
      : new Date(lockedUntil)
    : null;

  if (
    Number.isNaN(current.getTime()) ||
    Number.isNaN(expiry.getTime()) ||
    (lock && Number.isNaN(lock.getTime()))
  ) {
    throw new Error("Verification timing data is invalid.");
  }

  if (status !== "pending") {
    return { usable: false, reason: status };
  }

  if (expiry.getTime() <= current.getTime()) {
    return { usable: false, reason: "expired" };
  }

  if (lock && lock.getTime() > current.getTime()) {
    return { usable: false, reason: "locked" };
  }

  if (
    !Number.isInteger(attemptCount) ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    attemptCount >= maxAttempts
  ) {
    return { usable: false, reason: "locked" };
  }

  return { usable: true, reason: null };
}

export function mergeFraudSignals(existing, signal) {
  const values = Array.isArray(existing)
    ? existing.map((item) => String(item)).filter(Boolean)
    : [];
  const normalized = String(signal ?? "").trim();

  if (!normalized) return [...new Set(values)].slice(-20);

  return [...new Set([...values, normalized])].slice(-20);
}

export function sanitizeVerificationChallenge(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    channel: row.channel,
    actorKind: row.actor_kind,
    purpose: row.purpose,
    subjectKind: row.subject_kind,
    status: row.status,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? VERIFICATION_MAX_ATTEMPTS),
    assuranceLevel: row.assurance_level ?? null,
    expiresAt: row.expires_at ?? null,
    satisfiedAt: row.satisfied_at ?? null,
    lockedUntil: row.locked_until ?? null,
    fraudSignals: row.fraud_signals ?? [],
    secretsExcluded: true,
    callerOrSenderHintIsAuthentication: false,
  };
}
