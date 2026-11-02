const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const shiftDepartments = Object.freeze([
  "front_desk",
  "housekeeping",
  "grounds",
  "maintenance",
  "security",
  "store",
  "aquatics",
  "waterfront",
  "equipment",
  "food_service",
]);
export const shiftQualifications = Object.freeze([
  "pool_lifeguard",
  "waterfront_monitor",
  "equipment_operator",
  "food_safety",
  "first_aid",
]);
export const sensitiveDepartmentQualifications = Object.freeze({
  aquatics: "pool_lifeguard",
  waterfront: "waterfront_monitor",
  equipment: "equipment_operator",
  food_service: "food_safety",
});

function clean(value) {
  return String(value ?? "").trim();
}
export function shiftUuid(value, label = "ID") {
  const id = clean(value);
  if (!uuidPattern.test(id)) throw new Error(label + " must be a UUID.");
  return id.toLowerCase();
}
function bounded(value, label, min, max) {
  const result = clean(value);
  if (result.length < min || result.length > max)
    throw new Error(label + " must be " + min + "–" + max + " characters.");
  return result;
}
export function shiftTimestamp(value, label) {
  const input = clean(value);
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(input)
    ? input + ":00Z"
    : input;
  const parsed = new Date(normalized);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/u.test(
      normalized,
    ) ||
    !Number.isFinite(parsed.getTime())
  )
    throw new Error(label + " must be a valid UTC timestamp.");
  return parsed.toISOString();
}
function interval(startsAt, endsAt, maximumHours, minimumMinutes) {
  const start = shiftTimestamp(startsAt, "Start");
  const end = shiftTimestamp(endsAt, "End");
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (
    duration < minimumMinutes * 60_000 ||
    duration > maximumHours * 3_600_000
  ) {
    throw new Error(
      "Interval must be " +
        minimumMinutes +
        " minutes to " +
        maximumHours +
        " hours.",
    );
  }
  return { startsAt: start, endsAt: end };
}
export function normalizeShiftPlan(input) {
  const department = clean(input?.department);
  if (!shiftDepartments.includes(department))
    throw new Error("Shift department is invalid.");
  return {
    id: shiftUuid(input?.id, "Shift ID"),
    staffUserId: shiftUuid(input?.staffUserId, "Staff ID"),
    department,
    roleLabel: bounded(input?.roleLabel, "Role", 3, 100),
    assignmentNote: bounded(input?.assignmentNote, "Assignment note", 12, 1000),
    ...interval(input?.startsAt, input?.endsAt, 16, 30),
  };
}
export function normalizeShiftAvailability(input) {
  const kind = clean(input?.kind);
  if (!["unavailable", "clear"].includes(kind))
    throw new Error("Availability decision is invalid.");
  return {
    id: shiftUuid(input?.id, "Availability event ID"),
    staffUserId: shiftUuid(input?.staffUserId, "Staff ID"),
    kind,
    clearsEventId:
      kind === "clear"
        ? shiftUuid(input?.clearsEventId, "Original unavailability ID")
        : null,
    reason: bounded(input?.reason, "Availability reason", 12, 500),
    ...interval(input?.startsAt, input?.endsAt, 60 * 24, 30),
  };
}
export function normalizeShiftQualification(input) {
  const qualificationKey = clean(input?.qualificationKey);
  const decision = clean(input?.decision);
  if (!shiftQualifications.includes(qualificationKey))
    throw new Error("Qualification type is invalid.");
  if (!["verify", "revoke"].includes(decision))
    throw new Error("Qualification decision is invalid.");
  return {
    id: shiftUuid(input?.id, "Qualification event ID"),
    staffUserId: shiftUuid(input?.staffUserId, "Staff ID"),
    qualificationKey,
    decision,
    sourceReference: bounded(
      input?.sourceReference,
      "Credential reference",
      8,
      300,
    ),
    validUntil:
      decision === "verify"
        ? shiftTimestamp(input?.validUntil, "Expiry")
        : null,
    reviewNote: bounded(input?.reviewNote, "Independent review note", 20, 800),
  };
}
export function normalizeShiftHandoff(input) {
  return {
    id: shiftUuid(input?.id, "Handoff ID"),
    fromShiftId: shiftUuid(input?.fromShiftId, "Source shift ID"),
    toShiftId: clean(input?.toShiftId)
      ? shiftUuid(input.toShiftId, "Receiving shift ID")
      : null,
    summary: bounded(input?.summary, "Handoff summary", 20, 1500),
    outstandingWork: bounded(
      input?.outstandingWork,
      "Outstanding work",
      20,
      1500,
    ),
    followUpRequired:
      input?.followUpRequired === true || input?.followUpRequired === "true",
  };
}
export function normalizeShiftEvent(input) {
  const kind = clean(input?.kind);
  if (!["cancel", "handoff_ack"].includes(kind))
    throw new Error("Shift event is invalid.");
  return {
    id: shiftUuid(input?.id, "Shift event ID"),
    shiftId: shiftUuid(input?.shiftId, "Shift ID"),
    handoffId:
      kind === "handoff_ack" ? shiftUuid(input?.handoffId, "Handoff ID") : null,
    kind,
    reason: bounded(input?.reason, "Decision evidence", 20, 600),
  };
}

