import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  summarizeStaffLoad,
  validateExceptionReview,
  validateStaffAssignment,
} from "../lib/booking-charges/fulfillment-staff-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workerId = "12345678-1234-4567-89ab-123456789abc";

test("Build 236 assignment input requires valid worker IDs and optimistic versions", () => {
  assert.deepEqual(
    validateStaffAssignment({
      assignedUserId: workerId,
      assignmentNote: "  Bring two carts ",
      expectedJobVersion: "4",
      expectedAssignmentVersion: "0",
    }),
    {
      assignedUserId: workerId,
      assignmentNote: "Bring two carts",
      expectedJobVersion: 4,
      expectedAssignmentVersion: 0,
    },
  );
  assert.equal(
    validateStaffAssignment({
      assignedUserId: "",
      assignmentNote: "",
      expectedJobVersion: 5,
      expectedAssignmentVersion: 2,
    }).assignedUserId,
    null,
  );
  for (const assignedUserId of ["../../admin", "x", "-1", " ".repeat(20)]) {
    if (!assignedUserId.trim()) continue;
    assert.throws(() =>
      validateStaffAssignment({
        assignedUserId,
        assignmentNote: "",
        expectedJobVersion: 1,
        expectedAssignmentVersion: 0,
      }),
    );
  }
  for (const version of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() =>
      validateStaffAssignment({
        assignedUserId: workerId,
        assignmentNote: "",
        expectedJobVersion: 1,
        expectedAssignmentVersion: version,
      }),
    );
  }
  assert.throws(() =>
    validateStaffAssignment({
      assignedUserId: workerId,
      assignmentNote: "a".repeat(301),
      expectedJobVersion: 1,
      expectedAssignmentVersion: 0,
    }),
  );
});

test("Build 236 reviews are explicit decisions with mandatory explanations", () => {
  assert.deepEqual(
    validateExceptionReview({
      reviewState: "follow_up_required",
      reviewNote: "  Cooler replacement required  ",
      expectedJobVersion: "3",
    }),
    {
      reviewState: "follow_up_required",
      reviewNote: "Cooler replacement required",
      expectedJobVersion: 3,
    },
  );
  for (const state of ["approved", "resolved", "", "completed"]) {
    assert.throws(() =>
      validateExceptionReview({
        reviewState: state,
        reviewNote: "Recheck schedule",
        expectedJobVersion: 3,
      }),
    );
  }
  for (const note of ["", " ", "x".repeat(501)]) {
    assert.throws(() =>
      validateExceptionReview({
        reviewState: "acknowledged",
        reviewNote: note,
        expectedJobVersion: 3,
      }),
    );
  }
});

test("Build 236 workload excludes completed work, retains unassigned and former-worker load", () => {
  const staff = [{ userId: workerId, label: "worker@camp.test" }];
  const workload = summarizeStaffLoad(
    [
      { assignedUserId: workerId, quantity: 2, jobState: "scheduled" },
      { assignedUserId: workerId, quantity: 1, jobState: "blocked" },
      { assignedUserId: null, quantity: 3, jobState: "queued" },
      { assignedUserId: "former", quantity: 2, jobState: "in_progress" },
      { assignedUserId: workerId, quantity: 20, jobState: "completed" },
    ],
    staff,
  );
  assert.deepEqual(workload, [
    {
      userId: workerId,
      label: "worker@camp.test",
      activeJobs: 2,
      units: 3,
      blockedJobs: 1,
    },
    {
      userId: "former",
      label: "Former or unavailable staff member",
      activeJobs: 1,
      units: 2,
      blockedJobs: 0,
    },
    {
      userId: null,
      label: "Unassigned",
      activeJobs: 1,
      units: 3,
      blockedJobs: 0,
    },
  ]);
});

test("Build 236 assignment and exception writes remain supervisor-gated, scoped and auditable", () => {
  const pg = read("lib/booking-charges/fulfillment-postgres.mjs");
  const ui = read(
    "app/workspaces/management/campgrounds/service-fulfillment/page.tsx",
  );
  const actions = read(
    "app/workspaces/management/campgrounds/service-fulfillment/actions.ts",
  );
  const migration = read(
    "database/migrations/0221_build236_staff_fulfillment_review.sql",
  );
  const verification = read(
    "database/verify/0221_build236_staff_fulfillment_review.sql",
  );
  assert.match(
    pg,
    /hasCampgroundPermission\(userId, campgroundId, "staff\.manage"\)/u,
  );
  assert.match(pg, /for update of j/u);
  assert.match(pg, /Number\(before\.assignment_version \?\? 0\)/u);
  assert.match(pg, /blocked_row_version = j\.row_version/u);
  assert.match(pg, /where j\.campground_id = \$1/u);
  assert.match(pg, /appendAuditEvent/u);
  assert.match(pg, /count\(\*\) filter \(where j\.job_state = 'blocked'\)/u);
  assert.match(ui, /Staff load and assignment coverage/u);
  assert.match(ui, /Supervisor exception review/u);
  assert.match(ui, /Reviews are retained with the blocked task version/u);
  assert.match(ui, /canManageStaff=\{queue\.canManageStaff\}/u);
  assert.match(
    actions,
    /requireCampgroundPermission\(\s*campgroundId,\s*"staff\.manage"/u,
  );
  assert.match(migration, /force row level security/gu);
  assert.match(migration, /assigned worker must be active/iu);
  assert.match(migration, /row\(old\.organization_id, old\.campground_id/u);
  assert.match(migration, /on delete restrict/gu);
  assert.match(
    migration,
    /blocked_row_version = j\.row_version|current_job\.row_version <> new\.blocked_row_version/u,
  );
  assert.doesNotMatch(
    migration,
    /grant.*delete on public\.service_fulfillment_exception_reviews/iu,
  );
  assert.match(verification, /FORCE RLS missing/u);
  assert.match(verification, /immutable history/u);
});
