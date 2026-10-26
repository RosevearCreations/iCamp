const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(raw, name) {
  const v = String(raw ?? "").trim();
  if (!uuid.test(v)) throw new Error(`${name} needs a valid identifier.`);
  return v;
}
function note(raw, name, min, max) {
  const v = String(raw ?? "").trim();
  if (
    v.length < min ||
    v.length > max ||
    /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(v)
  )
    throw new Error(
      `${name} must be ${min}–${max} characters without identifiers.`,
    );
  return v;
}
function pair(raw) {
  const sourceCampgroundId = id(raw.sourceCampgroundId, "source"),
    targetCampgroundId = id(raw.targetCampgroundId, "target");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Two different campgrounds are required.");
  return { sourceCampgroundId, targetCampgroundId };
}
export function normalizeRecurrenceReview(raw) {
  return {
    id: id(raw.id, "review"),
    acceptanceId: id(raw.acceptanceId, "acceptance"),
    ...pair(raw),
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: note(raw.reviewNote, "Review note", 12, 800),
  };
}
export function normalizeRecurrenceDecision(raw, now = new Date()) {
  const decisionKind = String(raw.decisionKind ?? "").trim();
  if (
    ![
      "continue_monitoring",
      "request_evidence",
      "manual_escalation",
      "independent_no_action",
    ].includes(decisionKind)
  )
    throw new Error("Unknown recurrence decision.");
  const next = String(raw.nextDueAt ?? "").trim();
  let nextDueAt = null;
  if (decisionKind === "independent_no_action") {
    if (next) throw new Error("No-action cannot schedule a pending follow-up.");
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next))
      throw new Error("Enter a UTC review date.");
    const due = new Date(`${next}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== next ||
      due <= now ||
      due.getTime() > now.getTime() + 90 * 86400000
    )
      throw new Error("Review must be due within 90 days.");
    nextDueAt = due.toISOString();
  }
  return {
    id: id(raw.id, "decision"),
    recurrenceReviewId: id(raw.recurrenceReviewId, "review"),
    ...pair(raw),
    decisionKind,
    nextDueAt,
    evidenceReference: note(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    decisionNote: note(raw.decisionNote, "Decision note", 12, 800),
  };
}
