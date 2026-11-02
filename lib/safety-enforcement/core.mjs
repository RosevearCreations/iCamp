import { validUuid } from "../campground-rules/core.mjs";

export const ENFORCEMENT_SCOPES = Object.freeze([
  "campground",
  "facility",
  "access_zone",
  "feature",
]);
export const ENFORCEMENT_FEATURES = Object.freeze([
  "pool",
  "waterfront",
  "sports",
  "playground",
  "event",
  "access",
]);
export const ENFORCEMENT_DECISIONS = Object.freeze([
  "approve",
  "deny",
  "reinstate",
]);

function summary(value, label, min = 12, max = 2000) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max) {
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  }
  return result;
}

export function normalizeEnforcementCase(input) {
  const kind = String(input?.kind ?? "");
  if (!["warning", "suspension"].includes(kind))
    throw new Error("Select a warning or suspension request.");
  const scopeType = String(input?.scopeType ?? "");
  if (!ENFORCEMENT_SCOPES.includes(scopeType))
    throw new Error("Unknown area or feature scope.");
  const facilityId = input?.facilityId
    ? validUuid(input.facilityId, "Facility")
    : null;
  const accessZoneId = input?.accessZoneId
    ? validUuid(input.accessZoneId, "Access zone")
    : null;
  const feature = String(input?.feature ?? "").trim() || null;
  if (
    (scopeType === "facility" && (!facilityId || accessZoneId || feature)) ||
    (scopeType === "access_zone" && (!accessZoneId || facilityId || feature)) ||
    (scopeType === "feature" &&
      (!ENFORCEMENT_FEATURES.includes(feature) ||
        facilityId ||
        accessZoneId)) ||
    (scopeType === "campground" && (facilityId || accessZoneId || feature))
  )
    throw new Error("Select exactly one valid enforcement scope.");
  return {
    caseId: validUuid(input?.caseId, "Case retry ID"),
    reservationId: validUuid(input?.reservationId, "Reservation"),
    ruleVersionId: input?.ruleVersionId
      ? validUuid(input.ruleVersionId, "Rule version")
      : null,
    kind,
    scopeType,
    facilityId,
    accessZoneId,
    feature,
    reason: summary(input?.reason, "Guest-visible reason", 20),
  };
}

export function normalizeEnforcementDecision(input) {
  const decision = String(input?.decision ?? "").trim();
  if (!ENFORCEMENT_DECISIONS.includes(decision))
    throw new Error("Unknown management decision.");
  const version = Number(input?.expectedVersion);
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error("Refresh the case before deciding. Invalid case revision.");
  return {
    caseId: validUuid(input?.caseId, "Case"),
    decision,
    expectedVersion: version,
    note: summary(input?.note, "Management decision note"),
  };
}
