const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function validateFieldClosureEvidence({
  dispatchId,
  fieldReportId,
  reviewId,
  previousEventId,
  decision,
  evidenceReference,
  note,
}) {
  if (
    ![dispatchId, fieldReportId, reviewId].every((id) =>
      UUID.test(String(id ?? "")),
    )
  ) {
    throw new Error(
      "Current dispatch, device report and supervisor review are required.",
    );
  }
  const previous = String(previousEventId ?? "").trim();
  if (previous && !UUID.test(previous))
    throw new Error("Closure evidence changed. Refresh first.");
  if (!["closure_reviewed", "recheck_required"].includes(decision)) {
    throw new Error("A supported supervisor closure decision is required.");
  }
  const reference = String(evidenceReference ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$/u.test(reference)) {
    throw new Error(
      "Use a non-secret source evidence reference (5–96 characters).",
    );
  }
  const explanation = String(note ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (explanation.length < 8 || explanation.length > 300) {
    throw new Error("Explain the field evidence in 8–300 characters.");
  }
  return {
    dispatchId,
    fieldReportId,
    reviewId,
    previousEventId: previous || null,
    decision,
    evidenceReference: reference,
    note: explanation,
  };
}

/** A transparent capacity planning estimate, never a staffing commitment or verified SLA. */
export function buildSupervisorWorkloadForecast({
  trend,
  openCases,
  pendingHandoffs,
  asOf,
  truncated = false,
}) {
  if (
    !trend ||
    !Number.isInteger(openCases) ||
    openCases < 0 ||
    !Number.isInteger(pendingHandoffs) ||
    pendingHandoffs < 0 ||
    !Number.isFinite(Date.parse(asOf))
  )
    throw new Error("Source workload snapshot is unavailable.");
  const observedDemand = trend.buckets.map(
    (bucket) =>
      bucket.escalations + bucket.deviceBlockers + bucket.handoffRequests,
  );
  const count = observedDemand.reduce((sum, day) => sum + day, 0);
  // Eight-hour shifts: divide observed daily demand by three. Do not add
  // unresolved handoffs a second time to the open-case backlog.
  const expectedNew = Math.ceil(count / (trend.days * 3));
  const peakNew = Math.ceil(Math.max(0, ...observedDemand) / 3);
  return {
    schema: "icamp.fulfillment.supervisor-workload-forecast.v1",
    asOf,
    horizonHours: 8,
    openCases,
    pendingHandoffs,
    observedDemandEvents: count,
    expectedNewReviewEvents: expectedNew,
    planningLoad: openCases + expectedNew,
    peakDailyShiftEquivalent: peakNew,
    evidenceCoverage:
      truncated || trend.truncated ? "PARTIAL_HOLD" : "SOURCE_SNAPSHOT_ONLY",
    methodology:
      "Observed seven-day escalation, device blocker and handoff-request events divided by three eight-hour shifts per UTC day; rounded up.",
    independentAcceptance: "HOLD",
    automatedStaffing: false,
  };
}

export function buildOwnerShiftPerformanceReport({
  campgroundId,
  sourceRevision,
  asOf,
  trend,
  forecast,
  closures,
  truncated,
}) {
  if (!UUID.test(String(campgroundId ?? "")))
    throw new Error("Campground required.");
  const latest = new Map();
  for (const event of closures)
    if (!latest.has(event.dispatchId)) latest.set(event.dispatchId, event);
  const current = [...latest.values()];
  return {
    schema: "icamp.fulfillment.owner-shift-performance.v1",
    audience: "AUTHENTICATED_CAMPGROUND_OWNER_ADMIN_ONLY",
    campgroundId,
    sourceRevision,
    generatedAt: asOf,
    trend,
    forecast,
    fieldClosureReviews: current.filter(
      (event) => event.decision === "closure_reviewed",
    ).length,
    fieldRechecks: current.filter(
      (event) => event.decision === "recheck_required",
    ).length,
    sourceCoverage: truncated ? "PARTIAL_HOLD" : "SOURCE_SNAPSHOT_ONLY",
    independentlyVerifiedFieldAcceptance: false,
    signedSourceHealthReceipt: false,
    masterConnection: "HOLD",
    ownerAcceptance: "HOLD",
  };
}
