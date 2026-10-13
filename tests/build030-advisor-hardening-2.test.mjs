import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0037_status_history_rls_initplan_scalar.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Build 030 wraps current_setting itself in scalar SELECTs", () => {
  assert.equal(
    (
      migration.match(
        /nullif\(\(select current_setting\('icamp\.user_id', true\)\), ''\)::uuid/gu,
      ) ?? []
    ).length,
    2,
  );
});
