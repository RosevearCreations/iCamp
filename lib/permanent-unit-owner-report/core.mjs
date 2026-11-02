const allowedWindows = [7, 30, 90];
export function normalizeWindow(value) {
  const n = Number(value);
  return allowedWindows.includes(n) ? n : 30;
}
export function authorizedOwnerCampgrounds(assignments) {
  return assignments.filter(
    (assignment) =>
      assignment.roleCodes?.includes("owner_admin") &&
      assignment.allowed === true,
  );
}
function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
export function summarizeOwnerPortfolio(campgrounds) {
  return campgrounds.reduce(
    (totals, campground) => {
      for (const key of Object.keys(totals)) {
        if (key === "campgrounds") continue;
        totals[key] += number(campground[key]);
      }
      totals.campgrounds += 1;
      return totals;
    },
    {
      campgrounds: 0,
      currentHolds: 0,
      openTasks: 0,
      overdueTasks: 0,
      recurrentConsents: 0,
      newConsents: 0,
      newHolds: 0,
      clearedHolds: 0,
      createdTasks: 0,
      closedTasks: 0,
      recurrenceReviews: 0,
    },
  );
}
export function aggregateWeeklyActivity(campgrounds, weeks) {
  const grouped = new Map();
  for (const c of campgrounds) {
    for (const week of c.weeks ?? []) {
      const date = String(week.week);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const found = grouped.get(date) ?? {
        week: date,
        consents: 0,
        holds: 0,
        clears: 0,
        createdTasks: 0,
        closedTasks: 0,
      };
      for (const key of [
        "consents",
        "holds",
        "clears",
        "createdTasks",
        "closedTasks",
      ]) {
        found[key] += number(week[key]);
      }
      grouped.set(date, found);
    }
  }
  const permitted = new Set(weeks);
  return [...permitted]
    .sort((a, b) => a.localeCompare(b))
    .map(
      (week) =>
        grouped.get(week) ?? {
          week,
          consents: 0,
          holds: 0,
          clears: 0,
          createdTasks: 0,
          closedTasks: 0,
        },
    );
}
