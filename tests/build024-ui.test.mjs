import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 024 management surface exposes unified inventory and help", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/accommodations/page.tsx",
    "utf8",
  );
  const actions = await readFile(
    "app/workspaces/management/campgrounds/accommodations/actions.ts",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(page, /Build 024/u);
  assert.match(page, /Unified accommodation model/u);
  assert.match(page, /Campsite/u);
  assert.match(page, /Rental cottage/u);
  assert.match(page, /Permanent unit/u);
  assert.match(page, /availabilityHook/u);
  assert.match(page, /statusHook/u);
  assert.match(page, /helpTopic="accommodation\.inventory"/u);
  assert.match(actions, /accommodation\.manage/u);
  assert.match(actions, /createAccommodation/u);
  assert.match(actions, /updateAccommodation/u);
  assert.match(help, /"accommodation\.inventory"/u);
  assert.match(help, /Build 030/u);
});

test("Build 024 is linked from campground management", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/page.tsx",
    "utf8",
  );
  assert.match(page, /Open accommodation inventory/u);
  assert.match(page, /Build 024/u);
});
