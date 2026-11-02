import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 023 editor exposes canonical object inspector and bind controls", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /Object inspector/u);
  assert.match(viewer, /Canonical object/u);
  assert.match(viewer, /Bind to selected polygon/u);
  assert.match(viewer, /Bind point at pointer/u);
  assert.match(viewer, /Unbind object/u);
  assert.match(viewer, /createStoredMapPoint/u);
  assert.match(viewer, /mapObjectKinds/u);
});

test("Build 023 renders canonical point bindings in the same SVG transform", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /geometryKind !== "point"/u);
  assert.match(viewer, /binding\.pointGeometry/u);
  assert.match(viewer, /selectedObjectPoint/u);
  assert.match(viewer, /visibleLayerSet\.has\(binding\.layerId\)/u);
});

test("Build 023 page and help explain canonical identity boundaries", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");
  assert.match(page, /Build 023/u);
  assert.match(page, /Canonical Map Object Binding/u);
  assert.match(page, /helpTopic="campground\.map\.objects"/u);
  assert.match(help, /"campground\.map\.objects"/u);
  assert.match(help, /Builds 024–030/u);
});
