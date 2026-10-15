import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0060_build048_advisor_hardening.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0060_build048_advisor_hardening.sql",
  import.meta.url,
);

test("Build 048 advisor hardening replaces FOR ALL saved-item policies", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /drop policy if exists guest_rv_profiles_write/u);
  assert.match(sql, /for insert\s+to icamp_app/u);
  assert.match(sql, /for update\s+to icamp_app/u);
  assert.match(sql, /guard_guest_saved_item_identity/u);
});

test("Build 048 advisor hardening covers new foreign-key paths", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /guest_profiles_user_account_fk_idx/u);
  assert.match(sql, /guest_rv_profiles_scope_guest_fk_idx/u);
  assert.match(sql, /guest_vehicle_profiles_scope_guest_fk_idx/u);
  assert.match(sql, /guest_pet_profiles_scope_guest_fk_idx/u);
  assert.match(sql, /guest_profile_events_scope_guest_fk_idx/u);
  assert.match(sql, /reservations_guest_profile_scope_fk_idx/u);
  assert.match(sql, /seasonal_assignments_guest_profile_scope_fk_idx/u);
});

test("Build 048 advisor hardening verification asserts policy and index shape", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /Each saved-item table must have exactly one SELECT policy/u);
  assert.match(sql, /Build 048 foreign-key covering indexes are incomplete/u);
  assert.match(sql, /Precise RV insert\/update policies are missing/u);
});
