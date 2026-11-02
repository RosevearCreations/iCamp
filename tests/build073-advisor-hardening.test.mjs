import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Build 073 advisor hardening covers composite cleanup foreign keys", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0094_build073_advisor_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /campsite_departure_cleanup_programs_scope_accommodation_fk_idx/u,
  );
  assert.match(
    migration,
    /organization_id,\s*campground_id,\s*accommodation_id/su,
  );
  assert.match(
    migration,
    /campsite_departure_cleanup_tasks_scope_checkout_fk_idx/u,
  );
  assert.match(
    migration,
    /organization_id,\s*campground_id,\s*reservation_check_out_id/su,
  );
  assert.match(
    migration,
    /campsite_departure_cleanup_tasks_scope_occurrence_fk_idx/u,
  );
  assert.match(
    migration,
    /organization_id,\s*campground_id,\s*inspection_occurrence_id/su,
  );
});
