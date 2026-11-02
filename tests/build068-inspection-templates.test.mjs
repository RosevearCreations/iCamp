import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  inspectionResultValues,
  inspectionTargetKinds,
  parseInspectionItems,
  validateInspectionSignoffInput,
  validateInspectionTemplateInput,
} from "../lib/inspections/core.mjs";

test("Build 068 exposes asset, site and cottage inspection targets", () => {
  assert.deepEqual(inspectionTargetKinds, ["asset", "site", "cottage"]);
  assert.deepEqual(inspectionResultValues, ["pass", "fail", "not_applicable"]);
});

test("Build 068 checklist parsing produces stable unique item keys", () => {
  const items = parseInspectionItems(
    "Check safety signage\nCheck safety signage\nInspect electrical pedestal",
  );
  assert.equal(items.length, 3);
  assert.equal(items[0].itemKey, "check-safety-signage");
  assert.equal(items[1].itemKey, "check-safety-signage-2");
  assert.equal(items[2].failureCreatesWorkOrder, true);
});

test("Build 068 template validation enforces one matching target", () => {
  const template = validateInspectionTemplateInput({
    targetKind: "asset",
    assetId: "asset-1",
    name: "Daily pump inspection",
    failureCategoryId: "category-1",
    failurePriorityPolicyId: "priority-1",
    itemsText: "Check pressure gauge",
    signoffRequired: true,
  });
  assert.equal(template.assetId, "asset-1");
  assert.equal(template.accommodationId, null);
  assert.equal(template.signoffRequired, true);

  assert.throws(
    () =>
      validateInspectionTemplateInput({
        targetKind: "site",
        assetId: "asset-1",
        name: "Site inspection",
        failureCategoryId: "category-1",
        failurePriorityPolicyId: "priority-1",
        itemsText: "Check pedestal",
      }),
    /require exactly one accommodation/u,
  );
});

test("Build 068 rejected sign-off requires evidence", () => {
  assert.deepEqual(
    validateInspectionSignoffInput({
      decision: "approved",
      note: "",
    }),
    { decision: "approved", note: null },
  );
  assert.throws(
    () =>
      validateInspectionSignoffInput({
        decision: "rejected",
        note: "",
      }),
    /Rejection note/u,
  );
});

test("Build 068 schema enforces immutable versions and independent sign-off", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0087_versioned_inspection_templates_signoff.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const table of [
    "inspection_templates",
    "inspection_template_versions",
    "inspection_template_items",
    "inspection_occurrences",
    "inspection_results",
    "inspection_signoffs",
    "inspection_corrective_actions",
  ]) {
    assert.match(migration, new RegExp(`public\\.${table}`, "u"));
  }

  assert.match(migration, /inspection\.template\.manage/u);
  assert.match(
    migration,
    /Published inspection template versions are immutable/u,
  );
  assert.match(migration, /Inspector cannot sign off their own inspection/u);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*inspection_/iu);
  assert.match(migration, /inspection_corrective_actions_work_order_fk/u);
});

test("Build 068 service creates corrective work orders before submission", () => {
  const service = fs.readFileSync(
    new URL("../lib/inspections/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /inspection_template_versions/u);
  assert.match(service, /inspection_template_items/u);
  assert.match(service, /Required inspection item is unanswered/u);
  assert.match(service, /maintenance_work_orders/u);
  assert.match(service, /Created from failed inspection checklist item/u);
  assert.match(service, /inspection_corrective_actions/u);
  assert.match(service, /inspection\.occurrence\.signoff/u);
  assert.match(service, /maintenance\.create/u);
});

test("Build 068 Web/PWA exposes version, execution and sign-off controls", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/inspections/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Versioned Inspection Templates & Sign-Off/u);
  assert.match(page, /Create template & publish version 1/u);
  assert.match(page, /Publish new version/u);
  assert.match(page, /Start inspection/u);
  assert.match(page, /Save result/u);
  assert.match(page, /Submit inspection/u);
  assert.match(page, /Independent sign-off/u);
  assert.match(page, /Corrective work order created/u);
});

test("Build 068 records the theme-ruleset prerequisite before visual styling", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  const vision = fs.readFileSync(
    new URL("../docs/MASTER_VISION.md", import.meta.url),
    "utf8",
  );

  assert.match(roadmap, /Visual\/theme prerequisite/u);
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(vision, /Theme architecture/u);
  assert.match(vision, /multiple themes/u);
  assert.match(vision, /theme-independent/u);
});
