import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyFulfillmentDispatch,
  validateDispatchHandoff,
  validateWorkerDispatchAcknowledgement,
} from "../lib/booking-charges/fulfillment-dispatch-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workerId = "d2b0ef14-c48f-488d-805c-faa09be41b2b";
const jobId = "d2b0ef14-c48f-488d-805c-faa09be41b2c";
const dispatchId = "d2b0ef14-c48f-488d-805c-faa09be41b2d";
const handoff = {
  jobId,
  assignedUserId: workerId,
  expectedJobVersion: 3,
  expectedAssignmentVersion: 2,
  acknowledgementMinutes: "90",
  completionTargetUtc: "2026-11-10T18:30",
};

test("Build 238 requires explicit acknowledgement targets and current version identities", () => {
  assert.deepEqual(validateDispatchHandoff(handoff), {
    jobId,
    assignedUserId: workerId,
    expectedJobVersion: 3,
    expectedAssignmentVersion: 2,
    acknowledgementMinutes: 90,
    completionDueAt: "2026-11-10T18:30:00.000Z",
  });
  assert.equal(
    validateDispatchHandoff({ ...handoff, completionTargetUtc: "" })
      .completionDueAt,
    null,
  );
  for (const invalid of [
    { assignedUserId: "" },
    { jobId: "another" },
    { expectedJobVersion: 0 },
    { expectedAssignmentVersion: -1 },
    { acknowledgementMinutes: "" },
    { acknowledgementMinutes: "4" },
    { acknowledgementMinutes: "10081" },
    { acknowledgementMinutes: "1e3" },
    { acknowledgementMinutes: "1.5" },
    { completionTargetUtc: "2026-02-30T13:00" },
    { completionTargetUtc: "2026-11-10T25:00" },
    { completionTargetUtc: "2026-11-10T11:00Z" },
  ]) {
    assert.throws(() => validateDispatchHandoff({ ...handoff, ...invalid }));
  }
});

test("Build 238 worker accepts or requests help, never signs for someone else", () => {
  assert.deepEqual(
    validateWorkerDispatchAcknowledgement({
      dispatchId,
      response: "accepted",
      note: "",
    }),
    { dispatchId, response: "accepted", note: null },
  );
  assert.deepEqual(
    validateWorkerDispatchAcknowledgement({
      dispatchId,
      response: "needs_support",
      note: "Need equipment",
    }),
    { dispatchId, response: "needs_support", note: "Need equipment" },
  );
  for (const invalid of [
    { dispatchId: "missing" },
    { response: "supervisor_approved" },
    { response: "needs_support", note: " " },
    { note: "x".repeat(301) },
  ]) {
    assert.throws(() =>
      validateWorkerDispatchAcknowledgement({
        dispatchId,
        response: "accepted",
        note: "",
        ...invalid,
      }),
    );
  }
});

