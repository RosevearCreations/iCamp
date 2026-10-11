import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 022 editor renders permission-aware layer controls", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /Map layers/u);
  assert.match(viewer, /visibilityPermissionKey/u);
  assert.match(viewer, /toggleLayerVisibility/u);
  assert.match(viewer, /updateMapLayerAction/u);
  assert.match(viewer, /moveMapLayerAction/u);
  assert.match(viewer, /Move up/u);
  assert.match(viewer, /Move down/u);
});

test("Build 022 editor supports map-facing labels and icon inheritance", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /Map presentation/u);
  assert.match(viewer, /Map label/u);
  assert.match(viewer, /Inherit layer icon/u);
  assert.match(viewer, /mapLabelVisible/u);
  assert.match(viewer, /iconGlyph/u);
  assert.match(viewer, /mapMarker/u);
  assert.match(viewer, /polygonLayerId/u);
});

test("Build 022 page and contextual help expose layer semantics", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");
  assert.match(page, /Build 022/u);
  assert.match(page, /Map Layers, Labels & Icons/u);
  assert.match(page, /helpTopic="campground\.map\.layers"/u);
  assert.match(help, /"campground\.map\.layers"/u);
  assert.match(help, /Layer visibility is enforced on the server/u);
  assert.match(help, /Build 023/u);
});

test("Build 022 keeps external hosting and mapping dependencies out", async () => {
  const build = await readFile("docs/BUILD_022.md", "utf8");
  assert.match(build, /no third-party icon or map service is required/u);
  assert.match(
    build,
    /requires no new Vercel, Cloudflare, mapping, icon or GIS provider/u,
  );
});
