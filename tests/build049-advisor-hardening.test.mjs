import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0062_build049_advisor_hardening.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0062_build049_advisor_hardening.sql",
  import.meta.url,
);

test("Build 049 advisor hardening covers composite check-in foreign keys", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /reservation_check_ins_scope_reservation_fk_idx/u);
  assert.match(sql, /reservation_check_ins_scope_guest_profile_fk_idx/u);
  assert.match(sql, /organization_id/u);
  assert.match(sql, /campground_id/u);
});

test("Build 049 advisor verification requires both covering indexes", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /required_index_count <> 2/u);
  assert.match(sql, /composite foreign-key covering indexes are incomplete/u);
});
