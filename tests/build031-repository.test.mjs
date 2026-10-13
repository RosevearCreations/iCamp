import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0038_management_closures_holds_map_publication.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0038_management_closures_holds_map_publication.sql",
    import.meta.url,
  ),
  "utf8",
);
const managementService = await readFile(
  new URL("../lib/management-controls/postgres.mjs", import.meta.url),
  "utf8",
);
const statusPage = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/status/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const statusActions = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/status/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const mapService = await readFile(
  new URL("../lib/map-images/postgres.mjs", import.meta.url),
  "utf8",
);
const mapPage = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/maps/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_031.md", import.meta.url),
  "utf8",
);
const queue = await readFile(
  new URL("../docs/BUILD_QUEUE.md", import.meta.url),
  "utf8",
);

test("Build 031 defines protected dated management restrictions", () => {
  assert.match(migration, /create table public\.management_restrictions/u);
  assert.match(migration, /campground\.operations\.manage/u);
  assert.match(migration, /restriction_kind in \('closure', 'hold'\)/u);
  assert.match(migration, /management_restrictions_no_overlap/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(
    migration,
    /alter table public\.management_restrictions force row level security/u,
  );
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on public\.management_restrictions/u,
  );
  assert.match(verify, /must not be deletable by icamp_app/u);
});

test("Build 031 makes restriction replacement and cancellation auditable", () => {
  assert.match(managementService, /overrideConflicts/u);
  assert.match(managementService, /Superseded by management override/u);
  assert.match(
    managementService,
    /campground\.management\.restriction\.create/u,
  );
  assert.match(
    managementService,
    /campground\.management\.restriction\.cancel/u,
  );
  assert.match(managementService, /appendAuditEvent/u);
  assert.match(migration, /guard_management_restriction_mutation/u);
});

test("Build 031 exposes bulk management controls in the responsive status UI", () => {
  assert.match(statusPage, /Management closures & holds/u);
  assert.match(statusPage, /name="targetIds"/u);
  assert.match(statusPage, /multiple/u);
  assert.match(statusPage, /overrideConflicts/u);
  assert.match(statusActions, /createManagementRestrictions/u);
  assert.match(statusActions, /cancelManagementRestriction/u);
});

test("Build 031 blocks unsafe map publication unless override is explicit", () => {
  assert.match(mapService, /getMapPublicationReadiness/u);
  assert.match(mapService, /otherVersionBindingCount/u);
  assert.match(mapService, /overrideIncompleteBindings/u);
  assert.match(mapService, /campground_map_publication_events/u);
  assert.match(mapService, /publicationRevision/u);
  assert.match(migration, /campground_map_publication_events_append_only/u);
  assert.match(mapPage, /Publication review required/u);
  assert.match(mapPage, /audited\s+management override/u);
  assert.match(mapPage, /Published-map switch history/u);
});

test("Build 031 production closeout advances the active queue", () => {
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /production PR #125/u);
  assert.match(build, /7f5161a722ef4e9b9196405361f087b719ee27b7/u);
  assert.match(build, /20261013141614/u);
  assert.match(build, /20261013142221/u);
  assert.match(build, /zero findings/u);
  assert.match(build, /No manual user action was required/u);
  assert.match(
    queue,
    /Build 031 — Management Closures, Holds & Map Publication[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 032 — Booking Calendar & Date Rules[\s\S]*QUEUED — NOT STARTED/u,
  );
});
