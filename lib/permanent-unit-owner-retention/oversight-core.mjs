export const oversightWindows = [30, 90, 180];

export function normalizeOversightWindow(value) {
  const window = Number(value);
  return oversightWindows.includes(window) ? window : 90;
}

export function normalizeOversightScope(source, target, allowedIds) {
  const from = String(source ?? "").trim();
  const to = String(target ?? "").trim();
  if (!from && !to) return { source: null, target: null };
  if (!from || !to || from === to)
    throw new Error(
      "Choose two different campgrounds or all authorized pairs.",
    );
  if (!allowedIds.includes(from) || !allowedIds.includes(to))
    throw new Error(
      "Selected campground is not available in your owner scope.",
    );
  return { source: from, target: to };
}

export function classifyExceptionOversight(
  { accepted, outcomeKind, outcomeReviewKind, nextDueAt, actionDueAt },
  now = new Date(),
) {
  if (accepted) return "closed";
  if (outcomeKind === "review_ready")
    return outcomeReviewKind === "needs_followup"
      ? "returned"
      : "review_pending";
  const due = outcomeKind ? nextDueAt : actionDueAt;
  if (due && new Date(due) < now) return "overdue";
  if (outcomeKind === "escalated") return "escalated";
  return "open";
}
