import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 023 database prevents orphan and duplicate object bindings", async () => {
  const migration = await readFile(
    "database/migrations/0025_canonical_map_object_binding.sql",
    "utf8",
  );
  assert.match(migration, /campground_map_objects/u);
  assert.match(migration, /campground_map_object_bindings/u);
  assert.match(migration, /map_object_id uuid not null/u);
  assert.match(migration, /unique \(map_object_id\)/u);
  assert.match(migration, /unique \(polygon_id\)/u);
  assert.match(migration, /foreign key \(organization_id, campground_id, map_object_id\)/u);
  assert.match(migration, /foreign key \(organization_id, campground_id, polygon_id\)/u);
  assert.match(migration, /geometry_kind in \('polygon', 'point'\)/u);
  assert.match(migration, /canonicalize_map_object_binding/u);
});

test("Build 023 service binds polygon and point geometry through one canonical identity", async () => {
  const domain = await readFile("lib/map-objects/postgres.mjs", "utf8");
  assert.match(domain, /createMapObject/u);
  assert.match(domain, /bindMapObjectToPolygon/u);
  assert.match(domain, /bindMapObjectToPoint/u);
  assert.match(domain, /unbindMapObject/u);
  assert.match(domain, /validateStoredMapPoint/u);
  assert.match(domain, /hasCampgroundPermission/u);
  assert.match(domain, /visibility_permission_key/u);
  assert.match(domain, /campground\.map\.object\.bind\.polygon/u);
  assert.match(domain, /campground\.map\.object\.bind\.point/u);
  assert.match(domain, /appendAuditEvent/u);
});

test("Build 023 starts in development while queue remains on Build 023", async () => {
  const build = await readFile("docs/BUILD_023.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  assert.match(build, /IN DEVELOPMENT/u);
  assert.match(
    queue,
    /Next active build[\s\S]*Build 023 — Canonical Map Object Binding[\s\S]*QUEUED — NOT STARTED/u,
  );
});
