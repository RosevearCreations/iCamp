import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 021 adds persistent polygon lifecycle and duplicate provenance", async () => {
  const migration = await readFile(
    "database/migrations/0023_advanced_polygon_editing.sql",
    "utf8",
  );
  assert.match(
    migration,
    /add column is_locked boolean not null default false/u,
  );
  assert.match(
    migration,
    /add column is_hidden boolean not null default false/u,
  );
  assert.match(migration, /archived_at timestamptz/u);
  assert.match(migration, /duplicated_from_polygon_id/u);
  assert.match(migration, /campground_map_polygons_active_visibility_idx/u);
});

test("Build 021 server operations enforce locks, archives and audit state changes", async () => {
  const postgres = await readFile("lib/map-polygons/postgres.mjs", "utf8");
  const actions = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/actions.ts",
    "utf8",
  );

  assert.match(postgres, /Locked polygons must be unlocked before editing/u);
  assert.match(postgres, /Archived polygons must be restored before editing/u);
  assert.match(postgres, /duplicateMapPolygon/u);
  assert.match(postgres, /setMapPolygonState/u);
  assert.match(postgres, /campground\.map\.polygon\.duplicate/u);
  assert.match(postgres, /appendAuditEvent/u);
  assert.match(actions, /toggleMapPolygonLockAction/u);
  assert.match(actions, /toggleMapPolygonHiddenAction/u);
  assert.match(actions, /toggleMapPolygonArchivedAction/u);
});

test("Build 021 geometry supports whole-polygon movement and precision snapping", async () => {
  const geometry = await readFile("lib/map-polygons/geometry.mjs", "utf8");
  assert.match(geometry, /translatePolygon/u);
  assert.match(geometry, /polygonBounds/u);
  assert.match(geometry, /snapMapPoint/u);
});

test("Build 021 is fully promoted and advances the queue", async () => {
  const build = await readFile("docs/BUILD_021.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(
    queue,
    /Build 021 — Advanced Polygon Editing[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 022 — Map Layers, Labels & Icons[\s\S]*QUEUED — NOT STARTED/u,
  );
  assert.match(build, /3f20834949c676c0167b8cb7dd3cb14fec179292/u);
  assert.match(build, /38099351148/u);
  assert.match(build, /20261011004005/u);
  assert.match(build, /No manual user action was required/u);
});
