import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  arrivalReadiness,
  normalizeArrivalPlan,
  normalizeStaffArrivalReview,
} from "../lib/arrival-planner/core.mjs";

const valid = {
  state: "submitted",
  expectedArrivalTime: "16:45",
  arrivalMode: "personal_vehicle",
  expectedVehicleCount: "1",
  expectedVisitorCount: "0",
  documentPreparation: "will_bring",
  rulesReviewed: true,
  assistanceRequested: false,
  assistanceNote: "Sensitive details should not be saved without consent.",
};

test("Build177 stores only consented arrival assistance details", () => {
  const plan = normalizeArrivalPlan(valid);
  assert.equal(plan.state, "submitted");
  assert.equal(plan.expectedArrivalTime, "16:45");
  assert.equal(plan.expectedVehicleCount, 1);
  assert.equal(plan.expectedVisitorCount, 0);
  assert.equal(plan.assistanceRequested, false);
  assert.equal(plan.assistanceNote, null);
  const withHelp = normalizeArrivalPlan({
    ...valid,
    assistanceRequested: true,
    assistanceNote: " Step-free path to the office, please. ",
  });
  assert.equal(
    withHelp.assistanceNote,
    "Step-free path to the office, please.",
  );
  assert.throws(() =>
    normalizeArrivalPlan({
      ...valid,
      assistanceNote: "a".repeat(301),
      assistanceRequested: true,
    }),
  );
});

test("Build177 draft is flexible; staff submission is complete or denied", () => {
  assert.equal(
    normalizeArrivalPlan({
      state: "draft",
      arrivalMode: "unspecified",
      documentPreparation: "not_reviewed",
    }).expectedArrivalTime,
    null,
  );
  for (const change of [
    { expectedArrivalTime: "24:00" },
    { expectedArrivalTime: "2026-11-01" },
    { expectedVehicleCount: "-1" },
    { expectedVisitorCount: "101" },
    { documentPreparation: "not_reviewed" },
    { rulesReviewed: false },
    { expectedArrivalTime: "" },
    { expectedVehicleCount: "" },
    { expectedVisitorCount: "" },
    { arrivalMode: "spacecraft" },
    { state: "checked_in" },
  ]) {
    assert.throws(
      () => normalizeArrivalPlan({ ...valid, ...change }),
      JSON.stringify(change),
    );
  }
});

test("Build177 staff receipts require reason for follow-up and never authorize access", () => {
  assert.deepEqual(
    normalizeStaffArrivalReview({ outcome: "reviewed", note: "" }),
    {
      outcome: "reviewed",
      note: null,
    },
  );
  assert.throws(() =>
    normalizeStaffArrivalReview({ outcome: "follow_up_needed", note: "short" }),
  );
  assert.throws(() =>
    normalizeStaffArrivalReview({ outcome: "checked_in", note: "wrong" }),
  );
  const stay = {
    reservation: {
      status: "confirmed",
      departureDate: "2026-11-12",
      campgroundLocalDate: "2026-11-01",
      rowVersion: 3,
    },
    contact: { name: "Sample Camper", email: "sample@example.test" },
    rules: { currentCheckInTime: "15:00" },
    documents: { confirmationNumber: "CONF-123" },
    party: { vehicles: 2, visitors: 0 },
    payment: { outstandingCents: 5000, financialReviewRequired: false },
  };
  const plan = {
    ...normalizeArrivalPlan({ ...valid, expectedArrivalTime: "13:00" }),
    id: "plan",
    reservationId: "reservation",
    campgroundId: "campground",
    userAccountId: "guest",
    sourceReservationVersion: 3,
    rowVersion: 2,
    submittedAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
  };
  const review = {
    id: "review",
    outcome: "reviewed",
    note: null,
    reviewedPlanVersion: 2,
    reviewedReservationVersion: 3,
    reviewedAt: "2026-11-01T13:00:00Z",
  };
  const ready = arrivalReadiness({ stay, plan, review });
  assert.equal(ready.completed, 5);
  assert.equal(ready.reviewCurrent, true);
  assert.equal(ready.checkInAuthorized, false);
  assert.equal(ready.differences.length, 3);
  assert.equal(
    arrivalReadiness({ stay, plan: { ...plan, rowVersion: 3 }, review })
      .reviewCurrent,
    false,
  );
  const staleSource = arrivalReadiness({
    stay,
    plan: { ...plan, sourceReservationVersion: 2 },
    review,
  });
  assert.equal(staleSource.reviewCurrent, false);
  assert.match(staleSource.differences[0], /Reservation changed/u);
  assert.equal(
    arrivalReadiness({
      stay: {
        ...stay,
        reservation: { ...stay.reservation, status: "checked_in" },
      },
      plan,
      review,
    }).open,
    false,
  );
});

test("Build177 migration keeps owner and staff scopes RLS-only", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0188_build177_arrival_plans_and_staff_review.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0188_build177_arrival_plans_and_staff_review.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of ["guest_arrival_plans", "guest_arrival_staff_reviews"]) {
    assert.match(migration, new RegExp(`create table public\\.${name}`, "u"));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${name} force row level security`, "u"),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on public\\.guest_arrival_plans,public\\.guest_arrival_staff_reviews from public`,
        "u",
      ),
    );
  }
  assert.match(migration, /guest_arrival_reviews_plan_owner_fk/u);
  assert.match(migration, /source_reservation_version bigint/u);
  assert.match(migration, /reviewed_plan_version bigint/u);
  assert.match(
    migration,
    /icamp_private\.has_campground_permission\(campground_id,'reservation\.modify'\)/u,
  );
  assert.match(verify, /has_table_privilege\('anon'/u);
  const repo = readFileSync(
    new URL("../lib/arrival-planner/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(repo, /set local role icamp_app/u);
  assert.match(repo, /r\.guest_user_id=\$2/u);
  assert.match(repo, /source_reservation_version/u);
  assert.doesNotMatch(
    repo,
    /update public\.reservations|insert into public\.reservation_check_ins|provisionReservationCredential|sendSms|createPayment/u,
  );
  const guest = readFileSync(
    new URL("../app/guest/arrival-planner/page.tsx", import.meta.url),
    "utf8",
  );
  const staff = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/reservations/arrival-readiness/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(guest, /requireSignedIn/u);
  assert.match(guest, /SMS,\s+email or gate command is sent/u);
  assert.match(staff, /requireStaff/u);
  assert.match(staff, /reviewCurrent/u);
});
