import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeSectionSettings } from "../lib/campground-structure/postgres.mjs";

test("Build 017 section settings are bounded and typed", () => {
  assert.deepEqual(normalizeSectionSettings(), {
    operatingMode: "standard",
    quietHoursStart: null,
    quietHoursEnd: null,
    staffNote: "",
  });
  assert.equal(
    normalizeSectionSettings({
      operatingMode: "quiet",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      staffNote: "Quiet loop",
    }).operatingMode,
    "quiet",
  );
  assert.throws(
    () => normalizeSectionSettings({ operatingMode: "unsafe" }),
    /Operating mode/u,
  );
  assert.throws(
    () => normalizeSectionSettings({ quietHoursStart: "99:99" }),
    /24-hour/u,
  );
});

test("Build 017 migration adds settings and RLS insert policies", async () => {
  const migration = await readFile(
    "database/migrations/0020_campground_section_administration.sql",
    "utf8",
  );
  assert.match(migration, /add column settings jsonb/u);
  assert.match(migration, /pg_column_size\(settings\) <= 8192/u);
  assert.match(
    migration,
    /grant insert on public\.campground_sections to icamp_app/u,
  );
  assert.match(migration, /campground_sections_configuration_insert/u);
  assert.match(migration, /campground_subsections_configuration_insert/u);
  assert.match(migration, /campground\.configuration/u);
});

test("Build 017 management page covers ordering, state and section settings", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/page.tsx",
    "utf8",
  );
  assert.match(page, /sortOrder/u);
  assert.match(page, /lifecycleState/u);
  assert.match(page, /operatingMode/u);
  assert.match(page, /quietHoursStart/u);
  assert.match(page, /staffNote/u);
  assert.match(page, /createSubsectionAction/u);
  assert.match(page, /AdminRefreshControl/u);
  assert.match(page, /helpTopic="campground\.structure"/u);
});

test("Build 017 mutations use permission checks, RLS and audit evidence", async () => {
  const domain = await readFile(
    "lib/campground-structure/postgres.mjs",
    "utf8",
  );
  assert.match(domain, /hasCampgroundPermission/u);
  assert.match(domain, /set local role icamp_app/u);
  assert.match(domain, /set_config\('icamp\.user_id'/u);
  assert.match(domain, /appendAuditEvent/u);
  assert.match(domain, /row_version = \$8/u);
  assert.match(domain, /campground\.section\.create/u);
  assert.match(domain, /campground\.subsection\.update/u);
});

test("Build 017 documents visual-channel fallback and later-build boundaries", async () => {
  const source = await readFile("docs/CAMPGROUND_STRUCTURE_ADMIN.md", "utf8");
  const build = await readFile("docs/BUILD_017.md", "utf8");
  assert.match(source, /secure-link/u);
  assert.match(source, /Builds 018–031/u);
  assert.match(build, /campground\.configuration/u);
  assert.match(build, /Web\/PWA/u);
});
