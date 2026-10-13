import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0042_accommodation_compatibility_engine.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0042_accommodation_compatibility_engine.sql",
    import.meta.url,
  ),
  "utf8",
);
const core = await readFile(
  new URL("../lib/accommodation-compatibility/core.mjs", import.meta.url),
  "utf8",
);
const service = await readFile(
  new URL("../lib/accommodation-compatibility/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/compatibility/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_034.md", import.meta.url),
  "utf8",
);
const queue = await readFile(
  new URL("../docs/BUILD_QUEUE.md", import.meta.url),
  "utf8",
);

test("Build 034 adds protected pet and accessibility compatibility facts", () => {
  assert.match(migration, /accessible_site/u);
  assert.match(migration, /pets_allowed/u);
  assert.match(migration, /max_pets/u);
  assert.match(migration, /bump_compatibility_revision/u);
  assert.match(verify, /anon must not directly read/u);
});

test("Build 034 provides one server-authoritative compatibility engine", () => {
  assert.match(core, /evaluateAccommodationCompatibility/u);
  assert.match(core, /assertCompatibleBookingChoice/u);
  assert.match(core, /ICAMP_ACCOMMODATION_INCOMPATIBLE/u);
  assert.match(service, /evaluateAccommodationCapacity/u);
  assert.match(service, /assertServerCompatibleBookingChoice/u);
});

test("Build 034 covers type, size, utilities, accessibility, pets, occupancy and features", () => {
  for (const token of [
    "campsiteType",
    "maxRvLengthMeters",
    "electricalAmperage",
    "needsWaterAtSite",
    "needsStepFreeAccess",
    "petsAllowed",
    "physicalMaxOccupancy",
    "requiredFeatures",
  ]) {
    assert.match(core, new RegExp(token, "u"));
  }
});

test("Build 034 exposes visible management preview and policy controls", () => {
  assert.match(page, /Accommodation compatibility engine/u);
  assert.match(page, /Evaluate a proposed booking choice/u);
  assert.match(page, /Save compatibility policy/u);
});

test("Build 034 records production closeout and queues Build 035", () => {
  assert.match(build, /Build 035/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /production PR #134/iu);
  assert.match(build, /be04c5b7fbb15e9292124b7a3b70af8e5a95d4bf/u);
  assert.match(build, /20261013204945/u);
  assert.match(
    queue,
    /Build 034 — Accommodation Compatibility Engine[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 035 — Server-Authoritative Live Availability[\s\S]*QUEUED — NOT STARTED/u,
  );
});
