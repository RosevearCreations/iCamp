import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0033_operational_asset_equipment_fleet.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/operational-assets/postgres.mjs", import.meta.url),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_029.md", import.meta.url),
  "utf8",
);
const seo = await readFile(
  new URL("../docs/SEO_WEB_DISCOVERY.md", import.meta.url),
  "utf8",
);
const workspaceLayout = await readFile(
  new URL("../app/workspaces/layout.tsx", import.meta.url),
  "utf8",
);

test("Build 029 defines canonical facility and equipment inventory", () => {
  assert.match(migration, /create table public\.operational_assets/u);
  assert.match(migration, /create table public\.operational_facilities/u);
  assert.match(migration, /create table public\.operational_equipment/u);
  assert.match(migration, /operational_assets_facility_map_check/u);
  assert.match(migration, /ownership_type/u);
  assert.match(migration, /meter_kind/u);
  assert.match(migration, /serial_number/u);
});

test("Build 029 preserves the Build 030 status boundary", () => {
  assert.match(migration, /status_revision/u);
  assert.match(migration, /advance_operational_asset_status_revision/u);
  assert.match(build, /Build 030 remains authoritative for status history/u);
});

test("Build 029 has narrow permission and RLS boundaries", () => {
  assert.match(migration, /asset\.read/u);
  assert.match(migration, /asset\.manage/u);
  assert.match(migration, /equipment\.read/u);
  assert.match(migration, /equipment\.manage/u);
  assert.match(migration, /force row level security/u);
  assert.match(migration, /from anon/u);
  assert.match(migration, /from authenticated/u);
});

test("Build 029 service is audited and RLS-context aware", () => {
  assert.match(service, /appendAuditEvent/u);
  assert.match(service, /asset\.create/u);
  assert.match(service, /equipment\.create/u);
  assert.match(service, /asset\.update/u);
  assert.match(service, /equipment\.update/u);
  assert.match(service, /set local role icamp_app/u);
});

test("internal workspaces are non-indexable and SEO contract is explicit", () => {
  assert.match(workspaceLayout, /index: false/u);
  assert.match(workspaceLayout, /follow: false/u);
  assert.match(seo, /exactly one descriptive visible H1/u);
  assert.match(seo, /canonical URL/u);
  assert.match(seo, /XML sitemap/u);
  assert.match(seo, /Open Graph/u);
  assert.match(seo, /Structured data/u);
  assert.match(seo, /Core Web Vitals/u);
  assert.match(seo, /mobile-first/u);
});
