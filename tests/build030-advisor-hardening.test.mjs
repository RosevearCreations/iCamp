import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0036_status_history_rls_initplan.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0036_status_history_rls_initplan.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Build 030 closes hosted status-history RLS init-plan findings", () => {
  assert.match(
    migration,
    /drop policy if exists accommodation_status_history_insert/u,
  );
  assert.match(
    migration,
    /drop policy if exists operational_asset_status_history_insert/u,
  );
  assert.equal(
    (
      migration.match(/select nullif\(current_setting\('icamp\.user_id'/gu) ??
      []
    ).length,
    2,
  );
  assert.match(
    verify,
    /Accommodation status-history insert policy does not cache user context/u,
  );
  assert.match(
    verify,
    /Operational asset status-history insert policy does not cache user context/u,
  );
});
