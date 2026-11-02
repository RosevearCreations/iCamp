import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  assessShiftReadiness,
  normalizeShiftAvailability,
  normalizeShiftEvent,
  normalizeShiftHandoff,
  normalizeShiftPlan,
  normalizeShiftQualification,
  sensitiveDepartmentQualifications,
  shiftTimestamp,
} from "../lib/staff-shifts/core.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const id = (n) => `00000190-0000-4000-8000-${String(n).padStart(12, "0")}`;
const shift = {
  id: id(1),
  staffUserId: id(2),
  department: "aquatics",
  roleLabel: "Pool lead",
  startsAt: "2027-06-08T12:00:00Z",
  endsAt: "2027-06-08T20:00:00Z",
  assignmentNote: "Pool-side staffing and safety preparation note.",
};

test("Build190 shift inputs validate UTC and reject invalid duration and department", () => {
  assert.deepEqual(normalizeShiftPlan(shift), {
    ...shift,
    startsAt: "2027-06-08T12:00:00.000Z",
    endsAt: "2027-06-08T20:00:00.000Z",
  });
  assert.equal(
    shiftTimestamp("2027-06-08T12:00", "Start"),
    "2027-06-08T12:00:00.000Z",
  );
  assert.throws(
    () => shiftTimestamp("2027-06-08T12:00:00", "Start"),
    /valid UTC timestamp/,
  );
  assert.throws(
    () => normalizeShiftPlan({ ...shift, department: "billing" }),
    /department is invalid/,
  );
  assert.throws(
    () => normalizeShiftPlan({ ...shift, endsAt: "2027-06-09T16:00:00Z" }),
    /16 hours/,
  );
  assert.throws(
    () => normalizeShiftPlan({ ...shift, roleLabel: "x" }),
    /3–100/,
  );
});

test("Build190 qualification events require source-backed evidence with expiry", () => {
  assert.equal(sensitiveDepartmentQualifications.aquatics, "pool_lifeguard");
  assert.equal(
    sensitiveDepartmentQualifications.waterfront,
    "waterfront_monitor",
  );
  assert.equal(
    sensitiveDepartmentQualifications.equipment,
    "equipment_operator",
  );
  assert.equal(sensitiveDepartmentQualifications.food_service, "food_safety");
  const event = normalizeShiftQualification({
    id: id(3),
    staffUserId: id(2),
    qualificationKey: "pool_lifeguard",
    decision: "verify",
    sourceReference: "Certified certificate scan 1234",
    validUntil: "2027-07-01T00:00:00Z",
    reviewNote: "Independent manager reviewed original credential.",
  });
  assert.equal(event.validUntil, "2027-07-01T00:00:00.000Z");
  assert.equal(
    normalizeShiftQualification({ ...event, decision: "revoke" }).validUntil,
    null,
  );
  assert.throws(
    () => normalizeShiftQualification({ ...event, sourceReference: "none" }),
    /reference/,
  );
});

test("Build190 readiness distinguishes hard qualification conflicts and review workload flags", () => {
  const now = new Date("2027-06-01T12:00:00Z");
  const other = {
    ...shift,
    id: id(4),
    startsAt: "2027-06-08T21:00:00Z",
    endsAt: "2027-06-09T07:00:00Z",
  };
  const invalid = assessShiftReadiness(
    shift,
    [shift, other],
    [],
    [
      {
        staffUserId: id(2),
        startsAt: "2027-06-08T13:00:00Z",
        endsAt: "2027-06-08T15:00:00Z",
      },
    ],
    now,
  );
  assert.equal(invalid.ready, false);
  assert.deepEqual(
    invalid.flags.sort(),
    [
      "qualification_missing_or_expired",
      "availability_conflict",
      "short_rest_window",
    ].sort(),
  );
  const qualified = [
    {
      staffUserId: id(2),
      qualificationKey: "pool_lifeguard",
      decision: "verify",
      validUntil: "2027-07-01T00:00:00Z",
    },
  ];
  const ready = assessShiftReadiness(shift, [shift], qualified, [], now);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.flags, []);
  assert.equal(ready.weeklyHours, 8);
  const expired = assessShiftReadiness(
    shift,
    [shift],
    [{ ...qualified[0], validUntil: "2027-06-08T19:00:00Z" }],
    [],
    now,
  );
  assert.ok(expired.flags.includes("qualification_missing_or_expired"));
  const cancelled = assessShiftReadiness(
    { ...shift, cancelled: true },
    [shift],
    qualified,
    [],
    now,
  );
  assert.equal(cancelled.ready, false);
});

test("Build190 handoff and availability inputs preserve explicit source/receiver identity", () => {
  const availability = normalizeShiftAvailability({
    id: id(5),
    staffUserId: id(2),
    kind: "unavailable",
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    reason: "Staff reports they are unavailable.",
  });
  assert.equal(availability.clearsEventId, null);
  assert.equal(
    normalizeShiftAvailability({
      ...availability,
      id: id(6),
      kind: "clear",
      clearsEventId: id(5),
    }).clearsEventId,
    id(5),
  );
  assert.throws(
    () => normalizeShiftAvailability({ ...availability, kind: "clear" }),
    /Original unavailability ID/,
  );
  const handoff = normalizeShiftHandoff({
    id: id(7),
    fromShiftId: id(1),
    toShiftId: id(4),
    summary: "Completed safety checks with notes.",
    outstandingWork: "Drainage issue requires follow-up on next shift.",
    followUpRequired: true,
  });
  assert.equal(handoff.followUpRequired, true);
  assert.equal(handoff.toShiftId, id(4));
  assert.equal(
    normalizeShiftEvent({
      id: id(8),
      shiftId: id(4),
      handoffId: id(7),
      kind: "handoff_ack",
      reason: "I reviewed the incoming tasks and notes.",
    }).handoffId,
    id(7),
  );
  assert.throws(
    () =>
      normalizeShiftEvent({
        id: id(8),
        shiftId: id(4),
        kind: "handoff_ack",
        reason: "Incoming tasks were reviewed.",
      }),
    /Handoff ID/,
  );
});

test("Build190 SQL and UI enforce private immutability, authorization and independent acknowledgement", () => {
  const sql = read(
    "../database/migrations/0202_build190_staff_shift_readiness.sql",
  );
  const verify = read(
    "../database/verify/0202_build190_staff_shift_readiness.sql",
  );
  const service = read("../lib/staff-shifts/postgres.mjs");
  const page = read(
    "../app/workspaces/management/campgrounds/staff-shifts/page.tsx",
  );
  const lifecycle = read("../scripts/verify-build190-staff-readiness.mjs");
  assert.match(sql, /force row level security/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /guard_staff_shift_immutability/);
  assert.match(sql, /staff_user_id<>reviewed_by_user_id/);
  assert.match(sql, /actor<>target_staff/);
  assert.match(sql, /staff_shift_has_assignment/);
  assert.match(
    sql,
    /revoke all on function icamp_private\.guard_staff_shift_event\(\) from public/,
  );
  assert.doesNotMatch(sql, /grant[^;]*update[^;]*staff_shift_/i);
  assert.match(verify, /relforcerowsecurity/);
  assert.match(service, /set local role icamp_app/);
  assert.match(service, /appendAuditEvent/);
  assert.match(
    page,
    /receiving staff member alone can acknowledge|Acknowledge as receiving staff/i,
  );
  assert.match(page, /Billing and\s+Omnichannel remain HELD/);
  assert.match(lifecycle, /rollback/);
  assert.match(lifecycle, /Cross-campground staffing evidence leaked/);
});
