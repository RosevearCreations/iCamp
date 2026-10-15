import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assignmentStateForEvent,
  normalizeAssignmentTransition,
  normalizeLongTermAssignment,
  occupancyStateForEvent,
} from "../lib/long-term-assignment/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0056_seasonal_yearly_assignment_foundation.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0056_seasonal_yearly_assignment_foundation.sql",
  import.meta.url,
);
const serviceUrl = new URL("../lib/long-term-assignment/postgres.mjs", import.meta.url);

test("Build 047 normalizes seasonal and yearly assignments", () => {
  const value = normalizeLongTermAssignment({
    accommodationId: "site-1",
    assignmentKind: "seasonal",
    occupantDisplayName: "Seasonal Guest",
    startsOn: "2027-05-01",
    endsOn: "2027-10-15",
    ratePlanId: "plan-1",
    chargeAmountCents: 250000,
    currencyCode: "cad",
    chargeDueOn: "2027-05-01",
  });
  assert.equal(value.assignmentKind, "seasonal");
  assert.equal(value.currencyCode, "CAD");
  assert.throws(
    () => normalizeLongTermAssignment({ ...value, assignmentKind: "nightly" }),
    /seasonal or yearly/u,
  );
});

test("Build 047 models winter closure separately from assignment termination", () => {
  assert.equal(occupancyStateForEvent("winter_closed"), "winter_closed");
  assert.equal(occupancyStateForEvent("reopened"), "assigned");
  assert.equal(assignmentStateForEvent("ended"), "ended");
  assert.equal(assignmentStateForEvent("cancelled"), "cancelled");
  assert.equal(
    normalizeAssignmentTransition({
      assignmentId: "assignment-1",
      eventKind: "winter_closed",
      effectiveOn: "2027-11-01",
    }).eventKind,
    "winter_closed",
  );
});

test("Build 047 extends the existing Build 035 availability authority", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.seasonal_assignments/u);
  assert.match(sql, /assignment_kind/u);
  assert.match(sql, /winter_closed/u);
  assert.match(sql, /seasonal_assignment_events/u);
  assert.doesNotMatch(sql, /create table public\.seasonal_assignments/u);
});

test("Build 047 reuses Build 039 seasonal/yearly rates", async () => {
  const service = await readFile(serviceUrl, "utf8");
  assert.match(service, /public\.rate_plans/u);
  assert.match(service, /seasonal_cents/u);
  assert.match(service, /yearly_cents/u);
  assert.match(service, /charge does not match/u);
});

test("Build 047 keeps Build 035 conflict protection and FORCE RLS evidence", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /seasonal_assignments_no_live_conflict/u);
  assert.match(sql, /FORCE RLS/u);
});
