import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0039_management_controls_advisor_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0039_management_controls_advisor_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Build 031 hardening covers newly introduced foreign keys", () => {
  for (const name of [
    "management_restrictions_accommodation_scope_fk_idx",
    "management_restrictions_asset_scope_fk_idx",
    "management_restrictions_section_scope_fk_idx",
    "management_restrictions_supersedes_idx",
    "campground_map_publication_events_from_fk_idx",
    "campground_map_publication_events_to_fk_idx",
  ]) {
    assert.match(migration, new RegExp(name, "u"));
    assert.match(verify, new RegExp(name, "u"));
  }
});

test("Build 031 hardening consolidates operations read access", () => {
  assert.match(migration, /alter policy accommodations_read/u);
  assert.match(migration, /alter policy operational_assets_read/u);
  assert.match(migration, /alter policy campground_sections_assigned_select/u);
  assert.match(migration, /campground\.operations\.manage/u);
  assert.match(
    migration,
    /drop policy accommodations_management_operations_read/u,
  );
  assert.match(
    migration,
    /drop policy operational_assets_management_operations_read/u,
  );
  assert.match(
    migration,
    /drop policy campground_sections_management_operations_read/u,
  );
});
