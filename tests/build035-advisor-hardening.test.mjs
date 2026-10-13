import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0044_build035_fk_index_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0044_build035_fk_index_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Build 035 closes all nine hosted unindexed-foreign-key findings", () => {
  for (const token of [
    "reservations_accommodation_scope_fk_idx",
    "reservations_created_by_fk_idx",
    "reservations_updated_by_fk_idx",
    "reservation_holds_accommodation_scope_fk_idx",
    "reservation_holds_created_by_fk_idx",
    "reservation_holds_updated_by_fk_idx",
    "seasonal_assignments_accommodation_scope_fk_idx",
    "seasonal_assignments_created_by_fk_idx",
    "seasonal_assignments_updated_by_fk_idx",
  ]) {
    assert.match(migration, new RegExp(token, "u"));
    assert.match(verify, new RegExp(token, "u"));
  }
});
