import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  springWinterYear,
  requiredSpringSteps,
  normalizeSpringTemplate,
  normalizeSpringInspection,
  normalizeSpringObservation,
  normalizeSpringDecision,
} from "../lib/spring-reopening/core.mjs";

const id = () => randomUUID();
const template = () => ({
  id: id(),
  name: "Camp Rosevear spring site reactivation",
  instructions:
    "Record observed evidence from actual on-site spring safety checks.",
  extraSteps:
    "Inspect tree clearance on access loop\n[optional] Check dock ladder surfaces",
});
const inspection = () => ({
  id: id(),
  accommodationId: id(),
  assignmentId: "",
  templateId: id(),
  winterYear: 2026,
  waterService: "restored_verified",
  operatingLimits:
    "Remain closed until management verifies permits and all safety requirements.",
});
const observation = () => ({
  id: id(),
  inspectionId: id(),
  stepKey: "water-restoration",
  result: "pass",
  evidenceReference: "ROSEVEAR-TEST-089-WATER",
  note: "Verify water pressure, leaks and source clearance on site.",
});

test("six spring safety domains are immutable requirements; custom optional steps remain explicit", () => {
  assert.deepEqual(
    requiredSpringSteps.map(({ key }) => key),
    [
      "water-restoration",
      "electrical-heat",
      "sanitation-drainage",
      "fire-emergency",
      "grounds-access",
      "site-condition",
    ],
  );
  const result = normalizeSpringTemplate(template());
  assert.equal(result.steps.length, 8);
  assert.equal(result.steps.filter(({ required }) => required).length, 7);
  assert.equal(result.steps.at(-1).required, false);
  assert.throws(
    () =>
      normalizeSpringTemplate({
        ...template(),
        extraSteps: "Inspect tree clearance\nInspect tree clearance",
      }),
    /unique/u,
  );
  assert.throws(
    () => normalizeSpringTemplate({ ...template(), name: "bad" }),
    /Checklist name/u,
  );
});

test("spring operating year follows the winter closure through the next summer", () => {
  assert.equal(springWinterYear(new Date("2026-11-18T10:00:00Z")), 2026);
  assert.equal(springWinterYear(new Date("2027-02-10T10:00:00Z")), 2026);
  assert.equal(springWinterYear(new Date("2027-06-12T10:00:00Z")), 2026);
  assert.equal(springWinterYear(new Date("2027-09-02T10:00:00Z")), 2027);
  assert.equal(normalizeSpringInspection(inspection()).assignmentId, null);
  assert.equal(
    normalizeSpringInspection({ ...inspection(), assignmentId: id() })
      .waterService,
    "restored_verified",
  );
  assert.equal(
    normalizeSpringInspection({
      ...inspection(),
      waterService: "not_provided_verified",
    }).waterService,
    "not_provided_verified",
  );
  assert.throws(
    () =>
      normalizeSpringInspection({ ...inspection(), waterService: "assumed" }),
    /Verify restored/u,
  );
  assert.throws(
    () => normalizeSpringInspection({ ...inspection(), winterYear: 2017 }),
    /winter season/u,
  );
});

test("observations require source evidence and canonical corrective work", () => {
  assert.equal(normalizeSpringObservation(observation()).result, "pass");
  assert.throws(
    () =>
      normalizeSpringObservation({ ...observation(), evidenceReference: "" }),
    /source reference/u,
  );
  assert.throws(
    () => normalizeSpringObservation({ ...observation(), result: "defect" }),
    /maintenance work order/u,
  );
  assert.equal(
    normalizeSpringObservation({
      ...observation(),
      result: "defect",
      workOrderId: id(),
      evidenceReference: "",
    }).result,
    "defect",
  );
  assert.throws(
    () => normalizeSpringObservation({ ...observation(), workOrderId: id() }),
    /Only defect/u,
  );
  assert.throws(
    () =>
      normalizeSpringObservation({
        ...observation(),
        stepKey: "winter closed",
      }),
    /valid spring inspection step/u,
  );
  assert.equal(
    normalizeSpringDecision({
      id: id(),
      inspectionId: id(),
      decision: "rejected",
      note: "Recheck physical work before approval.",
    }).decision,
    "rejected",
  );
  assert.throws(
    () =>
      normalizeSpringDecision({
        id: id(),
        inspectionId: id(),
        decision: "reopened",
        note: "Incorrect automatic reopening decision.",
      }),
    /approved or rejected/u,
  );
});

test("database enforces closure-event pinning, independent review, corrective completion and canonical reopen gate", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0121_spring_reopening_return_to_service.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0121_spring_reopening_return_to_service.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const mandatory of requiredSpringSteps)
    assert.match(sql, new RegExp(mandatory.key, "u"));
  assert.match(sql, /winter_close_event_id:=latest\.id/iu);
  assert.match(sql, /seasonal_assignments_require_spring_reopening/iu);
  assert.match(
    sql,
    /latest_closure is distinct from inspection\.winter_close_event_id/iu,
  );
  assert.match(sql, /spring reviewer must be independent/iu);
  assert.match(sql, /w\.status<>'completed'/iu);
  assert.match(
    sql,
    /Inactive Camp Rosevear\/test campground cannot claim physical spring safety approval/iu,
  );
  assert.match(sql, /force row level security/iu);
  assert.match(sql, /revoke all on public/iu);
  assert.match(verify, /rolname=api_role/iu);
  assert.match(verify, /'UPDATE'/iu);
  assert.match(verify, /'DELETE'/iu);
  assert.match(verify, /Canonical winter-closed assignment reopening gate/iu);
});

test("Web/PWA workflow, help and separate seasonal release remain discoverable", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/spring-reopening/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const seasonal = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/seasonal/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const help = readFileSync(
    new URL("../lib/help/topics.ts", import.meta.url),
    "utf8",
  );
  assert.match(page, /spring\.reopening/iu);
  assert.match(page, /Spring reopening &amp; return-to-service safety/iu);
  assert.match(page, /separately\s+reopened/iu);
  assert.match(seasonal, /Build 089 spring inspection desk/iu);
  assert.match(
    help,
    /The existing Seasonal & Yearly Reopen action now checks/iu,
  );
  assert.match(help, /Phone\/IVR\/DTMF and SMS/iu);
});
