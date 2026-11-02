const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function swimUuid(value, label) {
  if (!idPattern.test(String(value ?? "")))
    throw new Error(`${label} must be a valid UUID.`);
  return value;
}
export function swimText(value, label, minimum = 12, maximum = 2000) {
  const text = String(value ?? "").trim();
  if (text.length < minimum || text.length > maximum)
    throw new Error(`${label} must be ${minimum}–${maximum} characters.`);
  return text;
}
export function swimNumber(value, label, min, max) {
  const number = Number(value);
  if (
    value === "" ||
    value == null ||
    !Number.isInteger(number) ||
    number < min ||
    number > max
  )
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return number;
}
export function normalizePoolPolicy(input) {
  return {
    id: swimUuid(input.id, "Policy ID"),
    assetId: swimUuid(input.assetId, "Pool"),
    ruleVersionId: swimUuid(input.ruleVersionId, "Pool rule version"),
    maximumBathers: swimNumber(
      input.maximumBathers,
      "Maximum bathers",
      1,
      10000,
    ),
    minimumUnaccompaniedAge: swimNumber(
      input.minimumUnaccompaniedAge,
      "Unaccompanied age",
      0,
      25,
    ),
    minimumSupervisorAge: swimNumber(
      input.minimumSupervisorAge,
      "Supervisor age",
      13,
      99,
    ),
    maximumChildrenPerSupervisor: swimNumber(
      input.maximumChildrenPerSupervisor,
      "Children per supervisor",
      1,
      50,
    ),
    minimumLifeguards: swimNumber(input.minimumLifeguards, "Lifeguards", 1, 50),
    safetyInstructions: swimText(
      input.safetyInstructions,
      "Safety instructions",
      30,
    ),
  };
}
export function normalizePoolQualification(input) {
  const decision = String(input.decision ?? "");
  if (!new Set(["verify", "revoke"]).has(decision))
    throw new Error("Invalid credential decision.");
  const expiry =
    decision === "verify" ? new Date(String(input.expiresAt ?? "")) : null;
  if (
    decision === "verify" &&
    (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
  )
    throw new Error("A future credential expiry is required.");
  return {
    id: swimUuid(input.id, "Credential event ID"),
    assetId: swimUuid(input.assetId, "Pool"),
    staffUserId: swimUuid(input.staffUserId, "Staff member"),
    decision,
    credentialReference: swimText(
      input.credentialReference,
      "Credential reference",
      8,
      400,
    ),
    expiresAt: expiry?.toISOString() ?? null,
    decisionNote: swimText(input.decisionNote, "Credential review note"),
  };
}
export function normalizePoolEvent(input) {
  const kind = String(input.kind ?? "");
  if (
    !new Set([
      "admission_check",
      "warning",
      "removal",
      "hold",
      "release_request",
      "release",
    ]).has(kind)
  )
    throw new Error("Unknown swim event.");
  const admission = kind === "admission_check";
  const guest = admission || kind === "warning" || kind === "removal";
  const counts = admission
    ? {
        batherCount: swimNumber(input.batherCount, "Bathers", 0, 10000),
        underageCount: swimNumber(input.underageCount, "Minors", 0, 10000),
        supervisorCount: swimNumber(
          input.supervisorCount,
          "Adult supervisors",
          0,
          10000,
        ),
        lifeguardCount: swimNumber(
          input.lifeguardCount,
          "On-duty lifeguards",
          0,
          10000,
        ),
      }
    : {
        batherCount: null,
        underageCount: null,
        supervisorCount: null,
        lifeguardCount: null,
      };
  if (admission && counts.underageCount > counts.batherCount)
    throw new Error("Minors cannot exceed bathers.");
  if (admission && !new Set(["yes", "no"]).has(String(input.admitted)))
    throw new Error("Record an admission or refusal decision.");
  return {
    id: swimUuid(input.id, "Event ID"),
    assetId: swimUuid(input.assetId, "Pool"),
    policyId: swimUuid(input.policyId, "Policy"),
    kind,
    reservationId: guest
      ? swimUuid(input.reservationId, "Guest reservation")
      : null,
    ...counts,
    admitted: admission ? input.admitted === "yes" : null,
    supervisionAgesVerified: admission
      ? input.supervisionAgesVerified === "yes"
      : null,
    reason: swimText(input.reason, "Observation or decision reason"),
  };
}
