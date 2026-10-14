import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0046_rate_plans_dynamic_date_pricing.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0046_rate_plans_dynamic_date_pricing.sql",
    import.meta.url,
  ),
  "utf8",
);
const detail = await readFile(
  new URL("../lib/public-accommodation-detail/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/booking/accommodations/[accommodationId]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_039.md", import.meta.url),
  "utf8",
);

test("Build 039 persists protected canonical rate plans and date rules", () => {
  assert.match(migration, /create table public\.rate_plans/u);
  assert.match(migration, /create table public\.rate_rules/u);
  assert.match(migration, /nightly_cents/u);
  assert.match(migration, /weekly_cents/u);
  assert.match(migration, /monthly_cents/u);
  assert.match(migration, /seasonal_cents/u);
  assert.match(migration, /yearly_cents/u);
  assert.match(migration, /weekend.*holiday.*season.*event.*promotion/su);
  assert.match(migration, /force row level security/u);
  assert.match(verify, /must not be deletable by icamp_app/u);
});

test("Build 039 connects authoritative pricing to public accommodation detail", () => {
  assert.match(detail, /quoteAccommodationStay/u);
  assert.match(detail, /public\.rate_plans/u);
  assert.match(detail, /public\.rate_rules/u);
  assert.match(page, /Dynamic date price/u);
});

test("Build 039 preserves later fee and checkout boundaries", () => {
  assert.match(build, /Build 040/u);
  assert.match(build, /Build 041/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
});
