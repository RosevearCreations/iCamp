import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeReadinessTemplate,
  normalizeReadinessAssessment,
  normalizeReadinessObservation,
  normalizeReadinessDecision,
  winterOperatingYear,
} from "../lib/cold-readiness/core.mjs";

const id = () => randomUUID();
const policy = () => ({
  id: id(),
  name: "Camp Rosevear cold-weather operations",
  instructions: "Use the campground's on-site winter inspection checklist.",
  extraSteps:
    "Inspect backup heating system\n[optional] Record storm contact sheet",
});
const assessment = () => ({
  id: id(),
  accommodationId: id(),
  templateId: id(),
  assignmentId: "",
  winterYear: 2026,
  waterMode: "insulated",
  operatingLimits:
    "Freeze conditions require daily staff inspections and safe winter access.",
});
const observation = () => ({
  id: id(),
  assessmentId: id(),
  stepKey: "water-freeze-protection",
  result: "pass",
  evidenceReference: "ROSEVEAR-SYNTHETIC-088",
  note: "Physically inspect actual water insulation before approving any site.",
});

test("four required safety domains stay mandatory, optional tasks remain explicit", () => {
  const result = normalizeReadinessTemplate(policy());
  assert.deepEqual(
    result.steps.slice(0, 4).map((s) => s.key),
    [
      "water-freeze-protection",
      "heating-power",
      "sanitation-drainage",
      "winter-access",
    ],
  );
  assert.equal(result.steps.filter((s) => s.required).length, 5);
  assert.equal(result.steps.at(-1).required, false);
  assert.throws(
    () =>
      normalizeReadinessTemplate({
        ...policy(),
        extraSteps:
          "Inspect backup heating system\nInspect backup heating system",
      }),
    /unique/u,
  );
  assert.throws(
    () => normalizeReadinessTemplate({ ...policy(), name: "bad" }),
    /Policy name/u,
  );
});

test("assessment explicitly records water protection, limits and winter year", () => {
  assert.equal(
    normalizeReadinessAssessment(assessment()).waterMode,
    "insulated",
  );
  assert.equal(
    normalizeReadinessAssessment({
      ...assessment(),
      waterMode: "none_verified",
    }).waterMode,
    "none_verified",
  );
  assert.equal(
    normalizeReadinessAssessment({ ...assessment(), waterMode: "heated" })
      .waterMode,
    "heated",
  );
  assert.throws(
    () =>
      normalizeReadinessAssessment({ ...assessment(), waterMode: "assumed" }),
    /verified/u,
  );
  assert.throws(
    () => normalizeReadinessAssessment({ ...assessment(), winterYear: 2019 }),
    /winter season/u,
  );
  assert.throws(
    () =>
      normalizeReadinessAssessment({
        ...assessment(),
        operatingLimits: "tiny",
      }),
    /Operating limits/u,
  );
  assert.equal(winterOperatingYear(new Date("2027-03-01T12:00:00Z")), 2026);
});

test("passing requires evidence; a defect requires a maintenance work order", () => {
  assert.equal(normalizeReadinessObservation(observation()).result, "pass");
  assert.throws(
    () =>
      normalizeReadinessObservation({
        ...observation(),
        evidenceReference: "",
      }),
    /source reference/u,
  );
  assert.throws(
    () => normalizeReadinessObservation({ ...observation(), result: "defect" }),
    /corrective work order/u,
  );
  assert.equal(
    normalizeReadinessObservation({
      ...observation(),
      result: "defect",
      workOrderId: id(),
      evidenceReference: "",
    }).result,
    "defect",
  );
  assert.throws(
    () =>
      normalizeReadinessObservation({
        ...observation(),
        result: "pass",
        workOrderId: id(),
      }),
    /Only defects/u,
  );
  assert.equal(
    normalizeReadinessDecision({
      id: id(),
      assessmentId: id(),
      decision: "rejected",
      note: "Correct site defects before winter opening.",
    }).decision,
    "rejected",
  );
  assert.throws(
    () =>
      normalizeReadinessDecision({
        id: id(),
        assessmentId: id(),
        decision: "activated",
        note: "Correct site defects before winter opening.",
      }),
    /approved or rejected/u,
  );
});

test("SQL and UI enforce separate readiness, independent approval and safe boundaries", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0120_cold_weather_winter_readiness.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /winterization_required/iu);
  assert.match(migration, /winter_closed/iu);
  assert.match(migration, /Reviewer must be independent/iu);
  assert.match(migration, /cannot attest physical winter readiness/iu);
  assert.match(
    migration,
    /Every safety step needs acceptable latest evidence/iu,
  );
  assert.match(migration, /does not activate winter bookings/iu);
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/winter-readiness/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /winter\.readiness/iu);
  assert.match(page, /No automatic winter opening/iu);
  assert.match(page, /winterization\?campground=/iu);
});
