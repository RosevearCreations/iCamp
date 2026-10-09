import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 020 persists polygons against an exact map image version", async () => {
  const migration = await readFile(
    "database/migrations/0022_polygon_plotter_core.sql",
    "utf8",
  );
  const postgres = await readFile("lib/map-polygons/postgres.mjs", "utf8");

  assert.match(migration, /campground_map_polygons/u);
  assert.match(migration, /map_image_version_id/u);
  assert.match(migration, /jsonb_array_length\(geometry -> 'vertices'\) between 3 and 256/u);
  assert.match(postgres, /validateStoredMapPolygon/u);
  assert.match(postgres, /has_campground_permission/u);
  assert.match(postgres, /row_version/u);
  assert.match(postgres, /appendAuditEvent/u);
});

test("Build 020 exposes click-close and vertex editing controls", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /New polygon/u);
  assert.match(viewer, /Close shape/u);
  assert.match(viewer, /Add vertex/u);
  assert.match(viewer, /Delete vertex/u);
  assert.match(viewer, /startVertexDrag/u);
  assert.match(viewer, /createStoredMapPolygon/u);
  assert.match(viewer, /saveMapPolygonAction/u);
});

test("Build 020 is permission checked, helped and channel honest", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");
  const build = await readFile("docs/BUILD_020.md", "utf8");

  assert.match(page, /requireAnyCampgroundPermission\("campground\.map"/u);
  assert.match(page, /helpTopic="campground\.map\.polygons"/u);
  assert.match(help, /"campground\.map\.polygons"/u);
  assert.match(build, /IVR\/DTMF: graphical-only task/u);
  assert.match(build, /SMS\/MMS: graphical-only task/u);
});

test("Build 020 records free-first portable platform decisions", async () => {
  const decisions = await readFile("docs/PLATFORM_DECISIONS.md", "utf8");
  assert.match(decisions, /Next\.js on Vercel/u);
  assert.match(decisions, /PostgreSQL is canonical/u);
  assert.match(decisions, /Supabase Storage/u);
  assert.match(decisions, /no paid mapping API/u);
  assert.match(decisions, /multi-tenant iCamp application/u);
});

test("Build 020 remains unpromoted until independent gates pass", async () => {
  const build = await readFile("docs/BUILD_020.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /IN DEVELOPMENT/u);
  assert.match(
    queue,
    /Next active build[\s\S]*Build 020 — Polygon Plotter Core[\s\S]*QUEUED — NOT STARTED/u,
  );
});
