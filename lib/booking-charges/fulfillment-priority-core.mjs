import { needsSlaFollowup } from "./fulfillment-followup-core.mjs";

export const FULFILLMENT_PRIORITY_FILTERS = Object.freeze({
  open: "Open exceptions",
  overdue: "Overdue or needs recheck",
  support: "Worker support requests",
  reviewed: "Reviewed or resolved",
  history: "Superseded history",
  all: "All visible handoffs",
});

export function validateFulfillmentPriorityFilter(value) {
  return Object.hasOwn(FULFILLMENT_PRIORITY_FILTERS, String(value ?? ""))
    ? String(value)
    : "open";
}

export function validateFulfillmentPriorityPage(value) {
  const raw = String(value ?? "1");
  return /^[1-9]\d{0,2}$/u.test(raw) ? Math.min(100, Number(raw)) : 1;
}

function validTime(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

/** This is a display-only aging projection, not a contractual SLA threshold. */
export function agingBand(minutes) {
  if (minutes === null) return "Unknown";
  if (minutes < 60) return "Under 1 hour";
  if (minutes < 240) return "1–4 hours";
  if (minutes < 1440) return "4–24 hours";
  return "24+ hours";
}

export function classifyFulfillmentPriority({
  dispatch,
  classification,
  followup = null,
  now = new Date().toISOString(),
}) {
  const currentTime = validTime(now);
  const hasEvidence = Boolean(
    dispatch && classification && currentTime !== null,
  );
  if (!hasEvidence) {
    return {
      category: "unknown",
      title: "Evidence needs recheck",
      priorityRank: 0,
      ageMinutes: null,
      ageBand: "Unknown",
      ageSource: null,
      nextStep:
        "Refresh the original campground dispatch evidence before deciding.",
      isOpen: true,
      isException: true,
    };
  }

  const ack = classification.acknowledgement;
  const completion = classification.completion;
  const ackOverdue = ack === "overdue";
  const completionOverdue = completion === "overdue";
  const support = ack === "support_requested";
  const late = ack === "accepted_late" || completion === "completed_late";
  const exception = needsSlaFollowup(classification);
  const resolved = followup?.state === "resolved";
  let category;
  let title;
  let priorityRank;
  let nextStep;

  if (classification.status === "superseded") {
    category = "history";
    title = "Superseded dispatch · history only";
    priorityRank = 5;
    nextStep =
      "Review the current assignment before acting; this dispatch is not an instruction.";
  } else if (resolved && (ackOverdue || completionOverdue)) {
    category = "recheck";
    title = "Resolved review, but deadline remains overdue";
    priorityRank = 1;
    nextStep =
      "Verify current source evidence and reopen supervisor review if necessary.";
  } else if (resolved) {
    category = "resolved";
    title = "Supervisor documented resolution";
    priorityRank = 4;
    nextStep =
      "Review the recorded decision; do not infer job completion from review closure.";
  } else if (support) {
    category = "support";
    title = "Worker requested supervisor support";
    priorityRank = 0;
    nextStep =
      "Review the worker note and document a supervisor follow-up in the source queue.";
  } else if (ackOverdue || completionOverdue) {
    category = "overdue";
    title =
      ackOverdue && completionOverdue
        ? "Acknowledgement and completion overdue"
        : ackOverdue
          ? "Acknowledgement overdue"
          : "Completion target overdue";
    priorityRank = 1;
    nextStep =
      "Confirm the current assignment and record a supervisor follow-up.";
  } else if (exception && followup) {
    category = "reviewed";
    title = "Supervisor follow-up in progress";
    priorityRank = 2;
    nextStep =
      "Review the latest supervisor decision and complete the documented next step.";
  } else if (late) {
    category = "late";
    title = "Late evidence awaiting review";
    priorityRank = 3;
    nextStep =
      "Review the original missed target and record a supervisor decision.";
  } else if (followup) {
    category = "reviewed";
    title = "Recorded supervisor review";
    priorityRank = 2;
    nextStep =
      "Inspect the source-linked follow-up and current assignment before closing.";
  } else {
    category = "normal";
    title = "No recorded exception";
    priorityRank = 6;
    nextStep =
      "Continue the regular assignment workflow; no exception has been established.";
  }

  // Historic assignment changes have no recorded supersession instant.
  // Do not invent an aging value for those rows.
  const candidates =
    classification.status === "superseded"
      ? []
      : [
          ...(support
            ? [
                {
                  time: validTime(dispatch.acknowledgedAt),
                  label: "Worker support receipt",
                },
              ]
            : []),
          ...(ackOverdue || ack === "accepted_late"
            ? [
                {
                  time: validTime(dispatch.acknowledgementDueAt),
                  label: "Acknowledgement deadline",
                },
              ]
            : []),
          ...(completionOverdue || completion === "completed_late"
            ? [
                {
                  time: validTime(dispatch.completionDueAt),
                  label: "Completion deadline",
                },
              ]
            : []),
        ].filter((item) => item.time !== null);
  candidates.sort((a, b) => a.time - b.time);
  const oldest = candidates[0] ?? null;
  const closeTime =
    resolved && category === "resolved"
      ? validTime(followup.reviewedAt)
      : currentTime;
  const ageMinutes =
    oldest && closeTime !== null && closeTime >= oldest.time
      ? Math.floor((closeTime - oldest.time) / 60_000)
      : null;
  return {
    category,
    title,
    priorityRank,
    ageMinutes,
    ageBand: agingBand(ageMinutes),
    ageSource: oldest?.label ?? null,
    nextStep,
    isOpen: [
      "unknown",
      "recheck",
      "support",
      "overdue",
      "reviewed",
      "late",
    ].includes(category),
    isException: exception || Boolean(followup) || category === "unknown",
  };
}

export function matchesFulfillmentPriorityFilter(priority, filter) {
  switch (validateFulfillmentPriorityFilter(filter)) {
    case "open":
      return priority.isOpen && priority.category !== "normal";
    case "overdue":
      return ["overdue", "recheck"].includes(priority.category);
    case "support":
      return priority.category === "support";
    case "reviewed":
      return ["reviewed", "resolved"].includes(priority.category);
    case "history":
      return priority.category === "history";
    default:
      return true;
  }
}

export function compareFulfillmentPriority(a, b) {
  return (
    a.priority.priorityRank - b.priority.priorityRank ||
    (b.priority.ageMinutes ?? -1) - (a.priority.ageMinutes ?? -1) ||
    a.dispatch.id.localeCompare(b.dispatch.id)
  );
}

export function workerRecoveryGuidance(classification) {
  if (!classification) {
    return {
      title: "Handoff evidence unavailable",
      urgent: true,
      step: "Refresh your inbox. Ask your supervisor to confirm the current assignment before acting.",
    };
  }
  if (classification.status === "superseded") {
    return {
      title: "Previous assignment · do not act",
      urgent: true,
      step: "This handoff is history only. Refresh your inbox for current work, or ask your supervisor for a new dispatch.",
    };
  }
  if (classification.acknowledgement === "support_requested") {
    return {
      title: "Support request recorded",
      urgent: true,
      step: "Your supervisor must review your request. Contact them using your campground's approved staff channel; do not submit a second receipt.",
    };
  }
  if (classification.acknowledgement === "overdue") {
    return {
      title: "Your response deadline passed",
      urgent: true,
      step: "If the response form remains available, acknowledge or explain the support needed. If it has closed, ask your supervisor to recheck the handoff.",
    };
  }
  if (classification.completion === "overdue") {
    return {
      title: "Completion target passed",
      urgent: true,
      step: "Tell your supervisor the work status using the approved staff process. A receipt does not mark the job complete or change the deadline.",
    };
  }
  if (
    classification.acknowledgement === "accepted_late" ||
    classification.completion === "completed_late"
  ) {
    return {
      title: "Late evidence recorded",
      urgent: false,
      step: "The original deadline is retained for supervisor review. Do not attempt to erase or replace the receipt.",
    };
  }
  return {
    title: "Current handoff guidance",
    urgent: false,
    step: "Review the service details and the reply deadline. A receipt confirms only that you received the assignment.",
  };
}
