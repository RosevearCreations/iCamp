import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 026 presents one integrated accommodation assembly interface", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/accommodations/page.tsx",
    "utf8",
  );
  const management = await readFile(
    "app/workspaces/management/campgrounds/page.tsx",
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
  assert.match(page, /Rental cottage facilities & occupancy/u);
  assert.match(page, /updateRentalCottageDetailsAction/u);
  assert.match(page, /maxOccupancy/u);
  assert.match(page, /kitchenType/u);
  assert.match(page, /washroomType/u);
  assert.match(page, /heatingType/u);
  assert.match(page, /accessibleWashroom/u);
  assert.match(page, /Save cottage details/u);
  assert.match(management, /Open accommodation assembly/u);
  assert.match(styles, /assemblyRail/u);
  assert.match(styles, /assemblyStep/u);
});
