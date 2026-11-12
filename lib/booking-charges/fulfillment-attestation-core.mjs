const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{4,95}$/u;
const validId = (v) => UUID.test(String(v ?? ""));
const note = (value) => {
  const result = String(value ?? "").trim().replace(/\s+/gu, " ");
  if (result.length < 8 || result.length > 300)
    throw new Error("Explain the source review in 8–300 characters.");
  return result;
};

export function validateOriginalDeviceReview({
  dispatchId,
  fieldReportId,
  witnessId,
  previousReviewId,
  evidenceReference,
  digestSha256,
  decision,
  explanation,
}) {
  if (![dispatchId, fieldReportId, witnessId].every(validId))
    throw new Error("Latest dispatch, field report and human witness are required.");
  const previous = String(previousReviewId ?? "").trim();
  if (previous && !validId(previous))
    throw new Error("Review history changed; refresh source evidence.");
  if (!REF.test(String(evidenceReference ?? "")))
    throw new Error("Non-secret original-device reference required.");
  if (!SHA256.test(String(digestSha256 ?? "")))
    throw new Error("Provide an independently observed SHA-256 evidence digest.");
  if (!["inspected_unverified", "recheck_required"].includes(decision))
    throw new Error("Review does not certify the original device or Master.");
  return {
    dispatchId,
    fieldReportId,
    witnessId,
    previousReviewId: previous || null,
    evidenceReference,
    digestSha256,
    decision,
    explanation: note(explanation),
  };
}

export function validateCalibrationFollowup({
  checkpointId,
  previousEventId,
  decision,
  explanation,
}) {
  if (!validId(checkpointId)) throw new Error("Saved forecast checkpoint required.");
  const previous = String(previousEventId ?? "").trim();
  if (previous && !validId(previous))
    throw new Error("Forecast exception history changed; refresh.");
  if (!["investigate", "mitigation_recorded", "recheck_required"].includes(decision))
    throw new Error("Only source-side calibration follow-up is permitted.");
  return {
    checkpointId,
    previousEventId: previous || null,
    decision,
    explanation: note(explanation),
  };
}

/** Source-only diagnostic. No invented SLA, calibrated model or owner approval. */
export function classifyCalibrationException(evaluation) {
  if (evaluation?.evidenceState === "AWAITING_EIGHT_HOUR_HORIZON")
    return { status: "PENDING_WINDOW", deviation: null };
  if (evaluation?.evidenceState !== "OBSERVED_SOURCE_ONLY")
    return { status: "PARTIAL_HOLD", deviation: null };
  const deviation = evaluation.absoluteError;
  const threshold = Math.max(2, Math.ceil(evaluation.expectedNewReviewEvents / 2));
  if (!Number.isInteger(deviation) || deviation < 0)
    return { status: "PARTIAL_HOLD", deviation: null };
  return {
    status: deviation >= threshold ? "INVESTIGATE_VARIANCE" : "WITHIN_REVIEW_BAND",
    deviation,
    threshold,
  };
}

export function buildOwnerAcceptanceEvidenceExport({
  campgroundId,
  sourceRevision,
  generatedAt,
  witnessEvents,
  originalDeviceReviews,
  checkpoints,
  evaluations,
  calibrations,
  ownerAudits,
  truncated,
}) {
  if (!validId(campgroundId)) throw new Error("Campground scope required.");
  const calibrationByCheckpoint = new Map();
  for (const row of calibrations)
    if (!calibrationByCheckpoint.has(row.checkpointId))
      calibrationByCheckpoint.set(row.checkpointId, row);
  const deviceByDispatch = new Map();
  for (const row of originalDeviceReviews)
    if (!deviceByDispatch.has(row.dispatchId))
      deviceByDispatch.set(row.dispatchId, row);
  return {
    schema: "icamp.fulfillment.owner-acceptance-evidence.v1",
    campgroundId,
    sourceRevision,
    generatedAt,
    audience: "AUTHENTICATED_CAMPGROUND_OWNER_ADMIN_ONLY",
    trust: "UNSIGNED_TENANT_SCOPED_SOURCE_EVIDENCE",
    completeness: truncated ? "PARTIAL_HOLD" : "SOURCE_SNAPSHOT_ONLY",
    witnessStatementCount: witnessEvents.length,
    originalDeviceReviews: [...deviceByDispatch.values()].map((row) => ({
      dispatchId: row.dispatchId,
      fieldReportId: row.fieldReportId,
      witnessId: row.witnessId,
      reviewId: row.id,
      decision: row.decision,
      reviewedAt: row.reviewedAt,
      evidenceDigestSha256: row.digestSha256,
      cryptographicDeviceAttestation: "HOLD",
    })),
    forecastCalibration: checkpoints.map((row) => {
      const result = evaluations.find((item) => item.checkpointId === row.id);
      const followup = calibrationByCheckpoint.get(row.id);
      return {
        checkpointId: row.id,
        capturedAt: row.capturedAt,
        expectedNewReviewEvents: row.expectedNewReviewEvents,
        observedNewReviewEvents: result?.observedNewReviewEvents ?? null,
        evidenceState: result?.evidenceState ?? "SOURCE_UNAVAILABLE",
        variance: classifyCalibrationException(result),
        followupStatus: followup?.decision ?? "NOT_RECORDED",
        followupEventId: followup?.id ?? null,
      };
    }),
    ownerAuditDecisions: ownerAudits.map((row) => ({
      id: row.id,
      subjectKind: row.subjectKind,
      subjectId: row.subjectId,
      decision: row.decision,
      reviewedAt: row.reviewedAt,
    })),
    noGuestOrWorkerPII: true,
    originalDeviceSignatureVerified: false,
    independentEd25519SourceSigner: "HOLD",
    sourceSignedHealthyReceipt: "HOLD",
    durableMasterReplay: "HOLD",
    masterConnection: "HOLD",
    ownerProductionAcceptance: "HOLD",
  };
}
