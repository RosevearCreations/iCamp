import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  campsiteTypes,
  formatCleanupState,
  validateDepartureCleanupProgramInput,
} from "../lib/campsite-departure-cleanup/core.mjs";

test("Build 073 models canonical campsite types and cleanup configuration", () => {
  assert.deepEqual(campsiteTypes, ["tent", "rv", "mixed"]);

  const program = validateDepartureCleanupProgramInput({
    accommodationId: "site-1",
    campsiteType: "rv",
    inspectionTemplateId: "template-1",
    blockRebookingUntilClear: true,
    notes: "Inspect pedestal and pad after departure.",
  });

  assert.equal(program.campsiteType, "rv");
  assert.equal(program.blockRebookingUntilClear, true);
  assert.equal(program.isActive, true);

  assert.throws(
    () =>
      validateDepartureCleanupProgramInput({
        accommodationId: "site-1",
        campsiteType: "cottage",
        inspectionTemplateId: "template-1",
      }),
    /Campsite type is invalid/u,
  );
});

test("Build 073 derives queue state without duplicating checklist or issue closure", () => {
  assert.equal(
    formatCleanupState({ programId: null }),
    "Configuration required",
  );
  assert.equal(
    formatCleanupState({
      programId: "program",
      inspectionOccurrenceId: "occurrence",
      inspectionStatus: "signed_off",
      openCorrectiveWorkOrders: 2,
    }),
    "Corrective work open",
  );
  assert.equal(
    formatCleanupState({
      programId: "program",
      inspectionOccurrenceId: "occurrence",
      inspectionStatus: "signed_off",
      openCorrectiveWorkOrders: 0,
    }),
    "Ready to clear",
  );
  assert.equal(formatCleanupState({ clearedAt: "2026-10-22" }), "Cleared");
});

test("Build 073 schema reuses checkout, Build 068 inspections, Build 065 work orders and canonical availability", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0093_departure_campsite_cleanup.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /campsite_departure_cleanup_programs/u);
  assert.match(migration, /campsite_departure_cleanup_tasks/u);
  assert.match(migration, /references public\.reservation_check_outs/iu);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /inspection_corrective_actions/u);
  assert.match(migration, /maintenance_work_orders/u);
  assert.match(migration, /'tent','rv','mixed'/u);
  assert.match(migration, /accommodations_guard_campsite_cleanup_rebooking/u);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(
    migration,
    /grant[^;]*delete[^;]*campsite_departure_cleanup/iu,
  );
});

test("Build 073 service starts canonical site inspections and clears only resolved work", () => {
  const service = fs.readFileSync(
    new URL(
      "../lib/campsite-departure-cleanup/postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(service, /insert into public\.inspection_occurrences/u);
  assert.match(service, /target_kind.*site/su);
  assert.match(service, /inspection_corrective_actions/u);
  assert.match(service, /completed','cancelled/u);
  assert.match(service, /status_state='available'/u);
  assert.match(service, /accommodation\.manage/u);
  assert.doesNotMatch(
    service,
    /insert into public\.maintenance_work_orders/u,
  );
});

test("Build 073 checkout creates the automatic handoff and honors configured rebooking policy", () => {
  const checkout = fs.readFileSync(
    new URL("../lib/front-desk-check-out/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(checkout, /cs\.campsite_type/u);
  assert.match(checkout, /campsite_departure_cleanup_programs/u);
  assert.match(checkout, /block_rebooking_until_clear/u);
  assert.match(checkout, /Build 073 campsite cleanup rebooking policy/u);
  assert.match(checkout, /row\.accommodation_kind !== "rental_cottage"/u);
  assert.match(
    checkout,
    /campsiteCleanupTaskBoundary: "Build 073 \(historical Build 074\)"/u,
  );
});

test("Build 073 Web/PWA exposes configuration, queue, inspections and clearance", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/departure-cleanup/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Departure Campsite Cleanup/u);
  assert.match(page, /Cleanup inspection programs/u);
  assert.match(page, /Departure cleanup queue/u);
  assert.match(page, /Start campsite cleanup inspection/u);
  assert.match(page, /Clear departure cleanup/u);
  assert.match(page, /Build 068 remains the checklist and sign-off authority/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
});

test("Build 073 preserves the standard multi-theme prerequisite", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
