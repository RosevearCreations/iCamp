const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ongoingKinds = ["coordination_in_progress", "additional_review_needed"];
const finalKinds = ["target_review_completed", "unable_to_proceed"];
const resolutionKinds = [
  "owner_coordination_complete",
  "planning_closed_unresolved",
  "new_plan_recommended",
];
function uuid(input, name) {
  const value = String(input ?? "").trim();
  if (!uuidPattern.test(value))
    throw new Error(`${name} must be a valid identifier.`);
  return value;
}
function text(input, name, minimum, maximum) {
  const value = String(input ?? "").trim();
  if (value.length < minimum || value.length > maximum)
    throw new Error(
      `${name} must be between ${minimum} and ${maximum} characters.`,
    );
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      value,
    )
  )
    throw new Error(
      `${name} must not include applicant contact or financial identifiers.`,
    );
  return value;
}
function nextAction(input, now) {
  const supplied = String(input ?? "").trim();
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(supplied)
      ? `${supplied}T23:59:00.000Z`
      : supplied,
  );
  if (
    !Number.isFinite(date.getTime()) ||
    date <= now ||
    date.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(
      "Open coordination must have a next action within 90 days.",
    );
  return date.toISOString();
}
function common(input) {
  const sourceCampgroundId = uuid(
    input.sourceCampgroundId,
    "Source campground",
  );
  const targetCampgroundId = uuid(
    input.targetCampgroundId,
    "Target campground",
  );
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error(
      "A cross-campground handoff must have distinct source and target campgrounds.",
    );
  return {
    id: uuid(input.id, "Evidence record"),
    planId: uuid(input.planId, "Source handoff plan"),
    sourceCampgroundId,
    targetCampgroundId,
    evidenceReference: text(
      input.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    ownerNote: text(input.ownerNote, "Outcome or resolution note", 12, 800),
  };
}
export function normalizeHandoffOutcome(input, now = new Date()) {
  const data = common(input);
  const outcomeKind = String(input.outcomeKind ?? "").trim();
  if (![...ongoingKinds, ...finalKinds].includes(outcomeKind))
    throw new Error("Unrecognized owner handoff outcome.");
  const next = String(input.nextActionAt ?? "").trim();
  if (finalKinds.includes(outcomeKind) && next)
    throw new Error(
      "A final coordination outcome cannot create another pending action.",
    );
  return {
    ...data,
    outcomeKind,
    nextActionAt: ongoingKinds.includes(outcomeKind)
      ? nextAction(next, now)
      : null,
  };
}
export function normalizeHandoffResolution(input) {
  const data = common(input);
  const resolutionKind = String(input.resolutionKind ?? "").trim();
  if (!resolutionKinds.includes(resolutionKind))
    throw new Error("Unrecognized planning resolution.");
  return {
    ...data,
    latestOutcomeId: uuid(input.latestOutcomeId, "Latest outcome"),
    resolutionKind,
  };
}
export function latestOutcomesByPlan(outcomes) {
  const latest = new Map();
  for (const outcome of [...outcomes].sort(
    (a, b) =>
      b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id),
  )) {
    if (!latest.has(outcome.planId)) latest.set(outcome.planId, outcome);
  }
  return latest;
}
export function canResolveOutcome(outcome, resolved) {
  return Boolean(
    outcome && !resolved && finalKinds.includes(outcome.outcomeKind),
  );
}
