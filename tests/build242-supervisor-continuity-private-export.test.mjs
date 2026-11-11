import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSupervisorPrivateExport,
  validateSupervisorContinuityReview,
} from "../lib/booking-charges/fulfillment-continuity-core.mjs";

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const dispatchId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";

test("Build 242 validates source-linked follow-up and device review decisions", () => {
  const valid = validateSupervisorContinuityReview({
    dispatchId,
    subjectId: sourceId,
    previousReviewId: "",
    reviewKind: "case_followup",
    decision: "supervisor_recheck",
    note: "  Recheck after worker call.  ",
  });
  assert.equal(valid.previousReviewId, null);
  assert.equal(valid.note, "Recheck after worker call.");
  assert.equal(
    validateSupervisorContinuityReview({
      ...valid,
      reviewKind: "field_device",
      decision: "needs_retest",
    }).decision,
    "needs_retest",
  );
  for (const changes of [
    { reviewKind: "field_device", decision: "followup_resolved" },
    { reviewKind: "case_followup", decision: "accepted" },
    { dispatchId: "nope" },
    { subjectId: "nope" },
    { previousReviewId: "not-a-uuid" },
    { note: "no" },
  ]) {
    assert.throws(() =>
      validateSupervisorContinuityReview({ ...valid, ...changes }),
    );
  }
});

test("Build 242 private source export excludes identities, notes and any CONNECTED claim", () => {
  const exportValue = buildSupervisorPrivateExport({
    campgroundId: "33333333-3333-4333-8333-333333333333",
    asOf: "2026-11-11T00:00:00.000Z",
    sourceRevision: "a".repeat(40),
    supervisor: {
      ownership: [
        { id: sourceId, dispatchId, claimedByUserId: "worker-secret" },
      ],
      mobile: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          dispatchId,
          deviceKind: "mobile",
          outcome: "blocked",
          observation: "guest detail must stay private",
          reportedByUserId: "worker-secret",
        },
      ],
      truncated: false,
    },
    continuity: {
      caseFollowups: [
        {
          dispatchId,
          subjectId: sourceId,
          decision: "supervisor_recheck",
          note: "private note",
        },
      ],
      deviceReviews: [
        {
          dispatchId,
          subjectId: "44444444-4444-4444-8444-444444444444",
          decision: "needs_retest",
          note: "private note",
        },
      ],
      truncated: false,
    },
  });
  assert.equal(exportValue.cases.length, 1);
  assert.equal(exportValue.cases[0].caseReviewSourceCurrent, true);
  assert.equal(exportValue.cases[0].deviceReviewSourceCurrent, true);
  assert.equal(exportValue.independentDeviceAcceptance, "HOLD");
  assert.equal(exportValue.signedHealthReceipt, false);
  const data = JSON.stringify(exportValue);
  for (const forbidden of [
    "worker-secret",
    "guest detail",
    "private note",
    "CONNECTED",
  ]) {
    assert.doesNotMatch(data, new RegExp(forbidden, "u"));
  }
});

test("Build 242 migration is immutable and source/actor/tenant guarded", () => {
  const migration = read(
    "database/migrations/0226_build242_fulfillment_supervisor_continuity.sql",
  );
  const verify = read(
    "database/verify/0226_build242_fulfillment_supervisor_continuity.sql",
  );
  for (const token of [
    "force row level security",
    "guard_service_fulfillment_supervisor_review",
    "reviewed_by_user_id is distinct from icamp_private.request_user_id()",
    "current_actor is distinct from new.reviewed_by_user_id",
    "current_actor is not distinct from new.reviewed_by_user_id",
    "new.previous_event_id is distinct from latest_id",
    "create policy service_fulfillment_supervisor_review_read",
    "create policy service_fulfillment_supervisor_review_insert",
  ])
    assert.ok(migration.includes(token), token);
  assert.match(verify, /privilege_type in \('UPDATE','DELETE'\)/u);
  assert.doesNotMatch(
    migration,
    /grant\s+.*(?:update|delete).*\s+to icamp_app/iu,
  );
});

test("Build 242 UI is source-owned with separate decisions and fail-closed migration", () => {
  const page = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/page.tsx",
  );
  const actions = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/actions.ts",
  );
  const service = read(
    "lib/booking-charges/fulfillment-continuity-postgres.mjs",
  );
  assert.match(page, /Owner follow-up continuity/u);
  assert.match(page, /Supervisor device-report review/u);
  assert.match(page, /Claim current ownership first/u);
  assert.match(page, /continuity source migration is not verified/u);
  assert.match(actions, /requireCampgroundPermission/u);
  assert.match(actions, /"staff.manage"/u);
  assert.match(actions, /recordSupervisorContinuityReview/u);
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /appendAuditEvent/u);
  assert.match(service, /independentAcceptance: "HOLD"/u);
});

test("Build 242 export requires staff authorization, stays private and is not a master source receipt", () => {
  const route = read(
    "app/api/management/fulfillment-supervisor/export/route.ts",
  );
  for (const token of [
    'session.user.accountType !== "staff"',
    '"staff.manage"',
    '"reservation.modify"',
    '"Cache-Control": "private, no-store, max-age=0"',
    '"X-iCamp-Export-Trust": "UNSIGNED_CAMPGROUND_PRIVATE_SNAPSHOT"',
    '"X-iCamp-Export-SHA256"',
  ])
    assert.ok(route.includes(token), token);
  assert.doesNotMatch(
    route,
    /access-control-allow-origin|CONNECT(ed|ED)\s*:\s*true/iu,
  );
});
