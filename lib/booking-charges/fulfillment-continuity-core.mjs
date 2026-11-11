const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const CONTINUITY_DECISIONS = Object.freeze({
  pending_worker: "Awaiting worker response",
  supervisor_recheck: "Supervisor recheck scheduled",
  escalation_requested: "Escalation requested",
  followup_resolved: "Supervisor follow-up resolved",
});

export const DEVICE_REVIEW_DECISIONS = Object.freeze({
  needs_retest: "Needs another field test",
  blocker_escalated: "Device blocker escalated",
  reviewed_unverified: "Report reviewed; independent acceptance pending",
});

export function validateSupervisorContinuityReview({
  dispatchId,
  subjectId,
  previousReviewId,
  reviewKind,
  decision,
  note,
}) {
  if (
    !UUID.test(String(dispatchId ?? "")) ||
    !UUID.test(String(subjectId ?? ""))
  ) {
    throw new Error("Choose a recorded case and source evidence item.");
  }
  const previous = String(previousReviewId ?? "").trim();
  if (previous && !UUID.test(previous)) {
    throw new Error("The review history changed. Refresh the case.");
  }
  const decisions =
    reviewKind === "case_followup"
      ? CONTINUITY_DECISIONS
      : reviewKind === "field_device"
        ? DEVICE_REVIEW_DECISIONS
        : null;
  if (!decisions || !Object.hasOwn(decisions, String(decision ?? ""))) {
    throw new Error("Select a supported source review decision.");
  }
  const observation = String(note ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (observation.length < 5 || observation.length > 300) {
    throw new Error("Explain the review in 5–300 characters.");
  }
  return {
    dispatchId: String(dispatchId),
    subjectId: String(subjectId),
    previousReviewId: previous || null,
    reviewKind,
    decision: String(decision),
    note: observation,
  };
}

/** This is a staff-only source snapshot, never a Master Shell or signed receipt. */
export function buildSupervisorPrivateExport({
  campgroundId,
  asOf,
  sourceRevision,
  supervisor,
  continuity,
}) {
  const ownerByDispatch = new Map(
    supervisor.ownership.map((row) => [row.dispatchId, row]),
  );
  const mobileByDispatch = new Map(
    supervisor.mobile.map((row) => [row.dispatchId, row]),
  );
  const caseByDispatch = new Map(
    continuity.caseFollowups.map((row) => [row.dispatchId, row]),
  );
  const deviceByDispatch = new Map(
    continuity.deviceReviews.map((row) => [row.dispatchId, row]),
  );
  const ids = [
    ...new Set([
      ...ownerByDispatch.keys(),
      ...mobileByDispatch.keys(),
      ...caseByDispatch.keys(),
      ...deviceByDispatch.keys(),
    ]),
  ].sort();
  return {
    schema: "icamp.fulfillment.supervisor-private-evidence.v1",
    campgroundId,
    generatedAt: asOf,
    sourceRevision,
    source: "ICAMP_CAMPGROUND_PRIVATE",
    audience: "AUTHORIZED_CAMPGROUND_SUPERVISOR_ONLY",
    signedHealthReceipt: false,
    independentDeviceAcceptance: "HOLD",
    truncated: supervisor.truncated || continuity.truncated,
    cases: ids.map((dispatchId) => {
      const owner = ownerByDispatch.get(dispatchId);
      const field = mobileByDispatch.get(dispatchId);
      const caseReview = caseByDispatch.get(dispatchId);
      const deviceReview = deviceByDispatch.get(dispatchId);
      return {
        dispatchId,
        ownerEventId: owner?.id ?? null,
        ownerAssigned: Boolean(owner?.claimedByUserId),
        workerReportId: field?.id ?? null,
        workerDeviceKind: field?.deviceKind ?? null,
        workerReportedOutcome: field?.outcome ?? null,
        caseReviewDecision: caseReview?.decision ?? null,
        caseReviewSourceCurrent: Boolean(
          caseReview && owner && caseReview.subjectId === owner.id,
        ),
        deviceReviewDecision: deviceReview?.decision ?? null,
        deviceReviewSourceCurrent: Boolean(
          deviceReview && field && deviceReview.subjectId === field.id,
        ),
        independentDeviceAcceptance: "HOLD",
      };
    }),
  };
}
