const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function uuid(value, message) {
  if (!UUID.test(String(value ?? ""))) throw new Error(message);
  return value;
}

function note(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (text.length < 8 || text.length > 300)
    throw new Error("Provide an evidence explanation of 8–300 characters.");
  return text;
}

export function validateIndependentFieldWitness({
  dispatchId,
  closureId,
  previousWitnessId,
  decision,
  evidenceReference,
  explanation,
}) {
  uuid(dispatchId, "Source dispatch is required.");
  uuid(closureId, "Current field closure is required.");
  const previous = String(previousWitnessId ?? "").trim();
  if (previous) uuid(previous, "Witness history is stale.");
  if (!["observed_unverified", "recheck_required"].includes(decision))
    throw new Error("Choose a supported witness decision.");
  const reference = String(evidenceReference ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$/u.test(reference))
    throw new Error("Use a non-secret evidence reference.");
  return {
    dispatchId,
    closureId,
    previousWitnessId: previous || null,
    decision,
    evidenceReference: reference,
    explanation: note(explanation),
  };
}

export function validateOwnerShiftAudit({
  subjectKind,
  subjectId,
  decision,
  explanation,
}) {
  if (!["field_witness", "forecast_checkpoint"].includes(subjectKind))
    throw new Error("Choose a supported audit subject.");
  uuid(subjectId, "Current audit source event is required.");
  if (!["reviewed_unverified", "recheck_required"].includes(decision))
    throw new Error("Choose an owner review decision.");
  return { subjectKind, subjectId, decision, explanation: note(explanation) };
}

/** Compare a saved, immutable eight-hour prediction with later source events.
 * Historical review is not independent device acceptance or an SLA.
 */
export function evaluateForecastCheckpoint({
  checkpoint,
  reviews,
  handoffs,
  asOf,
  truncated = false,
}) {
  const start = Date.parse(checkpoint?.capturedAt);
  const now = Date.parse(asOf);
  if (!Number.isFinite(start) || !Number.isFinite(now))
    throw new Error("Forecast checkpoint timestamps are unavailable.");
  const end = start + 8 * 60 * 60 * 1000;
  const sourceEvents = [
    ...reviews
      .filter(
        (event) =>
          ["escalation_requested", "blocker_escalated"].includes(
            event.decision,
          ) &&
          Number.isFinite(Date.parse(event.reviewedAt)) &&
          Date.parse(event.reviewedAt) >= start &&
          Date.parse(event.reviewedAt) < end,
      )
      .map((event) => event.id),
    ...handoffs
      .filter(
        (event) =>
          event.eventKind === "request" &&
          Number.isFinite(Date.parse(event.recordedAt)) &&
          Date.parse(event.recordedAt) >= start &&
          Date.parse(event.recordedAt) < end,
      )
      .map((event) => event.id),
  ];
  const pending = now < end;
  const partial = truncated || checkpoint.evidenceCoverage === "PARTIAL_HOLD";
  const predicted = checkpoint.expectedNewReviewEvents;
  if (!Number.isInteger(predicted) || predicted < 0)
    throw new Error("Invalid historical source forecast.");
  return {
    checkpointId: checkpoint.id,
    horizonEndedAt: new Date(end).toISOString(),
    expectedNewReviewEvents: predicted,
    observedNewReviewEvents: pending ? null : sourceEvents.length,
    absoluteError: pending ? null : Math.abs(predicted - sourceEvents.length),
    evidenceState: pending
      ? "AWAITING_EIGHT_HOUR_HORIZON"
      : partial
        ? "PARTIAL_HOLD"
        : "OBSERVED_SOURCE_ONLY",
    ownerAcceptance: "HOLD",
    independentFieldAcceptance: "HOLD",
  };
}

export function buildWitnessAuditSummary({
  witnesses,
  checkpoints,
  reviews,
  handoffs,
  ownerAudits,
  asOf,
  truncated = false,
}) {
  const latestWitness = new Map();
  for (const witness of witnesses)
    if (!latestWitness.has(witness.dispatchId))
      latestWitness.set(witness.dispatchId, witness);
  const items = [...latestWitness.values()];
  const complete = checkpoints.map((checkpoint) =>
    evaluateForecastCheckpoint({
      checkpoint,
      reviews,
      handoffs,
      asOf,
      truncated,
    }),
  );
  return {
    schema: "icamp.fulfillment.owner-field-audit.v1",
    audience: "CAMPGROUND_OWNER_ADMIN_PRIVATE",
    asOf,
    latestWitnessReviews: items.filter(
      (item) => item.decision === "observed_unverified",
    ).length,
    witnessRechecks: items.filter(
      (item) => item.decision === "recheck_required",
    ).length,
    forecastCheckpoints: complete.length,
    forecastHorizonCompleted: complete.filter(
      (item) => item.evidenceState !== "AWAITING_EIGHT_HOUR_HORIZON",
    ).length,
    forecastResults: complete,
    ownerReviewEvents: ownerAudits.length,
    sourceCoverage: truncated ? "PARTIAL_HOLD" : "SOURCE_SNAPSHOT_ONLY",
    independentDeviceAcceptance: "HOLD",
    masterConnection: "HOLD",
    ownerAcceptance: "HOLD",
  };
}
