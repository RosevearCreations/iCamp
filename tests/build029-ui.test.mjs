import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../app/workspaces/management/campgrounds/assets/page.tsx", import.meta.url),
  "utf8",
);
const campground = await readFile(
  new URL("../app/workspaces/management/campgrounds/page.tsx", import.meta.url),
  "utf8",
);

test("Build 029 exposes one integrated operations workbench", () => {
  assert.match(page, /<h1>Operational assets &amp; equipment<\/h1>/u);
  assert.equal((page.match(/<h1>/gu) ?? []).length, 1);
  assert.match(page, /Asset readiness overview/u);
  assert.match(page, /Facilities, equipment & fleet/u);
  assert.match(page, /Add operational facility/u);
  assert.match(page, /Add equipment or vehicle/u);
  assert.match(page, /Make \/ model/u);
  assert.match(page, /Ownership/u);
  assert.match(page, /Meter reading/u);
  assert.match(page, /Map identity/u);
  assert.match(page, /Build 030 remains authoritative/u);
});

test("campground administration links to the Build 029 workbench", () => {
  assert.match(campground, /Operational assets & equipment/u);
  assert.match(campground, /campgrounds\/assets\?campground=/u);
});
