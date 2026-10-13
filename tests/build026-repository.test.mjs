import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 026 adds rental cottage occupancy, facilities and accessibility facts", async () => {
  const migration = await readFile(
    "database/migrations/0029_rental_cottage_model.sql",
    "utf8",
  );

  assert.match(migration, /cottage_style/u);
  assert.match(migration, /bedroom_count/u);
  assert.match(migration, /bed_count/u);
  assert.match(migration, /max_occupancy/u);
  assert.match(migration, /kitchen_type/u);
  assert.match(migration, /washroom_type/u);
  assert.match(migration, /shower_type/u);
  assert.match(migration, /heating_type/u);
  assert.match(migration, /cooling_type/u);
  assert.match(migration, /has_refrigerator/u);
  assert.match(migration, /step_free_access/u);
  assert.match(migration, /accessible_washroom/u);
  assert.match(migration, /view_type/u);
  assert.match(migration, /rental_cottages_bump_availability_revision/u);
});

test("Build 026 exposes audited rental cottage administration", async () => {
  const service = await readFile("lib/accommodations/postgres.mjs", "utf8");
  const actions = await readFile(
    "app/workspaces/management/campgrounds/accommodations/actions.ts",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(service, /updateRentalCottageDetails/u);
  assert.match(service, /accommodation\.cottage\.configure/u);
  assert.match(service, /cottageAuditState/u);
  assert.match(actions, /updateRentalCottageDetailsAction/u);
  assert.match(help, /"cottage\.facilities"/u);
  assert.match(help, /Build 033/u);
  assert.match(help, /Build 034/u);
});

test("Build 026 is fully promoted and hands off to Build 027", async () => {
  const build = await readFile("docs/BUILD_026.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /Build 026 — Rental Cottage Model/u);
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /d954b8885e89f8f94991811767e44498e125bee7/u);
  assert.match(build, /38320978747/u);
  assert.match(build, /38320978713/u);
  assert.match(build, /38320978755/u);
  assert.match(build, /20261012231044/u);
  assert.match(build, /No manual user action was required/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(
    queue,
    /Build 026 — Rental Cottage Model[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 028 — Site\/Cottage Public Gallery: Up to 10 Images[\s\S]*QUEUED — NOT STARTED/u,
  );
});
