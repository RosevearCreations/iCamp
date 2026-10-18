import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("Build 060 advisor hardening keeps one SELECT policy per access-policy table", () => {
  const migration = fs.readFileSync(
    new URL("../database/migrations/0079_access_rules_policy_hardening.sql", import.meta.url),
    "utf8",
  );

  for (const legacyPolicy of [
    "access_zones_manage",
    "access_zone_devices_manage",
    "access_schedules_manage",
    "access_rules_manage",
  ]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists ${legacyPolicy}`),
    );
  }

  for (const readPolicy of [
    "access_zones_read",
    "access_zone_devices_read",
    "access_schedules_read",
    "access_rules_read",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`create policy ${readPolicy}`),
      "hardening must preserve the existing canonical SELECT policy",
    );
  }

  assert.match(migration, /for insert to icamp_app/);
  assert.match(migration, /for update to icamp_app/);
  assert.match(migration, /for delete to icamp_app/);
});
