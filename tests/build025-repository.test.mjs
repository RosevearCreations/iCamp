import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 025 adds typed campsite classification, utilities and dimensions", async () => {
  const migration = await readFile(
    "database/migrations/0028_campsite_types_utilities.sql",
    "utf8",
  );

  assert.match(migration, /campsite_type/u);
  assert.match(migration, /service_level/u);
  assert.match(migration, /stay_profile/u);
  assert.match(migration, /electrical_amperage/u);
  assert.match(migration, /water_service/u);
  assert.match(migration, /wastewater_service/u);
  assert.match(migration, /wifi_service/u);
  assert.match(migration, /site_length_meters/u);
  assert.match(migration, /site_width_meters/u);
  assert.match(migration, /max_rv_length_meters/u);
  assert.match(migration, /is_waterfront/u);
  assert.match(migration, /pull_through/u);
  assert.match(migration, /campsites_bump_availability_revision/u);
});

test("Build 025 exposes audited campsite detail administration", async () => {
  const service = await readFile("lib/accommodations/postgres.mjs", "utf8");
  const actions = await readFile(
    "app/workspaces/management/campgrounds/accommodations/actions.ts",
    "utf8",
  );
  const page = await readFile(
    "app/workspaces/management/campgrounds/accommodations/page.tsx",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(service, /updateCampsiteDetails/u);
  assert.match(service, /accommodation\.campsite\.configure/u);
  assert.match(service, /expectedDetailRowVersion/u);
  assert.match(actions, /updateCampsiteDetailsAction/u);
  assert.match(page, /Campsite type, utilities & fit/u);
  assert.match(page, /electricalAmperage/u);
  assert.match(page, /maxRvLengthMeters/u);
  assert.match(help, /"campsite\.services"/u);
});

test("Build 025 is fully promoted and hands off to Build 026", async () => {
  const build = await readFile("docs/BUILD_025.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /Build 025 — Campsite Types & Utility\/Service Model/u);
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /d86b5d02a5d4def4f962981d371b137f4a1ae2d0/u);
  assert.match(build, /38276344528/u);
  assert.match(build, /38276344446/u);
  assert.match(build, /38276344613/u);
  assert.match(build, /20261012161432/u);
  assert.match(build, /No manual user action was required/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(
    queue,
    /Build 025 — Campsite Types & Utility\/Service Model[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Build 034 — Accommodation Compatibility Engine[\s\S]*FULLY PROMOTED — `main` GREEN/u,
  );
});
