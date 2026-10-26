const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const outcomeKinds = [
  "monitoring_completed",
  "evidence_pending",
  "escalated",
  "closure_evidence_ready",
];
export function normalizeOwnerReassessmentOutcome(raw) {
  const value = {};
  for (const key of [
    "id",
    "reassessmentId",
    "sourceCampgroundId",
    "targetCampgroundId",
  ]) {
    value[key] = String(raw[key] ?? "").trim();
    if (!uuid.test(value[key]))
      throw new Error(`${key} must be a valid identifier.`);
  }
  if (value.sourceCampgroundId === value.targetCampgroundId)
    throw new Error("Two different campground scopes are required.");
  value.outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!outcomeKinds.includes(value.outcomeKind))
    throw new Error("Unknown owner follow-up outcome.");
  for (const [key, min, max] of [
    ["evidenceReference", 8, 400],
    ["outcomeNote", 12, 800],
  ]) {
    value[key] = String(raw[key] ?? "").trim();
    if (
      value[key].length < min ||
      value[key].length > max ||
      /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(value[key])
    )
      throw new Error(
        `${key} must be ${min}–${max} characters and contain no contact or financial identifiers.`,
      );
  }
  return value;
}
export function normalizeOwnerOutcomeAcceptance(raw) {
  const value = {};
  for (const key of [
    "id",
    "outcomeId",
    "sourceCampgroundId",
    "targetCampgroundId",
  ]) {
    value[key] = String(raw[key] ?? "").trim();
    if (!uuid.test(value[key]))
      throw new Error(`${key} must be a valid identifier.`);
  }
  if (value.sourceCampgroundId === value.targetCampgroundId)
    throw new Error("Two different campground scopes are required.");
  value.acceptanceKind = String(raw.acceptanceKind ?? "").trim();
  if (!["accepted", "held"].includes(value.acceptanceKind))
    throw new Error("Unknown independent acceptance disposition.");
  value.auditNote = String(raw.auditNote ?? "").trim();
  if (
    value.auditNote.length < 12 ||
    value.auditNote.length > 800 ||
    /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(value.auditNote)
  )
    throw new Error(
      "Audit note must be 12–800 characters with no contact or financial identifiers.",
    );
  return value;
}
