export const holdAgingFilters = [
  "all",
  "overdue",
  "due_week",
  "due_month",
  "later",
  "resolved",
  "continued_hold",
];
export function normalizeHoldAgingFilter(value) {
  const v = String(value ?? "all").trim();
  return holdAgingFilters.includes(v) ? v : "all";
}
export function classifyHoldFollowup(plan, resolution, now = new Date()) {
  if (resolution?.resolution_kind === "independently_resolved")
    return "resolved";
  const ms = new Date(plan.next_due_at).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "overdue";
  if (resolution?.resolution_kind === "continue_hold") return "continued_hold";
  if (ms <= 7 * 86400000) return "due_week";
  if (ms <= 30 * 86400000) return "due_month";
  return "later";
}
export function summarizeHoldAging(
  plans,
  resolutions,
  reviews,
  now = new Date(),
) {
  const resolutionByPlan = new Map(
    resolutions.map((r) => [r.action_plan_id, r]),
  );
  const reviewById = new Map(reviews.map((r) => [r.id, r]));
  const rows = plans.map((plan) => {
    const resolution = resolutionByPlan.get(plan.id) ?? null;
    const stage = classifyHoldFollowup(plan, resolution, now);
    return {
      ...plan,
      stage,
      resolution,
      acceptanceId:
        reviewById.get(plan.exception_review_id)?.acceptance_id ?? null,
    };
  });
  const counts = Object.fromEntries(
    holdAgingFilters
      .slice(1)
      .map((stage) => [stage, rows.filter((r) => r.stage === stage).length]),
  );
  const recurrence = new Map();
  for (const row of rows) {
    if (!row.acceptanceId) continue;
    const group = recurrence.get(row.acceptanceId) ?? {
      acceptanceId: row.acceptanceId,
      plans: 0,
      continuedHolds: 0,
      overdue: 0,
    };
    group.plans++;
    if (row.stage === "continued_hold") group.continuedHolds++;
    if (row.stage === "overdue") group.overdue++;
    recurrence.set(row.acceptanceId, group);
  }
  return {
    rows,
    counts,
    recurrence: [...recurrence.values()]
      .filter((r) => r.plans > 1 || r.continuedHolds > 0)
      .sort((a, b) => b.plans - a.plans),
  };
}
