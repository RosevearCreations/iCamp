import { summarizeStandardThemeClosureReadiness } from "./standard-theme-closure-readiness-core.mjs";

export const STANDARD_OWNER_INTAKE_VERSION = 1;
export const STANDARD_OWNER_SUBMISSION_ENABLED = false;

const shaPattern = /^[a-f0-9]{40}$/;
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowedDecisions = new Set([
  "pending",
  "rejected",
  "recheck",
  "approved",
]);
const text = (value, max = 350) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
const validTime = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function prepareStandardThemeOwnerIntake(input, now = new Date()) {
  const readiness = summarizeStandardThemeClosureReadiness(input.review);
  const preparerId = text(input.preparerId, 60);
  const reviewerId = text(input.intendedReviewerId, 60);
  const campgroundId = text(input.campgroundId, 60);
  const sourceSha = text(input.sourceSha, 60).toLowerCase();
  const sourceReference = text(input.sourceReference, 180);
  const blockers = [...readiness.blockers];
  if (!uuidPattern.test(preparerId))
    blockers.push("Authenticated preparer identity missing");
  if (!uuidPattern.test(campgroundId))
    blockers.push("Authorized campground scope missing");
  if (!uuidPattern.test(reviewerId))
    blockers.push("Enter an intended independent reviewer UUID");
  else if (reviewerId.toLowerCase() === preparerId.toLowerCase())
    blockers.push("The preparer cannot be their own independent reviewer");
  if (!shaPattern.test(sourceSha))
    blockers.push("Exact 40-character release source SHA required");
  if (sourceReference.length < 8)
    blockers.push(
      "Provide a source-ticket or evidence reference (8–180 characters)",
    );
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error("Invalid evidence preparation time.");

  const preparedAt = now.toISOString();
  const packet = {
    version: STANDARD_OWNER_INTAKE_VERSION,
    recordType: "unsubmitted_standard_theme_owner_review_intake",
    authority: "BROWSER_DRAFT_ONLY",
    campgroundId,
    preparedByUserId: preparerId,
    intendedReviewerUserId: reviewerId,
    sourceSha,
    sourceReference,
    preparedAt,
    state: "pending_independent_review_not_submitted",
    areas: input.review.areas.map((item) => ({
      key: text(item.key, 40),
      reviewed: item.reviewed === true,
    })),
    devices: input.review.devices.map((item) => ({
      key: text(item.key, 40),
      result: text(item.result, 30),
      correction: text(item.correction, 350),
      retest: text(item.retest, 30),
    })),
    accessibility: input.review.accessibility.map((item) => ({
      key: text(item.key, 40),
      result: text(item.result, 30),
      followUp: text(item.followUp, 30),
      priority: text(item.priority, 20),
      note: text(item.note, 350),
      nextStep: text(item.nextStep, 350),
    })),
    notes: text(input.review.notes, 1_000),
  };
  return {
    ready: blockers.length === 0,
    blockers,
    packet,
    // A packet is manually transferable evidence, not an authenticated receipt.
    json: JSON.stringify(packet, null, 2),
  };
}

// Imported history is never treated as a trusted approval: this parser only
// gives operators a bounded, scoped, chronological comparison/readback.
export function readStandardThemeDecisionLedger(raw, scope) {
  if (typeof raw !== "string" || raw.length > 16_000)
    throw new Error("Historic decision readback must be at most 16 KB.");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Historic decision readback is not valid JSON.");
  }
  if (
    !parsed ||
    parsed.version !== STANDARD_OWNER_INTAKE_VERSION ||
    !Array.isArray(parsed.entries) ||
    parsed.entries.length > 20
  )
    throw new Error("Unsupported or oversized historic decision readback.");
  const seen = new Set();
  let lastTime = "";
  const entries = parsed.entries.map((entry) => {
    if (!entry || typeof entry !== "object")
      throw new Error("Invalid historic decision row.");
    const id = text(entry.id, 60);
    const preparerId = text(entry.preparedByUserId, 60);
    const reviewerId = text(entry.reviewerUserId, 60);
    const campgroundId = text(entry.campgroundId, 60);
    const sourceSha = text(entry.sourceSha, 60).toLowerCase();
    const decision = text(entry.decision, 30);
    const occurredAt = entry.occurredAt;
    const evidenceReference = text(entry.evidenceReference, 180);
    if (
      !uuidPattern.test(id) ||
      !uuidPattern.test(preparerId) ||
      !uuidPattern.test(reviewerId) ||
      !uuidPattern.test(campgroundId) ||
      !shaPattern.test(sourceSha) ||
      !allowedDecisions.has(decision) ||
      !validTime(occurredAt) ||
      evidenceReference.length < 8 ||
      seen.has(id.toLowerCase()) ||
      occurredAt < lastTime ||
      preparerId.toLowerCase() === reviewerId.toLowerCase() ||
      campgroundId.toLowerCase() !== scope.campgroundId.toLowerCase() ||
      preparerId.toLowerCase() !== scope.preparerId.toLowerCase()
    )
      throw new Error(
        "Historic decision source, scope, actor, chronology or fields do not match.",
      );
    seen.add(id.toLowerCase());
    lastTime = occurredAt;
    return {
      id,
      campgroundId,
      preparedByUserId: preparerId,
      reviewerUserId: reviewerId,
      sourceSha,
      decision,
      occurredAt,
      evidenceReference,
      note: text(entry.note, 350),
      // Always a claim; a client-side JSON file cannot prove identity or custody.
      authenticity: "UNVERIFIED_IMPORTED_HISTORY",
      needsSourceRecheck: sourceSha !== scope.sourceSha.toLowerCase(),
    };
  });
  return entries;
}

export function standardThemeDecisionReadbackSummary(entries) {
  return {
    total: entries.length,
    claimedApproved: entries.filter((item) => item.decision === "approved")
      .length,
    recheck: entries.filter(
      (item) => item.needsSourceRecheck || item.decision === "recheck",
    ).length,
    authoritativeDecisionRecorded: false,
  };
}
