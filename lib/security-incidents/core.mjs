export const INCIDENT_CATEGORIES = Object.freeze([
  "access",
  "threat",
  "injury",
  "property",
  "safety",
  "other",
]);
export const INCIDENT_SEVERITIES = Object.freeze([
  "low",
  "moderate",
  "high",
  "critical",
]);
export const INCIDENT_SIGNALS = Object.freeze([
  "access_denied",
  "device_fault",
  "override_failed",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function incidentUuid(value, label = "Identifier") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!UUID.test(normalized)) throw new Error(`${label} must be a UUID.`);
  return normalized;
}

export function incidentText(value, label, min = 8, max = 1500) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  }
  return normalized;
}

export function normalizeIncidentIntake(input) {
  if (!INCIDENT_CATEGORIES.includes(input?.category))
    throw new Error("Unsupported security incident category.");
  if (!INCIDENT_SEVERITIES.includes(input?.severity))
    throw new Error("Unsupported security incident severity.");
  const linkedSignalKind = String(input.linkedSignalKind ?? "").trim() || null;
  const linkedSignalId = String(input.linkedSignalId ?? "").trim() || null;
  if (Boolean(linkedSignalId) !== Boolean(linkedSignalKind))
    throw new Error("A signal kind and signal ID must be provided together.");
  if (linkedSignalKind && !INCIDENT_SIGNALS.includes(linkedSignalKind))
    throw new Error("Unknown security signal kind.");
  return {
    title: incidentText(input.title, "Case title", 8, 160),
    category: input.category,
    severity: input.severity,
    operationalSummary: incidentText(
      input.operationalSummary,
      "Operational summary",
      20,
      1500,
    ),
    linkedSignalKind,
    linkedSignalId: linkedSignalId
      ? incidentUuid(linkedSignalId, "Linked signal")
      : null,
  };
}

export function independentReviewEligibility(
  caseItem,
  actorUserId,
  events = [],
) {
  if (caseItem.status !== "closure_pending")
    return { eligible: false, reason: "Closure has not been requested." };
  const actor = incidentUuid(actorUserId, "Reviewer");
  if (
    actor === caseItem.openedByUserId ||
    actor === caseItem.assigneeUserId ||
    actor === caseItem.closureRequestedByUserId ||
    events.some(
      (event) =>
        event.actorUserId === actor &&
        [
          "intake",
          "assigned",
          "investigated",
          "escalated",
          "evidence_attached",
          "closure_requested",
        ].includes(event.eventKind),
    )
  ) {
    return {
      eligible: false,
      reason: "A case contributor cannot approve their own investigation.",
    };
  }
  return { eligible: true, reason: null };
}

export function canRequestIncidentClosure(caseItem, attachments) {
  return (
    ["investigating", "escalated"].includes(caseItem.status) &&
    attachments.some(
      (item) =>
        item.lifecycleState === "active" &&
        item.validationState === "validated",
    )
  );
}
