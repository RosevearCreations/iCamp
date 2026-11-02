export const PRIVILEGED_REASON_MIN_LENGTH = 8;
export const PRIVILEGED_REASON_MAX_LENGTH = 500;
export const RECENT_REAUTHENTICATION_SECONDS = 10 * 60;

const assuranceRank = new Map([
  ["aal1", 1],
  ["aal2", 2],
]);

function normalizeDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

export function normalizePrivilegedReason(reason) {
  const normalized = String(reason ?? "").trim();

  if (
    normalized.length < PRIVILEGED_REASON_MIN_LENGTH ||
    normalized.length > PRIVILEGED_REASON_MAX_LENGTH
  ) {
    throw new Error(
      `Privileged action reason must be ${PRIVILEGED_REASON_MIN_LENGTH}-${PRIVILEGED_REASON_MAX_LENGTH} characters.`,
    );
  }

  return normalized;
}

export function hasRequiredAssurance(
  assuranceLevel,
  minimumAssuranceLevel = "aal1",
) {
  const current = assuranceRank.get(assuranceLevel) ?? 0;
  const required = assuranceRank.get(minimumAssuranceLevel);

  if (!required) {
    throw new Error("Unknown minimum assurance level.");
  }

  return current >= required;
}

export function assertRecentReauthentication({
  reauthenticatedAt,
  now = new Date(),
  maxAgeSeconds = RECENT_REAUTHENTICATION_SECONDS,
}) {
  const reauthenticated = normalizeDate(
    reauthenticatedAt,
    "Re-authentication time",
  );
  const current = normalizeDate(now, "Current time");
  const ageMs = current.getTime() - reauthenticated.getTime();

  if (ageMs < -60_000) {
    throw new Error("Re-authentication time cannot be in the future.");
  }

  if (ageMs > maxAgeSeconds * 1000) {
    throw new Error("Recent re-authentication is required.");
  }

  return reauthenticated;
}

export function assertPrivilegedActionControl({
  riskLevel,
  reason,
  reauthenticatedAt,
  assuranceLevel,
  minimumAssuranceLevel = "aal1",
  now = new Date(),
}) {
  if (!["standard", "elevated", "high"].includes(riskLevel)) {
    throw new Error("Unknown privileged-action risk level.");
  }

  const normalizedReason =
    riskLevel === "standard" && !reason
      ? null
      : normalizePrivilegedReason(reason);

  let normalizedReauthenticatedAt = null;

  if (riskLevel === "high") {
    if (!hasRequiredAssurance(assuranceLevel, minimumAssuranceLevel)) {
      throw new Error(
        `Privileged action requires assurance level ${minimumAssuranceLevel} or stronger.`,
      );
    }

    normalizedReauthenticatedAt = assertRecentReauthentication({
      reauthenticatedAt,
      now,
    });
  }

  return {
    reason: normalizedReason,
    reauthenticatedAt: normalizedReauthenticatedAt,
    assuranceLevel: assuranceLevel ?? null,
  };
}
