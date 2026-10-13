import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0041_capacity_guest_vehicle_limit_rules.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0041_capacity_guest_vehicle_limit_rules.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/capacity-rules/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/capacity-rules/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const actions = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/capacity-rules/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const campgroundPage = await readFile(
  new URL("../app/workspaces/management/campgrounds/page.tsx", import.meta.url),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_033.md", import.meta.url),
  "utf8",
);
const queue = await readFile(
  new URL("../docs/BUILD_QUEUE.md", import.meta.url),
  "utf8",
);

test("Build 033 persists protected layered capacity rules", () => {
  assert.match(migration, /create table public\.capacity_limit_rules/u);
  assert.match(migration, /scope_kind/u);
  assert.match(migration, /max_occupants/u);
  assert.match(migration, /max_visitors/u);
  assert.match(migration, /max_vehicles/u);
  assert.match(migration, /minimum_site_area_m2/u);
  assert.match(
    migration,
    /alter table public\.capacity_limit_rules force row level security/u,
  );
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on public\.capacity_limit_rules/u,
  );
  assert.match(verify, /must not be deletable by icamp_app/u);
});

test("Build 033 prevents ambiguous active rules and preserves evidence", () => {
  assert.match(migration, /guard_capacity_limit_rule_mutation/u);
  assert.match(migration, /prevent_capacity_rule_ambiguity/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /size bands cannot overlap/u);
  assert.match(service, /campground\.capacity_rule\.create/u);
  assert.match(service, /campground\.capacity_rule\.archive/u);
  assert.match(service, /appendAuditEvent/u);
});

test("Build 033 exposes visible capacity configuration and preview UI", () => {
  assert.match(page, /Capacity, guest &amp; vehicle limits/u);
  assert.match(page, /Add a capacity rule/u);
  assert.match(page, /Capacity rule library/u);
  assert.match(page, /Evaluate capacity/u);
  assert.match(page, /campground → accommodation type → section/u);
  assert.match(actions, /createCapacityLimitRule/u);
  assert.match(actions, /archiveCapacityLimitRule/u);
  assert.match(campgroundPage, /Open capacity, guest & vehicle limits/u);
});

test("Build 033 keeps compatibility, availability and fees in later builds", () => {
  assert.match(build, /Build 034/u);
  assert.match(build, /Build 035/u);
  assert.match(build, /Build 040/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(build, /no new paid service/u);
});

test("Build 033 records completed production promotion and hands off Build 034", () => {
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /production PR #131/iu);
  assert.match(build, /048dd3fb874f6404b99d0c8ebfba91fd8bc51e31/u);
  assert.match(build, /20261013172550/u);
  assert.match(build, /zero findings/iu);
  assert.match(build, /No manual user action was required/iu);
  assert.match(
    queue,
    /Build 033 — Capacity, Guest & Vehicle Limit Rules[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*(Next active build|Active build in promotion)[\s\S]*Build 034 — Accommodation Compatibility Engine[\s\S]*(QUEUED — NOT STARTED|IMPLEMENTED — PROMOTION IN PROGRESS)/u,
  );
});
