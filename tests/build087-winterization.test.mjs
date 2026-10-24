import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeWinterTemplate,
  normalizeWinterRun,
  normalizeWinterStep,
  normalizeWinterReview,
  winterOperatingYear,
} from "../lib/winterization/core.mjs";

const uuid = () => randomUUID();
const template = () => ({
  id: uuid(),
  name: "Camp Rosevear winter shutdown",
  instructions:
    "Observe and record the physical shutoff and draining procedure.",
  extraSteps:
    "Disconnect outside hoses\n[optional] Record seasonal meter reading",
});
const step = () => ({
  id: uuid(),
  runId: uuid(),
  stepKey: "water-shutoff",
  result: "pass",
  evidenceReference: "WINTER-PHOTO-2026",
  note: "Verified closed at the source with the on-site supervisor.",
});

test("templates require water isolation/draining and distinguish optional local tasks", () => {
  const result = normalizeWinterTemplate(template());
  assert.deepEqual(
    result.steps.map((item) => item.key),
    [
      "water-shutoff",
      "water-drain",
      "disconnect-outside-hoses",
      "record-seasonal-meter-reading",
    ],
  );
  assert.deepEqual(
    result.steps.map((item) => item.required),
    [true, true, true, false],
  );
  assert.throws(
    () =>
      normalizeWinterTemplate({
        ...template(),
        extraSteps: "Disconnect outside hoses\nDisconnect outside hoses",
      }),
    /distinct descriptions/u,
  );
  assert.throws(
    () => normalizeWinterTemplate({ ...template(), extraSteps: "x" }),
    /Utility step/u,
  );
  assert.throws(
    () => normalizeWinterTemplate({ ...template(), name: "No" }),
    /Checklist name/u,
  );
});

test("run year and canonical identifiers are validated", () => {
  const input = {
    id: uuid(),
    assignmentId: uuid(),
    templateId: uuid(),
    winterYear: 2026,
  };
  assert.equal(normalizeWinterRun(input).winterYear, 2026);
  assert.throws(
    () => normalizeWinterRun({ ...input, winterYear: 2019 }),
    /winter season/u,
  );
  assert.throws(
    () => normalizeWinterRun({ ...input, templateId: "fake" }),
    /valid UUID/u,
  );
  assert.equal(winterOperatingYear(new Date("2027-01-19T00:00:00.000Z")), 2026);
  assert.equal(winterOperatingYear(new Date("2027-10-19T00:00:00.000Z")), 2027);
});

test("positive work needs a source; corrective work needs a linked work order", () => {
  assert.equal(normalizeWinterStep(step()).result, "pass");
  assert.throws(
    () => normalizeWinterStep({ ...step(), evidenceReference: "" }),
    /source evidence/u,
  );
  assert.throws(
    () => normalizeWinterStep({ ...step(), result: "needs_work" }),
    /maintenance work order/u,
  );
  assert.equal(
    normalizeWinterStep({
      ...step(),
      result: "needs_work",
      workOrderId: uuid(),
      evidenceReference: "",
    }).result,
    "needs_work",
  );
  assert.throws(
    () =>
      normalizeWinterStep({
        ...step(),
        result: "not_applicable",
        workOrderId: uuid(),
      }),
    /Only failed/u,
  );
  assert.equal(
    normalizeWinterReview({
      id: uuid(),
      runId: uuid(),
      decision: "approved",
      note: "Reviewed the current checklist evidence on site.",
    }).decision,
    "approved",
  );
  assert.throws(
    () =>
      normalizeWinterReview({
        id: uuid(),
        runId: uuid(),
        decision: "invalid",
        note: "Reviewed the current checklist evidence on site.",
      }),
    /decision/u,
  );
});

test("database migration enforces signed review and live physical-attestation boundaries", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0118_seasonal_yearly_winterization.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /seasonal_assignments_require_winterization/iu);
  assert.match(migration, /Winterization requirement cannot be removed/iu);
  assert.match(migration, /water-shutoff/iu);
  assert.match(migration, /water-drain/iu);
  assert.match(
    migration,
    /Inactive test campgrounds cannot attest physical shutdown/iu,
  );
  assert.match(migration, /sign-off must be independent/iu);
  assert.match(migration, /approved/iu);
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/winterization/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /winterization\.shutdown/iu);
  assert.match(page, /physical work/iu);
  assert.match(page, /seasonal\?campground=/iu);
});
