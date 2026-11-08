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
export const amenityFollowupOutcomes = Object.freeze([
  "needs_publication_review",
  "verified_no_change",
  "needs_more_evidence",
]);

// Internal response targets, not contractual guarantees or emergency dispatch.
const acknowledgementMinutes = Object.freeze({
  urgent: 60,
  important: 240,
  normal: 1440,
});
const followThroughMinutes = Object.freeze({
  urgent: 240,
  important: 1440,
  normal: 4320,
});

export function evaluateHandoffSla(handoff, at = new Date()) {
  const now = new Date(at).valueOf();
  const created = new Date(handoff.createdAt).valueOf();
  if (!Number.isFinite(now) || !Number.isFinite(created)) {
    return {
      state: "unknown",
      phase: "unknown",
      dueAt: null,
      ageMinutes: null,
      remainingMinutes: null,
    };
  }
  const ageMinutes = Math.max(0, Math.floor((now - created) / 60_000));
  if (handoff.status === "closed") {
    return {
      state: "complete",
      phase: "closed",
      dueAt: null,
      ageMinutes,
      remainingMinutes: null,
    };
  }
  const priority = Object.hasOwn(acknowledgementMinutes, handoff.priority)
    ? handoff.priority
    : "normal";
  const needsOwner = handoff.kind === "guest_review";
  const awaitingAck = !needsOwner && handoff.status === "open";
  const phase = needsOwner
    ? "owner_review"
    : awaitingAck
      ? "acknowledgement"
      : "follow_through";
  // Guest owner-review targets never reset on acknowledgement or reassignment.
  // After an acknowledgement, completion targets are anchored to that proof.
  const anchor =
    awaitingAck || needsOwner
      ? created
      : new Date(handoff.acknowledgedAt ?? handoff.createdAt).valueOf();
  if (!Number.isFinite(anchor)) {
    return {
      state: "unknown",
      phase,
      dueAt: null,
      ageMinutes,
      remainingMinutes: null,
    };
  }
  const budget = awaitingAck
    ? acknowledgementMinutes[priority]
    : followThroughMinutes[priority];
  const deadline = anchor + budget * 60_000;
  const remainingMinutes = Math.ceil((deadline - now) / 60_000);
  const warningMinutes = Math.min(60, Math.ceil(budget / 4));
  return {
    state:
      now > deadline
        ? "overdue"
        : remainingMinutes <= warningMinutes
          ? "due_soon"
          : "on_track",
    phase,
    dueAt: new Date(deadline).toISOString(),
    ageMinutes,
    remainingMinutes,
  };
}

export function normalizeHandoffFollowup(input) {
  const eventKind = String(input.eventKind ?? "").trim();
  if (!["escalation", "guest_followup"].includes(eventKind)) {
    throw new Error("Follow-up type is invalid.");
  }
  const expectedRowVersion = Number(input.expectedRowVersion);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) {
    throw new Error("Refresh the handoff before recording follow-up.");
  }
  const outcome = String(input.outcome ?? "").trim();
  if (eventKind === "guest_followup") {
    if (!amenityFollowupOutcomes.includes(outcome))
      throw new Error("Guest review outcome is invalid.");
  } else if (outcome) {
    throw new Error("Escalations cannot claim a guest review outcome.");
  }
  return {
    eventKind,
    outcome: eventKind === "guest_followup" ? outcome : null,
    note: requiredHandoffText(input.note, "Follow-up note"),
    expectedRowVersion,
  };
}

export function canRecordHandoffFollowup({
  eventKind,
  kind,
  status,
  canAssign,
  canComplete,
  canPublish,
}) {
  if (status === "closed") return false;
  if (eventKind === "escalation")
    return canAssign === true || canComplete === true;
  if (eventKind === "guest_followup")
    return kind === "guest_review" && canPublish === true;
  return false;
}

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