test("Build 238 SLA signals only stored deadlines and actual receipt timestamps", () => {
  const dispatch = {
    id: dispatchId,
    assignedUserId: workerId,
    assignmentVersion: 2,
    jobVersion: 3,
    acknowledgementDueAt: "2026-11-10T11:00:00Z",
    completionDueAt: "2026-11-10T17:00:00Z",
    response: null,
    acknowledgedAt: null,
    completedAt: null,
  };
  const context = {
    currentJobVersion: 3,
    currentAssignmentVersion: 2,
    currentAssignedUserId: workerId,
    jobState: "scheduled",
    dispatch,
    now: "2026-11-10T12:00:00Z",
  };
  const outlook = (changes = {}, dispatchChanges = {}) =>
    classifyFulfillmentDispatch({
      ...context,
      ...changes,
      dispatch: { ...dispatch, ...dispatchChanges },
    });
  assert.deepEqual(outlook(), {
    status: "current",
    acknowledgement: "overdue",
    completion: "pending",
    canAcknowledge: true,
  });
  assert.equal(
    outlook(
      {},
      { response: "accepted", acknowledgedAt: "2026-11-10T10:00:00Z" },
    ).acknowledgement,
    "accepted_on_time",
  );
  assert.equal(
    outlook(
      {},
      { response: "accepted", acknowledgedAt: "2026-11-10T11:01:00Z" },
    ).acknowledgement,
    "accepted_late",
  );
  assert.equal(
    outlook(
      {},
      { response: "needs_support", acknowledgedAt: "2026-11-10T11:01:00Z" },
    ).acknowledgement,
    "support_requested",
  );
  assert.equal(outlook({ now: "2026-11-10T17:01:00Z" }).completion, "overdue");
  assert.equal(
    outlook({}, { completedAt: "2026-11-10T17:01:00Z" }).completion,
    "completed_late",
  );
  assert.equal(
    outlook({}, { completedAt: "2026-11-10T16:00:00Z" }).completion,
    "completed_on_time",
  );
  assert.equal(
    outlook({}, { completionDueAt: null }).completion,
    "not_configured",
  );
  assert.equal(outlook({ currentAssignmentVersion: 3 }).status, "superseded");
  assert.equal(outlook({ isLatest: false }).status, "superseded");
  assert.equal(
    outlook({ currentAssignedUserId: "different" }).canAcknowledge,
    false,
  );
  assert.equal(outlook({ jobState: "blocked" }).canAcknowledge, false);
  assert.equal(outlook({ jobState: "completed" }).canAcknowledge, false);
  assert.equal(
    classifyFulfillmentDispatch({ ...context, dispatch: null }),
    null,
  );
});

test("Build 238 read/write surface is tenant/permission-scoped with no implicit outreach", () => {
  const source = read("lib/booking-charges/fulfillment-dispatch-postgres.mjs");
  const actions = read(
    "app/workspaces/management/campgrounds/service-fulfillment/actions.ts",
  );
  const page = read(
    "app/workspaces/management/campgrounds/service-fulfillment/page.tsx",
  );
  assert.match(source, /set local role icamp_app/u);
  assert.match(source, /icamp\.user_id/u);
  assert.match(source, /reservation\.modify/u);
  assert.match(source, /staff\.manage/u);
  assert.match(source, /d\.campground_id = \$1/u);
  assert.match(source, /for share of j, a/u);
  assert.match(source, /appendAuditEvent/u);
  assert.doesNotMatch(
    source,
    /sendSms|sendEmail|sendGuest|update public\.reservations/iu,
  );
  assert.match(actions, /acknowledgeFulfillmentDispatchAction/u);
  assert.match(actions, /dispatchFulfillmentAction/u);
  assert.match(page, /Record my acknowledgement/u);
  assert.match(page, /Record dispatch handoff/u);
  assert.match(page, /No worker notification/u);
});

test("Build 238 SQL enforces immutable tenant-bound dispatch and current worker acknowledgement", () => {
  const migration = read(
    "database/migrations/0223_build238_fulfillment_dispatch_sla.sql",
  );
  const verification = read(
    "database/verify/0223_build238_fulfillment_dispatch_sla.sql",
  );
  assert.match(migration, /force row level security/iu);
  assert.match(
    migration,
    /assigned_user_id = icamp_private\.request_user_id\(\)/u,
  );
  assert.match(migration, /assigned_user_id <> new\.acknowledged_by_user_id/u);
  assert.match(
    migration,
    /current_dispatch\.job_row_version <> current_dispatch\.current_job_version/u,
  );
  assert.match(migration, /dispatch_id uuid not null unique/u);
  assert.match(
    migration,
    /unique \(campground_id, job_id, assignment_row_version, job_row_version\)/u,
  );
  assert.match(migration, /on delete restrict/u);
  assert.doesNotMatch(migration, /grant\s+.*update|grant\s+.*delete/iu);
  assert.match(verification, /append-only/u);
  assert.match(verification, /forced tenant isolation missing/u);
});
