const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function noteText(value) {
  const note = String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (note.length < 5 || note.length > 300) {
    throw new Error("Explain the handoff in 5–300 characters.");
  }
  return note;
}

export function validateShiftHandoffRequest({
  dispatchId,
  ownerEventId,
  targetUserId,
  note,
}) {
  if (
    ![dispatchId, ownerEventId, targetUserId].every((value) =>
      UUID.test(String(value ?? "")),
    )
  ) {
    throw new Error(
      "A current source owner and receiving supervisor are required.",
    );
  }
  return { dispatchId, ownerEventId, targetUserId, note: noteText(note) };
}

export function validateShiftHandoffDecision({ requestId, decision, note }) {
  if (
    !UUID.test(String(requestId ?? "")) ||
    !["accept", "decline"].includes(decision)
  ) {
    throw new Error("Choose a current handoff request and decision.");
  }
  return { requestId, decision, note: noteText(note) };
}

export function buildRecoveryTrendAnalytics({
  reviews,
  handoffs,
  asOf,
  days = 7,
  truncated = false,
}) {
  if (!Number.isInteger(days) || days < 1 || days > 30)
    throw new Error("Invalid trend window.");
  const end = new Date(asOf);
  if (!Number.isFinite(end.getTime()))
    throw new Error("Invalid snapshot timestamp.");
  const today = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(today - (days - i - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      followupsResolved: 0,
      escalations: 0,
      deviceBlockers: 0,
      handoffRequests: 0,
      handoffAccepted: 0,
      handoffDeclined: 0,
    };
  });
  const byDay = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  for (const review of reviews) {
    const bucket = byDay.get(String(review.reviewedAt ?? "").slice(0, 10));
    if (!bucket) continue;
    if (
      review.reviewKind === "case_followup" &&
      review.decision === "followup_resolved"
    )
      bucket.followupsResolved++;
    if (
      review.decision === "escalation_requested" ||
      review.decision === "blocker_escalated"
    )
      bucket.escalations++;
    if (
      review.reviewKind === "field_device" &&
      review.decision === "blocker_escalated"
    )
      bucket.deviceBlockers++;
  }
  for (const event of handoffs) {
    const bucket = byDay.get(String(event.recordedAt ?? "").slice(0, 10));
    if (!bucket) continue;
    if (event.eventKind === "request") bucket.handoffRequests++;
    if (event.eventKind === "accept") bucket.handoffAccepted++;
    if (event.eventKind === "decline") bucket.handoffDeclined++;
  }
  const totals = buckets.reduce(
    (sum, bucket) => {
      for (const key of [
        "followupsResolved",
        "escalations",
        "deviceBlockers",
        "handoffRequests",
        "handoffAccepted",
        "handoffDeclined",
      ])
        sum[key] += bucket[key];
      return sum;
    },
    {
      followupsResolved: 0,
      escalations: 0,
      deviceBlockers: 0,
      handoffRequests: 0,
      handoffAccepted: 0,
      handoffDeclined: 0,
    },
  );
  return {
    schema: "icamp.fulfillment.recovery-trend.v1",
    asOf,
    days,
    buckets,
    totals,
    truncated,
    source: "CAMPGROUND_PRIVATE_UNSIGNED",
    independentAcceptance: "HOLD",
  };
}

export function buildAuthorizedSourceReviewExport({
  campgroundId,
  sourceRevision,
  generatedAt,
  format,
  trend,
  reviews,
  handoffs,
  truncated,
}) {
  if (!["trend", "case_history"].includes(format))
    throw new Error("Unsupported private export format.");
  const base = {
    schema: "icamp.fulfillment.authorized-review-export.v1",
    campgroundId,
    generatedAt,
    sourceRevision,
    format,
    audience: "CAMPGROUND_SUPERVISOR_ONLY",
    trust: "UNSIGNED_PRIVATE_SNAPSHOT",
    masterConnection: "HOLD",
    truncated: Boolean(truncated),
    independentDeviceAcceptance: "HOLD",
  };
  if (format === "trend") return { ...base, trend };
  return {
    ...base,
    reviews: reviews.map((row) => ({
      eventId: row.id,
      dispatchId: row.dispatchId,
      reviewKind: row.reviewKind,
      decision: row.decision,
      reviewedAt: row.reviewedAt,
    })),
    handoffs: handoffs.map((row) => ({
      eventId: row.id,
      dispatchId: row.dispatchId,
      requestId: row.requestId,
      eventKind: row.eventKind,
      recordedAt: row.recordedAt,
    })),
  };
}
