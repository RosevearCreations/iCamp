import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0047_rate_pricing_advisor_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0047_rate_pricing_advisor_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Build 039 hardening covers every pricing foreign key reported by the advisor", () => {
  assert.match(migration, /rate_plans_accommodation_fk_idx/u);
  assert.match(migration, /rate_plans_campground_scope_fk_idx/u);
  assert.match(migration, /rate_rules_campground_scope_fk_idx/u);
});

test("Build 039 hardening splits write policies so SELECT has one permissive path", () => {
  assert.match(migration, /drop policy if exists rate_plans_write/u);
  assert.match(migration, /drop policy if exists rate_rules_write/u);
  assert.match(migration, /create policy rate_plans_insert/u);
  assert.match(migration, /create policy rate_plans_update/u);
  assert.match(migration, /create policy rate_rules_insert/u);
  assert.match(migration, /create policy rate_rules_update/u);
  assert.match(verify, /exactly one SELECT policy/u);
  assert.match(verify, /must remain non-deletable/u);
});
