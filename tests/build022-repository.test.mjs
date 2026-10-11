import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 022 persists six permission-aware ordered map layers", async () => {
  const migration = await readFile(
    "database/migrations/0024_map_layers_labels_icons.sql",
    "utf8",
  );
  assert.match(migration, /campground_map_layers/u);
  assert.match(migration, /visibility_permission_key/u);
  assert.match(migration, /reservation\.read/u);
  assert.match(migration, /maintenance\.read/u);
  assert.match(migration, /access\.events\.read/u);
  assert.match(migration, /sort_order/u);
  assert.match(migration, /map_label/u);
  assert.match(migration, /map_icon_key/u);
  assert.match(migration, /layer_id set not null/u);
});

test("Build 022 layer service enforces visibility and configuration permissions", async () => {
  const domain = await readFile("lib/map-layers/postgres.mjs", "utf8");
  assert.match(domain, /hasCampgroundPermission/u);
  assert.match(domain, /row\.visibility_permission_key/u);
  assert.match(domain, /campground\.configuration/u);
  assert.match(domain, /campground\.map\.layer\.update/u);
  assert.match(domain, /campground\.map\.layer\.reorder/u);
  assert.match(domain, /appendAuditEvent/u);
  assert.match(domain, /row_version/u);
});

test("Build 022 starts in development while queue remains on Build 022", async () => {
  const build = await readFile("docs/BUILD_022.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  assert.match(build, /IN DEVELOPMENT/u);
  assert.match(
    queue,
    /Next active build[\s\S]*Build 022 — Map Layers, Labels & Icons[\s\S]*QUEUED — NOT STARTED/u,
  );
});
