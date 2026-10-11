import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 021 editor exposes history, move and precision selection aids", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );

  assert.match(viewer, /Undo/u);
  assert.match(viewer, /Redo/u);
  assert.match(viewer, /nudgeSelection/u);
  assert.match(viewer, /Whole polygon/u);
  assert.match(viewer, /Previous vertex/u);
  assert.match(viewer, /Next vertex/u);
  assert.match(viewer, /0\.25 px/u);
  assert.match(viewer, /snapSelection/u);
  assert.match(viewer, /polygonBounds/u);
  assert.match(viewer, /Ctrl\/Cmd\+Z/u);
});

test("Build 021 editor exposes duplicate and lifecycle controls", async () => {
  const viewer = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/coordinate-engine.tsx",
    "utf8",
  );
  assert.match(viewer, /duplicateMapPolygonAction/u);
  assert.match(viewer, /toggleMapPolygonLockAction/u);
  assert.match(viewer, /toggleMapPolygonHiddenAction/u);
  assert.match(viewer, /toggleMapPolygonArchivedAction/u);
  assert.match(viewer, /Duplicate/u);
  assert.match(viewer, /Unlock|Lock/u);
  assert.match(viewer, /Show|Hide/u);
  assert.match(viewer, /Restore|Archive/u);
});

test("Build 021 page and help identify advanced polygon editing", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/coordinate-engine/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");
  assert.match(page, /Build 021/u);
  assert.match(page, /Advanced Polygon Editing/u);
  assert.match(help, /50 geometry steps/u);
  assert.match(help, /Lock prevents geometry and label edits/u);
  assert.match(
    help,
    /Duplicate creates a new active, visible and unlocked polygon/u,
  );
});

test("Build 021 platform decision consumes no new Vercel or Cloudflare project", async () => {
  const decisions = await readFile("docs/PLATFORM_DECISIONS.md", "utf8");
  const build = await readFile("docs/BUILD_021.md", "utf8");
  assert.match(
    decisions,
    /Do not create another Vercel or Cloudflare application project/u,
  );
  assert.match(decisions, /cxgszmpbeswdikzofvjv/u);
  assert.match(decisions, /Vercel Hobby currently permits up to 200 projects/u);
  assert.match(
    decisions,
    /Cloudflare Free currently permits up to 100 Pages projects and 100 Workers/u,
  );
  assert.match(build, /creates no additional Vercel or Cloudflare project/u);
});
