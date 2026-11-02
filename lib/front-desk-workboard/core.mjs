const VALID_VIEWS = new Set([
  "all",
  "arrivals",
  "departures",
  "exceptions",
  "holds",
]);
const VALID_SORTS = new Set(["urgency", "date", "accommodation"]);

export function normalizeDeskFilters(input = {}) {
  const view = String(input.view ?? "all");
  const sort = String(input.sort ?? "urgency");
  return {
    view: VALID_VIEWS.has(view) ? view : "all",
    sort: VALID_SORTS.has(sort) ? sort : "urgency",
    query: String(input.query ?? "")
      .trim()
      .slice(0, 80)
      .toLocaleLowerCase(),
  };
}

export function sourceCoverage(shown, total) {
  return { shown, total, complete: shown === total };
}

function linkedFlags(
  row,
  { visitorByReservation, maintenanceBySite, turnoverBySite, permissions },
) {
  const flags = [];
  const plan = row.plan;
  if (row.status === "pending")
    flags.push({ label: "Pending confirmation", severity: 2 });
  if (row.direction === "arrival" && row.status !== "checked_in") {
    if (plan?.state === "submitted") {
      if (!plan.reviewCurrent || plan.reviewOutcome === "follow_up_needed") {
        flags.push({ label: "Pre-registration review/follow-up", severity: 2 });
      }
      if (plan.assistanceRequested)
        flags.push({
          label: "Guest requested arrival assistance",
          severity: 2,
        });
    } else {
      flags.push({ label: "No submitted pre-registration", severity: 1 });
    }
  }
  if (permissions.finance && row.finance) {
    if (row.finance.financialReviewRequired)
      flags.push({ label: "Financial review status", severity: 3 });
    if (row.finance.outstandingBalanceCents > 0)
      flags.push({ label: "Outstanding payment status", severity: 2 });
  }
  const visitor = permissions.visitors
    ? visitorByReservation.get(row.id)
    : null;
  if (visitor?.issueCount) {
    flags.push({
      label: `${visitor.issueCount} visitor payment/registration exception${visitor.issueCount === 1 ? "" : "s"}`,
      severity: 2,
    });
  }
  const maintenance = permissions.maintenance
    ? maintenanceBySite.get(row.accommodationId)
    : null;
  if (maintenance?.openCount) {
    flags.push({
      label: `${maintenance.openCount} open site work order${maintenance.openCount === 1 ? "" : "s"}${maintenance.blockedCount ? ` (${maintenance.blockedCount} blocked)` : ""}`,
      severity: maintenance.blockedCount ? 3 : 2,
    });
  }
  const turnover = permissions.housekeeping
    ? turnoverBySite.get(row.accommodationId)
    : null;
  if (turnover?.openCount) {
    flags.push({
      label: `${turnover.openCount} unfinished cottage turnover${turnover.openCount === 1 ? "" : "s"}`,
      severity: 3,
    });
  }
  return flags;
}

function priority(row) {
  return row.flags.reduce((n, flag) => Math.max(n, flag.severity), 0);
}

export function buildDeskQueues({
  reservations = [],
  holds = [],
  visitors = [],
  maintenance = [],
  turnovers = [],
  permissions,
  filters = {},
}) {
  const normalized = normalizeDeskFilters(filters);
  const visitorByReservation = new Map(
    visitors.map((row) => [row.reservationId, row]),
  );
  const maintenanceBySite = new Map(
    maintenance
      .filter((row) => row.accommodationId)
      .map((row) => [row.accommodationId, row]),
  );
  const turnoverBySite = new Map(
    turnovers.map((row) => [row.accommodationId, row]),
  );
  const rows = [];
  const reservationPrefix = "/workspaces/management/campgrounds/reservations";
  for (const reservation of reservations) {
    for (const direction of ["arrival", "departure"]) {
      const arrival = direction === "arrival";
      if (arrival && !reservation.inArrivalWindow) continue;
      if (!arrival && !reservation.inDepartureWindow) continue;
      const row = {
        ...reservation,
        kind: arrival ? "arrivals" : "departures",
        direction,
        key: `${direction}:${reservation.id}`,
        date: arrival ? reservation.arrivalDate : reservation.departureDate,
        primaryHref: permissions.finance
          ? `${reservationPrefix}/${arrival ? "check-in" : "check-out"}?campground=${encodeURIComponent(reservation.campgroundId)}&reservation=${encodeURIComponent(reservation.id)}`
          : `${reservationPrefix}/${encodeURIComponent(reservation.id)}`,
        secondaryHref: `${reservationPrefix}/${encodeURIComponent(reservation.id)}`,
      };
      row.flags = linkedFlags(row, {
        visitorByReservation,
        maintenanceBySite,
        turnoverBySite,
        permissions,
      });
      rows.push(row);
    }
  }
  if (permissions.holds) {
    for (const hold of holds) {
      rows.push({
        ...hold,
        key: `hold:${hold.id}`,
        kind: "holds",
        direction: "hold",
        date: hold.arrivalDate,
        guestDisplayName: "Temporary hold · no guest reservation",
        flags: [{ label: `Expires ${hold.expiresAt}`, severity: 2 }],
        primaryHref: `/workspaces/management/campgrounds/availability/holds?campground=${encodeURIComponent(hold.campgroundId)}`,
        secondaryHref: null,
      });
    }
  }
  const counts = {
    arrivals: rows.filter((row) => row.kind === "arrivals").length,
    departures: rows.filter((row) => row.kind === "departures").length,
    exceptions: rows.filter(
      (row) =>
        row.kind !== "holds" && row.flags.some((flag) => flag.severity >= 2),
    ).length,
    holds: rows.filter((row) => row.kind === "holds").length,
  };
  const selected = rows.filter((row) => {
    if (
      normalized.view !== "all" &&
      (normalized.view === "exceptions"
        ? row.kind === "holds" || !row.flags.some((flag) => flag.severity >= 2)
        : row.kind !== normalized.view)
    )
      return false;
    if (!normalized.query) return true;
    return [
      row.guestDisplayName,
      row.accommodationCode,
      row.accommodationName,
      row.status,
      row.id,
      ...row.flags.map((flag) => flag.label),
    ].some((text) =>
      String(text ?? "")
        .toLocaleLowerCase()
        .includes(normalized.query),
    );
  });
  selected.sort((a, b) => {
    if (normalized.sort === "urgency") {
      const severity = priority(b) - priority(a);
      if (severity) return severity;
    }
    if (normalized.sort === "accommodation") {
      const site = String(a.accommodationCode).localeCompare(
        String(b.accommodationCode),
      );
      if (site) return site;
    }
    return a.date.localeCompare(b.date) || a.key.localeCompare(b.key);
  });
  return { rows: selected, counts, filters: normalized };
}
