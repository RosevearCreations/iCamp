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
  assert.match(
    migration,
    /foreign key \(organization_id, campground_id, map_object_id\)/u,
  );
  assert.match(
    migration,
    /foreign key \(organization_id, campground_id, polygon_id\)/u,
  );
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

test("Build 023 is fully promoted and advances the queue", async () => {
  const build = await readFile("docs/BUILD_023.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(
    queue,
    /Build 023 — Canonical Map Object Binding[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 031 — Management Closures, Holds & Map Publication[\s\S]*QUEUED — NOT STARTED/u,
  );
  assert.match(build, /ec7d01f5b41750b25a4f47b88f5259f34826014b/u);
  assert.match(build, /38157759806/u);
  assert.match(build, /38157759804/u);
  assert.match(build, /38157759805/u);
  assert.match(build, /20261011163857/u);
  assert.match(build, /20261011165829/u);
  assert.match(build, /No manual user action was required/u);
});
