import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 023 closes composite foreign-key index advisories", async () => {
  const migration = await readFile(
    "database/migrations/0026_map_object_fk_indexes.sql",
    "utf8",
  );
  assert.match(migration, /campground_map_object_bindings_object_scope_idx/u);
  assert.match(migration, /campground_map_object_bindings_image_scope_idx/u);
  assert.match(migration, /campground_map_object_bindings_layer_scope_idx/u);
  assert.match(migration, /campground_map_object_bindings_polygon_scope_idx/u);
  assert.match(migration, /campground_map_polygons_layer_scope_idx/u);
  assert.match(
    migration,
    /organization_id,[\s\S]*campground_id,[\s\S]*map_object_id/u,
  );
});
