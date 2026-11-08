import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildStaffAmenityStatusBoard,
  normalizeAmenityStatusFilters,
} from "../lib/amenity-status/board.mjs";

const source = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const facilities = [
  {
    id: "facility-one",
    assetClass: "facility",
    lifecycleState: "active",
    displayName: "Main Washrooms",
    code: "WR-1",
    mapObjectId: "point-one",
    operatingState: "unavailable",
    rowVersion: 9,
    sectionName: "North",
    facility: { facilityType: "washroom" },
  },
  {
    id: "facility-two",
    assetClass: "facility",
    lifecycleState: "active",
    displayName: "Recreation Hall",
    code: "HAL-1",
    mapObjectId: "point-two",
    operatingState: "operational",
    rowVersion: 3,
    facility: { facilityType: "hall" },
  },
  {
    id: "tractor",
    assetClass: "equipment",
    lifecycleState: "active",
    displayName: "Tractor",
    code: "T-1",
    mapObjectId: null,
    operatingState: "operational",
    rowVersion: 1,
  },
];
const workOrders = [
  {
    id: "order-1",
    assetId: "facility-one",
    title: "Plumbing leak",
    status: "blocked",
    priorityKey: "urgent",
    isPastCompletionTarget: true,
    description: "internal secret never shown",
  },
  {
    id: "order-2",
    assetId: "facility-two",
    title: "Old completed issue",
    status: "completed",
    priorityKey: "normal",
  },
];
const publications = [
  {
    mapObjectId: "point-one",
    code: "WR-1",
    kind: "washroom",
    name: "Main Washrooms",
    locationPublished: true,
    service: {
      isPublished: true,
      operatingStatus: "reported_open",
      hoursSummary: "8–8",
      accessibilityDetails: "Level entrance",
      reviewedAt: "2026-10-31T09:00:00Z",
    },
  },
  {
    mapObjectId: "point-two",
    code: "HAL-1",
    kind: "building",
    name: "Recreation Hall",
    locationPublished: true,
    service: { isPublished: false },
  },
  {
    mapObjectId: "point-three",
    code: "DOCK-1",
    kind: "dock",
    name: "Lake Dock",
    locationPublished: true,
    service: { isPublished: false },
  },
];

const board = (filters) =>
  buildStaffAmenityStatusBoard({
    assets: facilities,
    workOrders,
    publications,
    filters,
  });

test("Build 229 combines only facility assets, active maintenance and published locations", () => {
  const model = board();
  assert.equal(model.counts.total, 3);
  assert.equal(model.counts.attention, 1);
  assert.equal(model.counts.maintenance, 1);
  assert.equal(model.counts.guestReview, 3);
  const washroom = model.items.find((item) => item.id === "facility-one");
  assert.equal(washroom.orders.length, 1);
  assert.equal(washroom.orders[0].overdue, true);
  assert.equal(washroom.orders[0].description, undefined);
  assert.equal(washroom.conflicting, true);
  assert.equal(
    model.items.some((item) => item.id === "tractor"),
    false,
  );
  assert.equal(
    model.items.find((item) => item.id === "point-three").hasAsset,
    false,
  );
});

test("Build 229 filter inputs are bounded and cannot hide mismatches from counts", () => {
  assert.deepEqual(normalizeAmenityStatusFilters({ filter: "danger" }), {
    filter: "all",
    query: "",
  });
  assert.equal(
    normalizeAmenityStatusFilters({ query: "x".repeat(100) }).query.length,
    80,
  );
  assert.deepEqual(
    board({ filter: "attention" }).items.map((item) => item.id),
    ["facility-one"],
  );
  assert.deepEqual(
    board({ filter: "maintenance" }).items.map((item) => item.id),
    ["facility-one"],
  );
  assert.equal(
    board({ filter: "guest_review", query: "dock" }).items.length,
    1,
  );
  assert.equal(board({ query: "nothing" }).counts.total, 3);
});

test("Build 229 does not invent a guest closure or open state from internal records", () => {
  const model = buildStaffAmenityStatusBoard({
    assets: facilities,
    workOrders,
  });
  const washroom = model.items.find((item) => item.id === "facility-one");
  assert.equal(washroom.publication, null);
  assert.equal(washroom.conflicting, false);
  assert.equal(washroom.needsGuestReview, false);
});

test("Build 229 staff publication query is permission-gated, campground-scoped and public-only", () => {
  const repository = source("lib/amenity-status/postgres.mjs");
  assert.match(
    repository,
    /hasCampgroundPermission\(userId, campgroundId, key\)/,
  );
  assert.match(repository, /if \(!allowed\.some\(Boolean\)\)/);
  assert.match(repository, /"maintenance\.read"/);
  assert.match(
    repository,
    /where a\.campground_id=\$1 and a\.asset_class='facility'/,
  );
  assert.match(repository, /where w\.campground_id=\$1/);
  assert.match(repository, /w\.is_published and b\.geometry_kind='point'/);
  assert.match(repository, /l\.is_enabled and v\.is_published/);
  assert.match(repository, /if \(!exists\.rows\[0\]\?\.ready\)/);
  assert.match(
    repository,
    /row\.service_is_published \? row\.service_hours_summary : ""/,
  );
  assert.match(repository, /set local role icamp_app/);
  assert.match(repository, /and w\.asset_id is not null/);
  assert.doesNotMatch(
    repository,
    /maintenance_work_order_notes|maintenance_work_order_media/,
  );
});

test("Build 229 updates only authorized real facilities with audit-backed version checks", () => {
  const action = source(
    "app/workspaces/management/campgrounds/amenity-status/actions.ts",
  );
  assert.match(action, /requireCampgroundPermission\(/);
  assert.match(action, /"asset\.manage"/);
  assert.match(action, /target\.assetClass !== "facility"/);
  assert.match(action, /Number\.isSafeInteger\(expectedRowVersion\)/);
  assert.match(action, /transitionOperationalAssetStatus\(/);
  assert.match(action, /revalidatePath\(path\)/);
  assert.match(action, /reason\.length > 500/);
});

test("Build 229 protects role-specific maintenance and review actions in the staff page", () => {
  const page = source(
    "app/workspaces/management/campgrounds/amenity-status/page.tsx",
  );
  assert.match(page, /requireStaff\(path\)/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /\.\.\.maintenanceAccess/);
  assert.match(page, /mayReadMaintenance\s*\?/);
  assert.match(page, /mayManageAsset && item\.hasAsset/);
  assert.match(page, /mayPublish\s*\?/);
  assert.match(page, /Guest information has\s+not changed/i);
  assert.match(page, /migration 0216/i);
});
