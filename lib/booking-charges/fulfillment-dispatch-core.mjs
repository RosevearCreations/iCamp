const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const UTC_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

function revision(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} changed. Refresh the work queue.`);
  }
  return number;
}

export function validateDispatchHandoff({
  jobId,
  assignedUserId,
  expectedJobVersion,
  expectedAssignmentVersion,
  acknowledgementMinutes,
  completionTargetUtc,
}) {
  if (
    !UUID.test(String(jobId ?? "")) ||
    !UUID.test(String(assignedUserId ?? ""))
  ) {
    throw new Error("Select current assigned campground work.");
  }
  const minutes = Number(acknowledgementMinutes);
  if (
    !/^\d+$/u.test(String(acknowledgementMinutes ?? "")) ||
    !Number.isSafeInteger(minutes) ||
    minutes < 5 ||
    minutes > 10080
  ) {
    throw new Error("Set a worker acknowledgement target of 5–10080 minutes.");
  }
  const rawTarget = String(completionTargetUtc ?? "").trim();
  let completionDueAt = null;
  if (rawTarget) {
    if (!UTC_INPUT.test(rawTarget)) {
      throw new Error("Enter a valid optional UTC completion deadline.");
    }
    const parsed = new Date(`${rawTarget}:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 16) !== rawTarget
    ) {
      throw new Error("Enter a real UTC date and time.");
    }
    completionDueAt = parsed.toISOString();
  }
  return {
    jobId: String(jobId),
    assignedUserId: String(assignedUserId),
    expectedJobVersion: revision(expectedJobVersion, "Job version"),
    expectedAssignmentVersion: revision(
      expectedAssignmentVersion,
      "Assignment version",
    ),
    acknowledgementMinutes: minutes,
    completionDueAt,
  };
}

export function validateWorkerDispatchAcknowledgement({
  dispatchId,
  response,
  note,
}) {
  if (!UUID.test(String(dispatchId ?? ""))) {
    throw new Error("Choose a current dispatch.");
  }
  if (response !== "accepted" && response !== "needs_support") {
    throw new Error("Choose a worker acknowledgement outcome.");
  }
  const message = String(note ?? "").trim();
  if (message.length > 300 || (response === "needs_support" && !message)) {
    throw new Error("Explain any support request in 1–300 characters.");
  }
  return { dispatchId: String(dispatchId), response, note: message || null };
}

function timestamp(value) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : NaN;
}

export function classifyFulfillmentDispatch({
  currentJobVersion,
  currentAssignmentVersion,
  currentAssignedUserId,
  jobState,
  dispatch,
  isLatest = true,
  now = new Date().toISOString(),
}) {
  if (!dispatch) return null;
  const superseded =
    !isLatest ||
    !["scheduled", "in_progress", "completed"].includes(jobState) ||
    dispatch.assignedUserId !== currentAssignedUserId ||
    dispatch.assignmentVersion !== currentAssignmentVersion ||
    (jobState !== "completed" && dispatch.jobVersion !== currentJobVersion);
  const acknowledgement = !dispatch.response
    ? timestamp(now) > timestamp(dispatch.acknowledgementDueAt)
      ? "overdue"
      : "pending"
    : dispatch.response === "needs_support"
      ? "support_requested"
      : timestamp(dispatch.acknowledgedAt) >
          timestamp(dispatch.acknowledgementDueAt)
        ? "accepted_late"
        : "accepted_on_time";
  const completion = !dispatch.completionDueAt
    ? "not_configured"
    : dispatch.completedAt
      ? timestamp(dispatch.completedAt) > timestamp(dispatch.completionDueAt)
        ? "completed_late"
        : "completed_on_time"
      : timestamp(now) > timestamp(dispatch.completionDueAt)
        ? "overdue"
        : "pending";
  return {
    status: superseded ? "superseded" : "current",
    acknowledgement,
    completion,
    canAcknowledge:
      !superseded &&
      !dispatch.response &&
      ["scheduled", "in_progress"].includes(jobState),
  };
}

export const DISPATCH_ACK_LABELS = Object.freeze({
  pending: "Awaiting worker reply",
  overdue: "Worker acknowledgement overdue",
  accepted_on_time: "Accepted within target",
  accepted_late: "Accepted after target",
  support_requested: "Worker requested support",
});

export const DISPATCH_COMPLETION_LABELS = Object.freeze({
  not_configured: "No completion SLA set",
  pending: "Within completion target",
  overdue: "Completion target overdue",
  completed_on_time: "Completed within target",
  completed_late: "Completed after target",
});
