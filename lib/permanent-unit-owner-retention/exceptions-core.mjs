const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const issueKinds = [
  "reconciliation_missing",
  "digest_mismatch",
  "retention_missing",
  "retention_overdue",
];
const actionKinds = ["followup_needed", "escalated", "review_ready"];
const reviewKinds = ["accepted", "needs_followup"];

function uuid(raw, name) {
  const value = String(raw ?? "").trim();
  if (!uuidPattern.test(value))
    throw new Error(`${name} must be a valid identifier.`);
  return value;
}
function safeText(raw, name, min, max) {
  const value = String(raw ?? "").trim();
  if (value.length < min || value.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      value,
    )
  )
    throw new Error(`${name} cannot contain contact or financial identifiers.`);
  return value;
}
function pair(raw) {
  const sourceCampgroundId = uuid(raw.sourceCampgroundId, "Source campground");
  const targetCampgroundId = uuid(raw.targetCampgroundId, "Target campground");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Exception review requires two different campgrounds.");
  return {
    id: uuid(raw.id, "New audit identifier"),
    sourceCampgroundId,
    targetCampgroundId,
  };
}
function deadline(raw, name, now) {
  const supplied = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied))
    throw new Error(`${name} requires a UTC calendar date.`);
  const date = new Date(`${supplied}T23:59:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== supplied ||
    date <= now ||
    date.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(`${name} must fall within the next 90 days.`);
  return date.toISOString();
}
export function normalizeExportExceptionCase(raw, now = new Date()) {
  const issueKind = String(raw.issueKind ?? "").trim();
  if (!issueKinds.includes(issueKind))
    throw new Error("Unknown export retention exception kind.");
  return {
    ...pair(raw),
    exportAcceptanceId: uuid(raw.exportAcceptanceId, "Export receipt"),
    issueKind,
    actionDueAt: deadline(raw.actionDueAt, "Next owner action", now),
    evidenceReference: safeText(
      raw.evidenceReference,
      "Exception evidence reference",
      8,
      400,
    ),
    issueNote: safeText(raw.issueNote, "Exception assessment", 12, 800),
  };
}
export function normalizeExportExceptionOutcome(raw, now = new Date()) {
  const actionKind = String(raw.actionKind ?? "").trim();
  if (!actionKinds.includes(actionKind))
    throw new Error("Unknown exception follow-up action.");
  const nextDueAt =
    actionKind === "review_ready"
      ? null
      : deadline(raw.nextDueAt, "Follow-up due date", now);
  if (actionKind === "review_ready" && String(raw.nextDueAt ?? "").trim())
    throw new Error(
      "An outcome ready for independent review cannot retain an active next-action deadline.",
    );
  return {
    ...pair(raw),
    caseId: uuid(raw.caseId, "Exception case"),
    actionKind,
    nextDueAt,
    evidenceReference: safeText(
      raw.evidenceReference,
      "Follow-up evidence reference",
      8,
      400,
    ),
    actionNote: safeText(raw.actionNote, "Follow-up assessment", 12, 800),
  };
}
export function normalizeExportExceptionReview(raw) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  if (!reviewKinds.includes(reviewKind))
    throw new Error("Unknown independent audit review decision.");
  return {
    ...pair(raw),
    caseId: uuid(raw.caseId, "Exception case"),
    outcomeId: uuid(raw.outcomeId, "Reviewed outcome"),
    reviewKind,
    evidenceReference: safeText(
      raw.evidenceReference,
      "Review evidence reference",
      8,
      400,
    ),
    reviewNote: safeText(raw.reviewNote, "Independent review note", 12, 800),
  };
}
export function activeExportException(
  reconciliation,
  retention,
  now = new Date(),
) {
  if (!reconciliation) return "reconciliation_missing";
  if (reconciliation.result !== "matched") return "digest_mismatch";
  if (!retention) return "retention_missing";
  if (
    retention.eventKind !== "copy_disposed" &&
    new Date(retention.retentionDueAt) <= now
  )
    return "retention_overdue";
  return null;
}
export function exceptionCorrectionReady(
  issueKind,
  reconciliation,
  retention,
  now = new Date(),
) {
  if (["reconciliation_missing", "digest_mismatch"].includes(issueKind))
    return reconciliation?.result === "matched";
  if (["retention_missing", "retention_overdue"].includes(issueKind))
    return Boolean(
      retention &&
      (retention.eventKind === "copy_disposed" ||
        new Date(retention.retentionDueAt) > now),
    );
  return false;
}
