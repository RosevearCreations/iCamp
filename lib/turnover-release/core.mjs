const VIEWS = new Set(["all", "ready", "blocked", "released"]);
const KINDS = new Set(["all", "cottage", "campsite"]);

export function normalizeReleaseFilters(input = {}) {
  const view = String(input.view ?? "all");
  const kind = String(input.kind ?? "all");
  return {
    view: VIEWS.has(view) ? view : "all",
    kind: KINDS.has(kind) ? kind : "all",
    query: String(input.query ?? "")
      .trim()
      .slice(0, 80)
      .toLocaleLowerCase(),
  };
}

export function evaluateTurnoverRelease(item) {
  const isCottage = item.kind === "cottage";
  if (!isCottage && item.kind !== "campsite")
    throw new Error("Unknown turnover source.");
  const alreadyReleased = isCottage
    ? Boolean(item.releasedAt) ||
      (!item.releaseRequired && item.status === "ready")
    : Boolean(item.clearedAt);
  if (alreadyReleased) {
    return {
      status: "released",
      blockers: [],
      restoresAvailability: false,
      recordOnly: true,
    };
  }

  const blockers = [];
  if (isCottage) {
    if (item.status === "cancelled") blockers.push("Turnover cancelled");
    if (!item.finalInspectionTemplateId)
      blockers.push("Final cottage inspection template not configured");
    if (item.requiredItems !== item.checkedRequiredItems)
      blockers.push("Required inventory checklist unfinished");
    if (item.checklistIssues > 0)
      blockers.push(
        `${item.checklistIssues} unresolved housekeeping checklist issue(s)`,
      );
    if (
      item.housekeepingInspectionResult !== "pass" ||
      !item.linenComplete ||
      !item.housekeepingComplete ||
      !item.inventoryComplete ||
      item.damageFound ||
      item.securityIssueFound
    )
      blockers.push("Housekeeping, linen, inventory or damage check not clear");
  } else if (!item.programId) {
    blockers.push("Campsite cleanup program not configured");
  }

  if (item.inspectionStatus !== "signed_off")
    blockers.push("Canonical final inspection not signed off");
  if (item.openCorrectiveWorkOrders > 0)
    blockers.push(
      `${item.openCorrectiveWorkOrders} inspection corrective work order(s) open`,
    );
  if (item.openSiteWorkOrders > 0)
    blockers.push(
      `${item.openSiteWorkOrders} accommodation maintenance work order(s) open`,
    );

  const ready = blockers.length === 0;
  const restoresAvailability =
    ready &&
    item.accommodationStatusState === "inspection" &&
    (isCottage || item.blockRebookingUntilClear);
  return {
    status: ready ? "ready" : "blocked",
    blockers,
    restoresAvailability,
    recordOnly: !restoresAvailability,
  };
}

export function buildTurnoverReleaseBoard({
  cottages = [],
  campsites = [],
  filters = {},
}) {
  const normalized = normalizeReleaseFilters(filters);
  const rows = [
    ...cottages
      .filter((source) => source.status !== "cancelled")
      .map((source) => ({
        ...source,
        kind: "cottage",
        code: source.cottageCode,
        name: source.cottageName,
        sourceHref: "/workspaces/maintenance/cottage-turnover",
      })),
    ...campsites.map((source) => ({
      ...source,
      kind: "campsite",
      code: source.campsiteCode,
      name: source.campsiteName,
      sourceHref: "/workspaces/maintenance/departure-cleanup",
    })),
  ].map((row) => ({ ...row, release: evaluateTurnoverRelease(row) }));
  const counts = {
    total: rows.length,
    ready: rows.filter((row) => row.release.status === "ready").length,
    blocked: rows.filter((row) => row.release.status === "blocked").length,
    released: rows.filter((row) => row.release.status === "released").length,
  };
  const filtered = rows.filter((row) => {
    if (normalized.view !== "all" && row.release.status !== normalized.view)
      return false;
    if (normalized.kind !== "all" && row.kind !== normalized.kind) return false;
    if (!normalized.query) return true;
    return [
      row.code,
      row.name,
      row.accommodationStatusState,
      row.id,
      ...row.release.blockers,
    ].some((value) =>
      String(value ?? "")
        .toLocaleLowerCase()
        .includes(normalized.query),
    );
  });
  const order = { ready: 0, blocked: 1, released: 2 };
  filtered.sort(
    (a, b) =>
      order[a.release.status] - order[b.release.status] ||
      a.code.localeCompare(b.code) ||
      a.id.localeCompare(b.id),
  );
  return { rows: filtered, counts, filters: normalized };
}
