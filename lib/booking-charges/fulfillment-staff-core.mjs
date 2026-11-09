export const EXCEPTION_REVIEW_STATES = Object.freeze([
  "acknowledged",
  "follow_up_required",
  "ready_to_reschedule",
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function revisionNumber(value, name, minimum) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < minimum) {
    throw new Error(`${name} is invalid. Refresh the queue and retry.`);
  }
  return revision;
}

export function validateStaffAssignment({
  assignedUserId,
  assignmentNote,
  expectedAssignmentVersion,
  expectedJobVersion,
}) {
  const target = String(assignedUserId ?? "").trim();
  if (target !== "" && !uuidPattern.test(target)) {
    throw new Error("Choose a valid campground staff member.");
  }
  const note = String(assignmentNote ?? "").trim();
  if (note.length > 300) throw new Error("Assignment note is too long.");
  return {
    assignedUserId: target || null,
    assignmentNote: note || null,
    expectedAssignmentVersion: revisionNumber(
      expectedAssignmentVersion,
      "Assignment version",
      0,
    ),
    expectedJobVersion: revisionNumber(expectedJobVersion, "Task version", 1),
  };
}

export function validateExceptionReview({
  reviewState,
  reviewNote,
  expectedJobVersion,
}) {
  if (!EXCEPTION_REVIEW_STATES.includes(reviewState)) {
    throw new Error("Choose a supported blocker review outcome.");
  }
  const note = String(reviewNote ?? "").trim();
  if (note.length < 1 || note.length > 500) {
    throw new Error("Add a review explanation of at most 500 characters.");
  }
  return {
    reviewState,
    reviewNote: note,
    expectedJobVersion: revisionNumber(expectedJobVersion, "Task version", 1),
  };
}

export function summarizeStaffLoad(jobs, staff) {
  const byId = new Map(
    staff.map((person) => [
      person.userId,
      {
        userId: person.userId,
        label: person.label,
        activeJobs: 0,
        units: 0,
        blockedJobs: 0,
      },
    ]),
  );
  byId.set(null, {
    userId: null,
    label: "Unassigned",
    activeJobs: 0,
    units: 0,
    blockedJobs: 0,
  });
  for (const job of jobs) {
    if (job.jobState === "completed") continue;
    const person = byId.get(job.assignedUserId) ?? {
      userId: job.assignedUserId,
      label: "Former or unavailable staff member",
      activeJobs: 0,
      units: 0,
      blockedJobs: 0,
    };
    person.activeJobs += 1;
    person.units += Number(job.quantity);
    if (job.jobState === "blocked") person.blockedJobs += 1;
    byId.set(job.assignedUserId, person);
  }
  return [...byId.values()]
    .filter((person) => person.activeJobs > 0)
    .sort(
      (left, right) =>
        right.activeJobs - left.activeJobs ||
        left.label.localeCompare(right.label),
    );
}
