const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emergencyUuid(value, label) {
  const text = String(value ?? "").trim();
  if (!uuidPattern.test(text))
    throw new Error(`${label} must be a valid UUID.`);
  return text;
}

function boundedText(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return text;
}

const audiences = new Set(["campground", "section", "site", "staff"]);
const severities = new Set(["advisory", "urgent", "evacuation"]);
const decisions = new Set(["approve", "reject", "cancel", "manual_handoff"]);
const methods = new Set([
  "onsite_pa",
  "posted_signs",
  "staff_briefing",
  "door_to_door",
  "other",
]);

export function normalizeEmergencyPlan(input) {
  const audience = String(input.audience ?? "");
  const severity = String(input.severity ?? "");
  if (!audiences.has(audience))
    throw new Error("Select a valid emergency audience.");
  if (!severities.has(severity))
    throw new Error("Select an emergency severity.");
  const sectionId = String(input.sectionId ?? "").trim();
  const accommodationId = String(input.accommodationId ?? "").trim();
  if (audience === "section" && (!sectionId || accommodationId))
    throw new Error("Section notices must target exactly one section.");
  if (audience === "site" && (!accommodationId || sectionId))
    throw new Error("Site notices must target exactly one accommodation.");
  if (
    ["campground", "staff"].includes(audience) &&
    (sectionId || accommodationId)
  )
    throw new Error(
      "Campground and staff notices cannot contain a site or section target.",
    );
  return {
    id: emergencyUuid(input.id, "Notice ID"),
    audience,
    severity,
    sectionId: sectionId ? emergencyUuid(sectionId, "Section") : null,
    accommodationId: accommodationId
      ? emergencyUuid(accommodationId, "Accommodation")
      : null,
    title: boundedText(input.title, "Notice title", 8, 160),
    message: boundedText(input.message, "Audience message", 32, 3000),
    onsiteInstructions: boundedText(
      input.onsiteInstructions,
      "On-site instructions",
      32,
      2000,
    ),
  };
}

export function normalizeEmergencyDecision(input) {
  const kind = String(input.kind ?? "");
  if (!decisions.has(kind))
    throw new Error("Select a valid emergency review action.");
  const method = String(input.method ?? "").trim();
  if (kind === "manual_handoff" && !methods.has(method))
    throw new Error("Choose a manual notice communication method.");
  if (kind !== "manual_handoff" && method)
    throw new Error(
      "Only a manual handoff can include a communication method.",
    );
  const reference = String(input.evidenceReference ?? "").trim();
  if (
    kind === "manual_handoff" &&
    (reference.length < 8 || reference.length > 400)
  )
    throw new Error(
      "Manual handoff requires an 8–400 character evidence reference.",
    );
  if (kind !== "manual_handoff" && reference)
    throw new Error("An evidence reference is only valid for manual handoffs.");
  const boundaryAcknowledged =
    input.boundaryAcknowledged === true || input.boundaryAcknowledged === "yes";
  const onsitePlanChecked =
    input.onsitePlanChecked === true || input.onsitePlanChecked === "yes";
  if (kind === "approve" && (!boundaryAcknowledged || !onsitePlanChecked))
    throw new Error(
      "Approval requires both emergency-services and on-site-plan acknowledgements.",
    );
  return {
    id: emergencyUuid(input.id, "Decision ID"),
    noticeId: emergencyUuid(input.noticeId, "Notice"),
    kind,
    method: kind === "manual_handoff" ? method : null,
    evidenceReference: kind === "manual_handoff" ? reference : null,
    boundaryAcknowledged,
    onsitePlanChecked,
    note: boundedText(input.note, "Audit note", 12, 2000),
  };
}
