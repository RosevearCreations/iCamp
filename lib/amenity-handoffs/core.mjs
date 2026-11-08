export const amenityHandoffKinds = Object.freeze([
  "shift_handoff",
  "guest_review",
]);
export const amenityHandoffPriorities = Object.freeze([
  "normal",
  "important",
  "urgent",
]);
export const amenityHandoffStatuses = Object.freeze([
  "open",
  "acknowledged",
  "closed",
]);

export function requiredHandoffText(value, label) {
  const text = String(value ?? "").trim();
  if (
    text.length < 8 ||
    text.length > 500 ||
    /[\u0000-\u0008\u000B-\u001F\u007F]/u.test(text)
  ) {
    throw new Error(`${label} must be 8–500 readable characters.`);
  }
  return text;
}

export function normalizeHandoffCreate(input) {
  const kind = String(input.kind ?? "").trim();
  const priority = String(input.priority ?? "normal").trim();
  if (!amenityHandoffKinds.includes(kind))
    throw new Error("Handoff type is invalid.");
  if (!amenityHandoffPriorities.includes(priority))
    throw new Error("Handoff priority is invalid.");
  return {
    kind,
    priority,
    summary: requiredHandoffText(input.summary, "Handoff summary"),
    nextAction: requiredHandoffText(input.nextAction, "Next action"),
  };
}

export function normalizeHandoffDecision(input) {
  const action = String(input.action ?? "").trim();
  if (!["assign", "acknowledge", "close"].includes(action)) {
    throw new Error("Handoff action is invalid.");
  }
  const expectedRowVersion = Number(input.expectedRowVersion);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) {
    throw new Error("Refresh the handoff before making changes.");
  }
  const resolutionNote =
    action === "close"
      ? requiredHandoffText(input.resolutionNote, "Resolution decision")
      : "";
  return { action, expectedRowVersion, resolutionNote };
}

export function handoffActorCanAct({
  action,
  kind,
  status,
  actorId,
  assignedToUserId,
  canAssign,
  canComplete,
  canPublish,
}) {
  if (status === "closed") return false;
  if (action === "assign") return canAssign === true;
  if (action === "acknowledge") {
    return (
      status === "open" &&
      (canAssign === true || (Boolean(actorId) && actorId === assignedToUserId))
    );
  }
  if (action === "close") {
    if (kind === "guest_review") return canPublish === true;
    return canComplete === true;
  }
  return false;
}