export function assessShiftReadiness(
  shift,
  shifts,
  latestQualifications,
  availability,
  now = new Date(),
) {
  const start = new Date(shift.startsAt).getTime();
  const end = new Date(shift.endsAt).getTime();
  const required = sensitiveDepartmentQualifications[shift.department] ?? null;
  const qualification = required
    ? latestQualifications.find(
        (row) =>
          row.staffUserId === shift.staffUserId &&
          row.qualificationKey === required,
      )
    : null;
  const certified =
    !required ||
    (qualification?.decision === "verify" &&
      new Date(qualification.validUntil).getTime() >= end);
  const blockedByAvailability = availability.some(
    (row) =>
      row.staffUserId === shift.staffUserId &&
      new Date(row.startsAt).getTime() < end &&
      new Date(row.endsAt).getTime() > start,
  );
  const active = shifts.filter(
    (row) =>
      row.staffUserId === shift.staffUserId &&
      !row.cancelled &&
      row.id !== shift.id,
  );
  const tightRest = active.some((row) => {
    const otherStart = new Date(row.startsAt).getTime();
    const otherEnd = new Date(row.endsAt).getTime();
    const gap = Math.min(
      Math.abs(start - otherEnd),
      Math.abs(otherStart - end),
    );
    return gap < 8 * 3_600_000 && (otherEnd <= start || end <= otherStart);
  });
  const weekStart = start - 7 * 24 * 3_600_000;
  const weeklyHours = active
    .filter(
      (row) =>
        new Date(row.startsAt).getTime() >= weekStart &&
        new Date(row.startsAt).getTime() <= start,
    )
    .reduce(
      (hours, row) =>
        hours +
        (new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime()) /
          3_600_000,
      (end - start) / 3_600_000,
    );
  const flags = [];
  if (shift.cancelled) flags.push("cancelled");
  if (!certified) flags.push("qualification_missing_or_expired");
  if (blockedByAvailability) flags.push("availability_conflict");
  if (end - start > 10 * 3_600_000) flags.push("long_shift");
  if (tightRest) flags.push("short_rest_window");
  if (weeklyHours > 40) flags.push("over_40_hour_window");
  if (start < now.getTime() && end > now.getTime())
    flags.push("in_progress_time_window");
  return {
    flags,
    requiredQualification: required,
    weeklyHours: Math.round(weeklyHours * 10) / 10,
    ready: !flags.some((flag) =>
      [
        "cancelled",
        "qualification_missing_or_expired",
        "availability_conflict",
      ].includes(flag),
    ),
  };
}
