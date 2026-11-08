export const amenityStatusFilters = Object.freeze([
  "all",
  "attention",
  "maintenance",
  "guest_review",
]);

export const staffOperatingStates = Object.freeze([
  "unknown",
  "operational",
  "limited",
  "inspection",
  "maintenance",
  "unavailable",
  "seasonal",
  "winterized",
  "closed",
]);

const attentionStates = new Set([
  "limited",
  "inspection",
  "maintenance",
  "unavailable",
  "winterized",
  "closed",
]);
const activeOrderStates = new Set([
  "open",
  "assigned",
  "in_progress",
  "blocked",
]);

export function normalizeAmenityStatusFilters(input = {}) {
  const filter = amenityStatusFilters.includes(input.filter)
    ? input.filter
    : "all";
  const query = String(input.query ?? "")
    .trim()
    .slice(0, 80)
    .toLocaleLowerCase();
  return { filter, query };
}

/** Internal operating states are never treated as live guest-facing assertions. */
export function buildStaffAmenityStatusBoard({
  assets = [],
  workOrders = [],
  publications = [],
  filters = {},
}) {
  const normalized = normalizeAmenityStatusFilters(filters);
  const byMapId = new Map(publications.map((item) => [item.mapObjectId, item]));
  const activeOrders = workOrders.filter(
    (order) => order.assetId && activeOrderStates.has(order.status),
  );
  const ordersByAsset = new Map();
  for (const order of activeOrders) {
    const group = ordersByAsset.get(order.assetId) ?? [];
    group.push({
      id: order.id,
      title: order.title,
      status: order.status,
      priority: order.priorityKey,
      overdue: order.isPastCompletionTarget === true,
    });
    ordersByAsset.set(order.assetId, group);
  }

  const facilityAssets = assets.filter(
    (asset) =>
      asset.assetClass === "facility" && asset.lifecycleState !== "archived",
  );
  const linkedMapIds = new Set(
    facilityAssets.map((asset) => asset.mapObjectId),
  );
  const items = facilityAssets.map((asset) => {
    const publication = byMapId.get(asset.mapObjectId) ?? null;
    const orders = ordersByAsset.get(asset.id) ?? [];
    const operatingState = staffOperatingStates.includes(asset.operatingState)
      ? asset.operatingState
      : "unknown";
    const guestStatus = publication?.service?.operatingStatus ?? "unknown";
    const guestPublished = publication?.service?.isPublished === true;
    const conflicting =
      guestPublished &&
      ((guestStatus === "reported_open" &&
        attentionStates.has(operatingState)) ||
        (guestStatus === "reported_closed" &&
          operatingState === "operational"));
    const needsGuestReview =
      conflicting ||
      (publication?.locationPublished === true &&
        (!guestPublished ||
          (orders.length > 0 && guestStatus === "reported_open")));
    return {
      id: asset.id,
      name: asset.displayName,
      code: asset.code,
      kind: asset.facility?.facilityType ?? asset.mapObjectKind ?? "facility",
      section: asset.sectionName || "Unassigned section",
      operatingState,
      rowVersion: asset.rowVersion,
      orders,
      publication,
      conflicting,
      needsGuestReview,
      hasAsset: true,
      attention: attentionStates.has(operatingState) || orders.length > 0,
    };
  });

  for (const published of publications) {
    if (linkedMapIds.has(published.mapObjectId)) continue;
    items.push({
      id: published.mapObjectId,
      name: published.name,
      code: published.code,
      kind: published.kind,
      section: "Map location only",
      operatingState: "unknown",
      rowVersion: null,
      orders: [],
      publication: published,
      conflicting: false,
      needsGuestReview: !published.service?.isPublished,
      hasAsset: false,
      attention: false,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  const visible = items.filter((item) => {
    if (
      normalized.query &&
      !`${item.name} ${item.code} ${item.kind} ${item.section}`
        .toLocaleLowerCase()
        .includes(normalized.query)
    ) {
      return false;
    }
    if (normalized.filter === "attention") return item.attention;
    if (normalized.filter === "maintenance") return item.orders.length > 0;
    if (normalized.filter === "guest_review") return item.needsGuestReview;
    return true;
  });

  return {
    ...normalized,
    items: visible,
    counts: {
      total: items.length,
      attention: items.filter((item) => item.attention).length,
      maintenance: items.filter((item) => item.orders.length > 0).length,
      guestReview: items.filter((item) => item.needsGuestReview).length,
    },
  };
}
