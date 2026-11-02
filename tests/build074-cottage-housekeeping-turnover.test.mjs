import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Build 074 extends Build 027 without duplicating housekeeping state", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0095_cottage_housekeeping_turnover_operations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /alter table public\.cottage_housekeeping_templates/u,
  );
  assert.match(migration, /final_inspection_template_id/u);
  assert.match(migration, /alter table public\.cottage_turnovers/u);
  assert.match(migration, /release_required/u);
  assert.match(migration, /released_at/u);
  assert.match(migration, /cottage_turnover_inspection_evidence/u);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /accommodations_guard_cottage_turnover_release/u);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(
    migration,
    /grant[^;]*delete[^;]*cottage_turnover_inspection_evidence/iu,
  );
});

test("Build 074 reuses canonical inspection corrective work and availability", () => {
  const service = fs.readFileSync(
    new URL("../lib/cottage-turnover-operations/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /public\.inspection_occurrences/u);
  assert.match(service, /public\.inspection_corrective_actions/u);
  assert.match(service, /public\.maintenance_work_orders/u);
  assert.match(service, /housekeeping_inspection_result/u);
  assert.match(service, /inspection_status !== "signed_off"/u);
  assert.match(service, /open_corrective_work_orders/u);
  assert.match(service, /status_state='available'/u);
  assert.match(service, /Build 074 cottage housekeeping turnover cleared/u);
  assert.doesNotMatch(service, /insert into public\.maintenance_work_orders/u);
});

test("Build 074 requires readiness before final inspection and release", () => {
  const service = fs.readFileSync(
    new URL("../lib/cottage-turnover-operations/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /unchecked_required/u);
  assert.match(service, /checklist_issues/u);
  assert.match(service, /linen_complete/u);
  assert.match(service, /housekeeping_complete/u);
  assert.match(service, /inventory_complete/u);
  assert.match(service, /damage_found/u);
  assert.match(service, /security_issue_found/u);
  assert.match(service, /release_required !== true/u);
  assert.match(service, /released_at=statement_timestamp\(\)/u);
});

test("Build 074 Web/PWA exposes configuration, turnover queue and release", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/cottage-turnover/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/cottage-turnover/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const workspace = fs.readFileSync(
    new URL("../app/workspaces/[workspace]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Cottage Housekeeping &amp; Turnover/u);
  assert.match(page, /Bind housekeeping to a cottage inspection/u);
  assert.match(page, /Start final cottage inspection/u);
  assert.match(page, /Release cottage to availability/u);
  assert.match(page, /Build 027 remains/u);
  assert.match(page, /Build 068 owns/u);
  assert.match(page, /Build 065 corrective work orders/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);

  assert.match(actions, /configureCottageTurnoverFinalInspection/u);
  assert.match(actions, /startCottageTurnoverFinalInspection/u);
  assert.match(actions, /releaseCottageTurnover/u);
  assert.match(workspace, /maintenance-cottage-turnover-heading/u);
  assert.match(workspace, /Build 074/u);
});

test("Build 074 preserves the standard multi-theme prerequisite", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
