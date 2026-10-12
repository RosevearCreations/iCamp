import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 024 defines one canonical parent and three enforced subtype links", async () => {
  const migration = await readFile(
    "database/migrations/0027_unified_accommodation_model.sql",
    "utf8",
  );
  assert.match(migration, /create table public\.accommodations/u);
  assert.match(migration, /create table public\.campsites/u);
  assert.match(migration, /create table public\.rental_cottages/u);
  assert.match(migration, /create table public\.permanent_units/u);
  assert.match(migration, /accommodations_map_object_unique/u);
  assert.match(migration, /accommodations_validate_map_object/u);
  assert.match(migration, /accommodations_require_subtype/u);
  assert.match(migration, /Accommodation must have exactly one subtype row/u);
  assert.match(migration, /permanent_unit/u);
});

test("Build 024 RLS and service use accommodation permissions and audit evidence", async () => {
  const migration = await readFile(
    "database/migrations/0027_unified_accommodation_model.sql",
    "utf8",
  );
  const service = await readFile("lib/accommodations/postgres.mjs", "utf8");
  assert.match(migration, /force row level security/u);
  assert.match(migration, /accommodation\.read/u);
  assert.match(migration, /accommodation\.manage/u);
  assert.match(
    migration,
    /revoke all on public\.accommodations from authenticated/u,
  );
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /accommodation\.map_identity\.create/u);
  assert.match(service, /accommodation\.create/u);
  assert.match(service, /accommodation\.update/u);
  assert.match(service, /appendAuditEvent/u);
  assert.match(service, /availability_revision/u);
  assert.match(service, /status_revision/u);
});

test("Build 024 remains in development while the active queue is Build 024", async () => {
  const build = await readFile("docs/BUILD_024.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  assert.match(build, /IN DEVELOPMENT/u);
  assert.match(
    queue,
    /Next active build[\s\S]*Build 024 — Unified Accommodation Model[\s\S]*QUEUED — NOT STARTED/u,
  );
});
