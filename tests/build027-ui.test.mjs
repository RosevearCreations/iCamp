import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 027 extends the visible Accommodation assembly", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/accommodations/page.tsx",
    "utf8",
  );
  const panel = await readFile(
    "app/workspaces/management/campgrounds/accommodations/housekeeping-panel.tsx",
    "utf8",
  );
  const styles = await readFile(
    "app/workspaces/management/campgrounds/accommodations/accommodation-admin.module.css",
    "utf8",
  );

  assert.match(page, /Accommodation assembly/u);
  assert.match(page, /Build 024/u);
  assert.match(page, /Build 025/u);
  assert.match(page, /Build 026/u);
  assert.match(page, /Build 027/u);
  assert.match(page, /HousekeepingPanel/u);
  assert.match(page, /listCottageHousekeeping/u);

  assert.match(panel, /Cottage turnover & housekeeping/u);
  assert.match(panel, /Create turnover template/u);
  assert.match(panel, /Inventory checklist/u);
  assert.match(panel, /Start turnover from template/u);
  assert.match(panel, /Record readiness inspection/u);
  assert.match(panel, /recordCottageTurnoverItemCheckAction/u);
  assert.match(panel, /recordCottageDamageInspectionAction/u);

  assert.match(styles, /housekeepingPanel/u);
  assert.match(styles, /turnoverCard/u);
  assert.match(styles, /inspectionForm/u);
});
