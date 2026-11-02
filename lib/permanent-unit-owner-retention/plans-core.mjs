const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function identifier(raw, key) {
  const v = String(raw ?? "").trim();
  if (!uuid.test(v)) throw new Error(`${key} requires a valid identifier.`);
  return v;
}
function note(raw, key, min, max) {
  const v = String(raw ?? "").trim();
  if (
    v.length < min ||
    v.length > max ||
    /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(v)
  )
    throw new Error(
      `${key} must be ${min}–${max} characters without contact or financial identifiers.`,
    );
  return v;
}
function pair(raw) {
  const sourceCampgroundId = identifier(raw.sourceCampgroundId, "source"),
    targetCampgroundId = identifier(raw.targetCampgroundId, "target");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Two distinct campgrounds are required.");
  return { sourceCampgroundId, targetCampgroundId };
}
export function normalizeReopenActionPlan(raw, now = new Date()) {
  const next = String(raw.nextDueAt ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
    throw new Error("Enter a valid UTC due date.");
  const due = new Date(`${next}T23:59:00.000Z`);
  if (
    !Number.isFinite(due.getTime()) ||
    due.toISOString().slice(0, 10) !== next ||
    due <= now ||
    due.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error("Plan review is due within the next 90 days.");
  const actionKind = String(raw.actionKind ?? "").trim();
  if (
    !["gather_evidence", "investigate_source", "independent_recheck"].includes(
      actionKind,
    )
  )
    throw new Error("Unknown owner action plan kind.");
  return {
    id: identifier(raw.id, "id"),
    exceptionReviewId: identifier(raw.exceptionReviewId, "exceptionReviewId"),
    ...pair(raw),
    actionKind,
    nextDueAt: due.toISOString(),
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    actionNote: note(raw.actionNote, "Action note", 12, 800),
  };
}
export function normalizeHoldResolution(raw) {
  const resolutionKind = String(raw.resolutionKind ?? "").trim();
  if (!["continue_hold", "independently_resolved"].includes(resolutionKind))
    throw new Error("Unknown independent hold disposition.");
  return {
    id: identifier(raw.id, "id"),
    actionPlanId: identifier(raw.actionPlanId, "actionPlanId"),
    ...pair(raw),
    resolutionKind,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    resolutionNote: note(raw.resolutionNote, "Resolution note", 12, 800),
  };
}
