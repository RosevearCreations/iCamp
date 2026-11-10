const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const SLA_FOLLOWUP_LABELS = Object.freeze({
  investigating: "Supervisor investigating",
  awaiting_worker: "Awaiting worker clarification",
  resolved: "Supervisor marked resolved",
  reopened: "Supervisor reopened",
});

export const SLA_EXCEPTION_LABELS = Object.freeze({
  worker_support_requested: "Worker requested support",
  acknowledgement_overdue: "Worker acknowledgement overdue",
  acknowledgement_late: "Worker acknowledgement arrived late",
  completion_overdue: "Completion target overdue",
  completion_late: "Completion finished after target",
});

export function validateSlaFollowup({
  dispatchId,
  previousReviewId,
  reviewState,
  reviewNote,
}) {
  if (!UUID.test(String(dispatchId ?? ""))) {
    throw new Error("Choose a recorded campground dispatch.");
  }
  const previous = String(previousReviewId ?? "").trim();
  if (previous && !UUID.test(previous)) {
    throw new Error("Review history changed. Refresh the work queue.");
  }
  if (!Object.hasOwn(SLA_FOLLOWUP_LABELS, String(reviewState ?? ""))) {
    throw new Error("Select a valid supervisor decision.");
  }
  const note = String(reviewNote ?? "").trim();
  if (note.length < 1 || note.length > 500) {
    throw new Error("Provide a clear supervisor note of 1–500 characters.");
  }
  return {
    dispatchId: String(dispatchId),
    previousReviewId: previous || null,
    reviewState: String(reviewState),
    reviewNote: note,
  };
}

export function needsSlaFollowup(classification) {
  if (!classification) return false;
  return (
    ["overdue", "accepted_late", "support_requested"].includes(
      classification.acknowledgement,
    ) || ["overdue", "completed_late"].includes(classification.completion)
  );
}

export function validateInboxPage(value) {
  const raw = String(value ?? "1");
  if (!/^[1-9]\d{0,2}$/u.test(raw)) return 1;
  return Math.min(100, Number(raw));
}
