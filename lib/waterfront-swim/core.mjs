const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function waterfrontUuid(value, label) {
  if (!uuid.test(String(value ?? "")))
    throw new Error(`${label} must be a valid UUID.`);
  return String(value);
}
export function waterfrontText(value, label, min = 12, max = 2000) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label} must be ${min}–${max} characters.`);
  return result;
}
function integer(value, label, min, max) {
  const result = Number(value);
  if (
    value == null ||
    value === "" ||
    !Number.isInteger(result) ||
    result < min ||
    result > max
  )
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return result;
}
function time(value, label) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? "")))
    throw new Error(`${label} must be HH:MM.`);
  return String(value);
}
export function normalizeWaterfrontZone(input) {
  const zoneCode = String(input.zoneCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{2,31}$/.test(zoneCode))
    throw new Error(
      "Zone code must be 3–32 letters, numbers, dashes or underscores, starting with a letter.",
    );
  const openTime = time(input.openTime, "Opening time");
  const closeTime = time(input.closeTime, "Closing time");
  if (closeTime <= openTime)
    throw new Error("Swimming hours must end later the same day.");
  const days = [
    ...new Set(
      (Array.isArray(input.operatingDays) ? input.operatingDays : []).map((v) =>
        integer(v, "Operating day", 1, 7),
      ),
    ),
  ].sort();
  if (!days.length) throw new Error("Select at least one operating day.");
  return {
    id: waterfrontUuid(input.id, "Zone version ID"),
    assetId: waterfrontUuid(input.assetId, "Waterfront facility"),
    zoneCode,
    zoneName: waterfrontText(input.zoneName, "Zone name", 4, 120),
    boundaryDescription: waterfrontText(
      input.boundaryDescription,
      "Physical zone boundary",
      30,
    ),
    operatingDays: days,
    openTime,
    closeTime,
    maximumSwimmers: integer(
      input.maximumSwimmers,
      "Maximum swimmers",
      1,
      10000,
    ),
    minimumUnaccompaniedAge: integer(
      input.minimumUnaccompaniedAge,
      "Unaccompanied swimming age",
      0,
      25,
    ),
    minimumSupervisorAge: integer(
      input.minimumSupervisorAge,
      "Supervisor age",
      13,
      99,
    ),
    maximumChildrenPerSupervisor: integer(
      input.maximumChildrenPerSupervisor,
      "Children per supervisor",
      1,
      50,
    ),
    ruleVersionId: waterfrontUuid(
      input.ruleVersionId,
      "Waterfront rule version",
    ),
    hazardInstructions: waterfrontText(
      input.hazardInstructions,
      "Waterfront hazard and emergency instructions",
      30,
    ),
  };
}
export function normalizeWaterfrontTraining(input) {
  const decision = String(input.decision ?? "");
  if (!new Set(["verify", "revoke"]).has(decision))
    throw new Error("Invalid training decision.");
  const expiresAt =
    decision === "verify" ? new Date(String(input.expiresAt ?? "")) : null;
  if (
    decision === "verify" &&
    (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())
  )
    throw new Error("Verified waterfront training must expire in the future.");
  return {
    id: waterfrontUuid(input.id, "Training event ID"),
    assetId: waterfrontUuid(input.assetId, "Beach"),
    staffUserId: waterfrontUuid(input.staffUserId, "Staff"),
    decision,
    trainingReference: waterfrontText(
      input.trainingReference,
      "Training reference",
      8,
      400,
    ),
    expiresAt: expiresAt?.toISOString() ?? null,
    note: waterfrontText(input.note, "Training review note"),
  };
}
const eventKinds = new Set([
  "entry_check",
  "warning",
  "removal",
  "incident",
  "closure",
  "reopen_request",
  "reopen",
]);
const hazardTypes = new Set([
  "weather",
  "water_quality",
  "current",
  "wildlife",
  "infrastructure",
  "staffing",
  "other",
]);
export function normalizeWaterfrontEvent(input) {
  const kind = String(input.kind ?? "");
  if (!eventKinds.has(kind)) throw new Error("Unknown waterfront event type.");
  const isEntry = kind === "entry_check";
  const guestRequired = isEntry || kind === "warning" || kind === "removal";
  const usesHazard = kind === "incident" || kind === "closure";
  const hazardType = usesHazard ? String(input.hazardType ?? "") : null;
  if (usesHazard && !hazardTypes.has(hazardType))
    throw new Error("Select a waterfront hazard category.");
  const admission = String(input.admitted ?? "");
  if (isEntry && !new Set(["yes", "no"]).has(admission))
    throw new Error("An admission/refusal decision is required.");
  const hazardLevel = isEntry ? String(input.hazardLevel ?? "") : null;
  if (isEntry && !new Set(["normal", "caution", "unsafe"]).has(hazardLevel))
    throw new Error("Select a real-time observed hazard level.");
  const zoneCode = String(input.zoneCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{2,31}$/.test(zoneCode))
    throw new Error("Invalid swimming zone code.");
  const swimmers = isEntry
    ? integer(input.swimmerCount, "Swimmer count", 0, 10000)
    : null;
  const minors = isEntry
    ? integer(input.underageCount, "Underage count", 0, 10000)
    : null;
  const supervisors = isEntry
    ? integer(input.supervisorCount, "Adult supervisors", 0, 10000)
    : null;
  if (isEntry && minors > swimmers)
    throw new Error("Underage swimmers cannot exceed total swimmers.");
  const ref = String(input.evidenceReference ?? "").trim();
  if (kind === "reopen" && (ref.length < 8 || ref.length > 400))
    throw new Error(
      "Independent reopening requires a source evidence reference (8–400 characters).",
    );
  return {
    id: waterfrontUuid(input.id, "Event ID"),
    assetId: waterfrontUuid(input.assetId, "Beach"),
    zoneCode,
    zoneVersionId: waterfrontUuid(input.zoneVersionId, "Zone version"),
    kind,
    reservationId: guestRequired
      ? waterfrontUuid(input.reservationId, "Reservation")
      : input.reservationId
        ? waterfrontUuid(input.reservationId, "Reservation")
        : null,
    swimmerCount: swimmers,
    underageCount: minors,
    supervisorCount: supervisors,
    agesVerified: isEntry ? input.agesVerified === "yes" : null,
    admitted: isEntry ? admission === "yes" : null,
    hazardType,
    hazardLevel,
    evidenceReference: ref || null,
    note: waterfrontText(input.note, "Waterfront observation or decision"),
  };
}
