import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createStoredMapPoint } from "../lib/map-coordinates/transform.mjs";
import {
  filterPublicWayfinding,
  normalizeWayfindingReview,
  publicWayfindingPoint,
} from "../lib/wayfinding/core.mjs";

const fixture = {
  id: "published-amenity",
  kind: "washroom",
  code: "WR-1",
  name: "North washroom",
  description: "Washrooms near the hall",
  accessibilityNote: "Ask office for current entrance conditions",
  landmarkHint: "Look for the blue building sign",
  pointGeometry: createStoredMapPoint({ x: 200, y: 300 }, 1000, 600),
};

test("Build180 reviewed amenity input is bounded and requires a real description to publish", () => {
  assert.deepEqual(
    normalizeWayfindingReview({
      isPublished: true,
      description: "  Washroom by hall  ",
      accessibilityNote: "  Verify with staff  ",
    }),
    {
      isPublished: true,
      description: "Washroom by hall",
      accessibilityNote: "Verify with staff",
      landmarkHint: "",
    },
  );
  assert.throws(() =>
    normalizeWayfindingReview({ isPublished: true, description: " " }),
  );
  assert.throws(() =>
    normalizeWayfindingReview({ description: "x".repeat(601) }),
  );
  assert.throws(() =>
    normalizeWayfindingReview({ landmarkHint: "unsafe\u0000text" }),
  );
});

test("Build180 map points only materialize safe kinds with consistent source-image coordinates", () => {
  const item = publicWayfindingPoint(fixture, 1000, 600);
  assert.equal(item?.x, 200);
  assert.equal(item?.y, 300);
  assert.equal(item?.accessibilityNote, fixture.accessibilityNote);
  assert.equal(
    publicWayfindingPoint({ ...fixture, kind: "gate" }, 1000, 600),
    null,
  );
  assert.equal(
    publicWayfindingPoint({ ...fixture, description: "" }, 1000, 600),
    null,
  );
  assert.equal(
    publicWayfindingPoint(
      {
        ...fixture,
        pointGeometry: {
          ...fixture.pointGeometry,
          normalized: { x: 0.7, y: 0.8 },
        },
      },
      1000,
      600,
    ),
    null,
  );
});

test("Build180 list searches use the same staff-reviewed public set and safe kind defaults", () => {
  const washroom = publicWayfindingPoint(fixture, 1000, 600);
  const pool = publicWayfindingPoint(
    {
      ...fixture,
      id: "pool",
      kind: "pool",
      code: "PL-1",
      name: "Family pool",
      description: "Outdoor pool",
      accessibilityNote: "",
      landmarkHint: "",
    },
    1000,
    600,
  );
  assert.deepEqual(
    filterPublicWayfinding([washroom, pool], { query: "blue" }).map(
      (item) => item.id,
    ),
    ["published-amenity"],
  );
  assert.deepEqual(
    filterPublicWayfinding([washroom, pool], { kind: "pool" }).map(
      (item) => item.id,
    ),
    ["pool"],
  );
  assert.equal(
    filterPublicWayfinding([washroom, pool], { kind: "gate" }).length,
    2,
  );
});

test("Build180 private publication is opt-in, scoped, version-pinned and blocked from direct data API use", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0190_build180_public_wayfinding_publications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0190_build180_public_wayfinding_publications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /is_published boolean not null default false/u);
  assert.match(migration, /force row level security/u);
  assert.match(
    migration,
    /for all to icamp_app using \(false\) with check \(false\)/u,
  );
  assert.match(
    migration,
    /o\.object_kind in \('pool','washroom','dock','building'\)/u,
  );
  assert.match(migration, /b\.map_image_version_id=new\.map_image_version_id/u);
  assert.match(verify, /campground_wayfinding_publication_guard/u);
  assert.match(verify, /has_table_privilege\('anon'/u);
});

test("Build180 public projection cannot disclose unreviewed or stale map-layer source objects", () => {
  const reader = readFileSync(
    new URL("../lib/public-booking-map/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(reader, /w\.is_published and w\.reviewed_at is not null/u);
  assert.match(reader, /w\.map_image_version_id=\$2/u);
  assert.match(reader, /l\.layer_key='amenities' and l\.is_enabled/u);
  assert.match(reader, /o\.lifecycle_state='active'/u);
  assert.match(reader, /publicWayfindingPoint\(/u);
});

test("Build180 mutations require dual campground authority, enforce revisions and audit publication", () => {
  const server = readFileSync(
    new URL("../lib/wayfinding/postgres.mjs", import.meta.url),
    "utf8",
  );
  const action = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/maps/wayfinding/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(server, /"campground\.configuration"/u);
  assert.match(server, /"campground\.map\.publish"/u);
  assert.match(server, /row_version=\$8/u);
  assert.match(server, /appendAuditEvent/u);
  assert.match(action, /requireCampgroundPermission/u);
  assert.match(action, /revalidatePath\("\/booking\/map"\)/u);
});

test("Build180 map and matched nonvisual list share public amenities and warn about route limitations", () => {
  const map = readFileSync(
    new URL("../app/booking/map/booking-map.tsx", import.meta.url),
    "utf8",
  );
  const editor = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/maps/wayfinding/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(map, /visibleAmenities\.map/u);
  assert.match(map, /id="wayfinding"/u);
  assert.match(map, /aria-pressed/u);
  assert.match(
    map.replace(/\s+/gu, " "),
    /No distances, travel times, step-free paths or gate permissions are inferred/u,
  );
  assert.match(editor, /Publish to the public wayfinding map/u);
});
