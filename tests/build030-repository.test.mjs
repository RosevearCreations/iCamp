import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0035_accommodation_asset_status_engine.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0035_accommodation_asset_status_engine.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/status-engine/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/status/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_030.md", import.meta.url),
  "utf8",
);
const queue = await readFile(
  new URL("../docs/BUILD_QUEUE.md", import.meta.url),
  "utf8",
);

test("Build 030 defines authoritative status vocabularies and histories", () => {
  assert.match(migration, /add column status_state/u);
  assert.match(migration, /accommodation_status_transition_rules/u);
  assert.match(migration, /operational_asset_status_transition_rules/u);
  assert.match(migration, /create table public\.accommodation_status_history/u);
  assert.match(
    migration,
    /create table public\.operational_asset_status_history/u,
  );
  assert.match(migration, /'occupied'/u);
  assert.match(migration, /'winterized'/u);
});

test("Build 030 enforces transitions and advances revisions in PostgreSQL", () => {
  assert.match(migration, /validate_accommodation_status_transition/u);
  assert.match(migration, /validate_operational_asset_status_transition/u);
  assert.match(migration, /new\.status_revision := old\.status_revision \+ 1/u);
  assert.match(
    migration,
    /new\.availability_revision := old\.availability_revision \+ 1/u,
  );
  assert.match(verify, /accepted an invalid accommodation transition/u);
  assert.match(verify, /accepted an invalid operational asset transition/u);
});

test("Build 030 status history is narrow, RLS protected and append only", () => {
  assert.match(
    migration,
    /alter table public\.accommodation_status_history force row level security/u,
  );
  assert.match(
    migration,
    /alter table public\.operational_asset_status_history force row level security/u,
  );
  assert.match(
    migration,
    /revoke all on public\.accommodation_status_history from anon/u,
  );
  assert.match(
    migration,
    /grant select, insert on public\.accommodation_status_history to icamp_app/u,
  );
  assert.doesNotMatch(
    migration,
    /grant select, insert, update on public\.accommodation_status_history/u,
  );
});

test("Build 030 server commands preserve actor context and audit transitions", () => {
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /icamp\.status_reason/u);
  assert.match(service, /accommodation\.status\.transition/u);
  assert.match(service, /operational_asset\.status\.transition/u);
  assert.match(service, /appendAuditEvent/u);
});

test("Build 030 exposes one combined responsive status control centre", () => {
  assert.match(page, /Campground status &amp; management controls/u);
  assert.match(page, /transitionAccommodationStatusAction/u);
  assert.match(page, /transitionOperationalAssetStatusAction/u);
  assert.match(page, /Recent status history/u);
  assert.match(page, /Build 030 still owns immediate current state/u);
});

test("Build 030 documents promotion and advances the active queue", () => {
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(
    build,
    /Build 031 — Management Closures, Holds & Map Publication/u,
  );
  assert.match(build, /50d0e05fe6c75efb620b8909aebdbad291076b86/u);
  assert.match(build, /production PR #121/u);
  assert.match(
    queue,
    /Next active build[\s\S]*Build 031 — Management Closures, Holds & Map Publication[\s\S]*QUEUED — NOT STARTED/u,
  );
});
