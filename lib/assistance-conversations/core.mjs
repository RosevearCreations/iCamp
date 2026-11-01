const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function normalizeAssistanceReply(input = {}) {
  const clientMessageId = String(input.clientMessageId ?? "")
    .trim()
    .toLowerCase();
  const message = String(input.message ?? "").trim();
  if (!UUID.test(clientMessageId)) {
    throw new Error("A valid reply idempotency key is required.");
  }
  if (
    message.length < 3 ||
    message.length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)
  ) {
    throw new Error("Reply must be 3 to 2000 readable characters.");
  }
  return { clientMessageId, message };
}

export function guestAssistanceProgress({ request, update }) {
  const caseState = update?.caseState ?? "submitted";
  const urgent = (update?.severity ?? request.severity) === "urgent";
  const escalation = update?.escalationLevel ?? "none";
  const closed = caseState === "closed";
  return {
    caseState,
    urgent,
    escalation,
    closed,
    assignment: update
      ? update.assigned
        ? "Assigned to campground staff"
        : "Not yet assigned"
      : "Awaiting staff intake",
    canReply: Boolean(update) && !closed,
    events: [
      {
        id: `submitted-${request.id}`,
        eventKind: "submitted",
        summary: request.summary,
        occurredAt: request.submittedAt,
        actor: "You",
      },
      ...(update?.updates ?? []).map((item) => ({
        ...item,
        actor:
          item.eventKind === "guest_reply"
            ? "You"
            : item.eventKind === "guest_message"
              ? "Campground team"
              : "Campground progress",
      })),
    ].sort((a, b) => (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "")),
  };
}
