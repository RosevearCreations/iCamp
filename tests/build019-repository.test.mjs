import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 019 exposes one canonical transform for image overlays and hit testing", async () => {
  const engine = await readFile("lib/map-coordinates/transform.mjs", "utf8");
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );

  assert.match(engine, /createMapViewportTransform/u);
  assert.match(engine, /invertAffineMatrix/u);
  assert.match(engine, /viewportPointToImage/u);
  assert.match(engine, /deviceMatrix/u);
  assert.match(viewer, /affineMatrixToCss/u);
  assert.match(viewer, /affineMatrixToSvg/u);
  assert.match(viewer, /viewportPointToNormalized/u);
});

test("Build 019 defines the dual original-image and normalized storage contract", async () => {
  const engine = await readFile("lib/map-coordinates/transform.mjs", "utf8");
  const docs = await readFile("docs/MAP_COORDINATE_ENGINE.md", "utf8");

  assert.match(engine, /createStoredMapPoint/u);
  assert.match(engine, /schemaVersion/u);
  assert.match(engine, /normalized/u);
  assert.match(docs, /original-image pixels/iu);
  assert.match(docs, /normalized 0–1/iu);
  assert.match(docs, /Build 020/u);
});

test("Build 019 management surface is permission checked and fully helped", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/page.tsx",
    "utf8",
  );
  const library = await readFile(
    "app/workspaces/management/campgrounds/maps/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(page, /requireAnyCampgroundPermission\("campground\.map"/u);
  assert.match(page, /helpTopic="campground\.map\.coordinates"/u);
  assert.match(page, /helpTopic="admin\.refresh"/u);
  assert.match(library, /Open coordinate engine/u);
  assert.match(help, /"campground\.map\.coordinates"/u);
});

test("Build 019 preserves polygon creation for Build 020", async () => {
  const build = await readFile("docs/BUILD_019.md", "utf8");
  const roadmap = await readFile("docs/BUILD_ROADMAP.md", "utf8");

  assert.match(build, /does not create or persist polygons/u);
  assert.match(
    roadmap,
    /Build 020 — Polygon Plotter Core[\s\S]*Click-to-create irregular polygons/u,
  );
});

test("Build 019 source of truth records production promotion and queue advance", async () => {
  const build = await readFile("docs/BUILD_019.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /28492a56fc6846e55db8117910096a2029e78205/u);
  assert.match(build, /37998058186/u);
  assert.match(build, /No manual action was required to promote Build 019/u);
  assert.match(
    queue,
    /Build 019 — Zoom\/Pan Coordinate Engine[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 022 — Map Layers, Labels & Icons[\s\S]*QUEUED — NOT STARTED/u,
  );
});
