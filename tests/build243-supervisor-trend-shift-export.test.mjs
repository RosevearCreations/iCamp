import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateShiftHandoffRequest,
  validateShiftHandoffDecision,
  buildRecoveryTrendAnalytics,
  buildAuthorizedSourceReviewExport,
} from "../lib/booking-charges/fulfillment-shift-core.mjs";

const id = "11111111-2222-4333-8444-555555555555";
const other = "11111111-2222-4333-8444-666666666666";
const third = "11111111-2222-4333-8444-777777777777";
const source = readFileSync(
  new URL(
    "../database/migrations/0227_build243_fulfillment_shift_handoff.sql",
    import.meta.url,
  ),
  "utf8",
);
const route = readFileSync(
  new URL(
    "../app/api/management/fulfillment-supervisor/export/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL(
    "../lib/booking-charges/fulfillment-shift-postgres.mjs",
    import.meta.url,
  ),
  "utf8",
);

test("shift handoff request rejects malformed evidence, target and empty notes", () => {
  assert.throws(() =>
    validateShiftHandoffRequest({
      dispatchId: "x",
      ownerEventId: other,
      targetUserId: third,
      note: "valid note",
    }),
  );
  assert.throws(() =>
    validateShiftHandoffRequest({
      dispatchId: id,
      ownerEventId: other,
      targetUserId: "stranger",
      note: "valid note",
    }),
  );
  assert.throws(() =>
    validateShiftHandoffRequest({
      dispatchId: id,
      ownerEventId: other,
      targetUserId: third,
      note: "no",
    }),
  );
  const result = validateShiftHandoffRequest({
    dispatchId: id,
    ownerEventId: other,
    targetUserId: third,
    note: "  Next   supervisor  ",
  });
  assert.equal(result.note, "Next supervisor");
});

test("receiving supervisor explicitly decides accept or decline", () => {
  assert.equal(
    validateShiftHandoffDecision({
      requestId: id,
      decision: "accept",
      note: "Take responsibility",
    }).decision,
    "accept",
  );
  assert.equal(
    validateShiftHandoffDecision({
      requestId: id,
      decision: "decline",
      note: "Shift not available",
    }).decision,
    "decline",
  );
  assert.throws(() =>
    validateShiftHandoffDecision({
      requestId: id,
      decision: "force_assign",
      note: "Force assignment",
    }),
  );
});

test("seven-day recovery uses UTC boundaries and source events only", () => {
  const result = buildRecoveryTrendAnalytics({
    asOf: "2026-11-11T16:00:00Z",
    days: 7,
    truncated: false,
    reviews: [
      {
        reviewedAt: "2026-11-11T01:10:00Z",
        reviewKind: "case_followup",
        decision: "followup_resolved",
      },
      {
        reviewedAt: "2026-11-11T02:00:00Z",
        reviewKind: "case_followup",
        decision: "escalation_requested",
      },
      {
        reviewedAt: "2026-11-10T22:00:00Z",
        reviewKind: "field_device",
        decision: "blocker_escalated",
      },
      {
        reviewedAt: "2026-11-03T18:00:00Z",
        reviewKind: "case_followup",
        decision: "followup_resolved",
      },
    ],
    handoffs: [
      { recordedAt: "2026-11-11T08:00:00Z", eventKind: "request" },
      { recordedAt: "2026-11-11T09:00:00Z", eventKind: "accept" },
      { recordedAt: "2026-11-01T09:00:00Z", eventKind: "decline" },
    ],
  });
  assert.equal(result.buckets.length, 7);
  assert.equal(result.buckets[0].date, "2026-11-05");
  assert.deepEqual(result.totals, {
    followupsResolved: 1,
    escalations: 2,
    deviceBlockers: 1,
    handoffRequests: 1,
    handoffAccepted: 1,
    handoffDeclined: 0,
  });
  assert.equal(result.independentAcceptance, "HOLD");
  assert.throws(() =>
    buildRecoveryTrendAnalytics({
      asOf: "bad",
      days: 7,
      reviews: [],
      handoffs: [],
    }),
  );
});

test("authorized exports never include guest identities or private free-text notes", () => {
  const trend = buildRecoveryTrendAnalytics({
    asOf: "2026-11-11T12:00:00Z",
    reviews: [],
    handoffs: [],
    truncated: true,
  });
  const values = {
    campgroundId: id,
    generatedAt: "2026-11-11T12:00:00Z",
    sourceRevision: null,
    trend,
    truncated: true,
    reviews: [
      {
        id,
        dispatchId: other,
        reviewKind: "case_followup",
        decision: "supervisor_recheck",
        reviewedAt: "2026-11-11T12:00:00Z",
        note: "private note guest name",
      },
    ],
    handoffs: [
      {
        id: other,
        dispatchId: third,
        requestId: id,
        eventKind: "request",
        recordedAt: "2026-11-11T12:00:00Z",
        note: "private note guest name",
        outgoingUserId: id,
        incomingUserId: other,
      },
    ],
  };
  const summary = buildAuthorizedSourceReviewExport({
    ...values,
    format: "trend",
  });
  assert.equal(summary.format, "trend");
  assert.equal(summary.truncated, true);
  assert.equal("reviews" in summary, false);
  const cases = buildAuthorizedSourceReviewExport({
    ...values,
    format: "case_history",
  });
  assert.equal(cases.reviews.length, 1);
  assert.equal(cases.handoffs.length, 1);
  assert.equal(JSON.stringify(cases).includes("private note"), false);
  assert.equal(JSON.stringify(cases).includes("outgoingUserId"), false);
  assert.equal(cases.masterConnection, "HOLD");
  assert.throws(() =>
    buildAuthorizedSourceReviewExport({ ...values, format: "master" }),
  );
});

test("append-only handoff source requires authenticated reviewer, current owner and separate recipient", () => {
  assert.match(source, /force row level security/i);
  assert.match(source, /event_kind='request' and request_id is null/i);
  assert.match(source, /outgoing_user_id <> incoming_user_id/i);
  assert.match(
    source,
    /current_owner\.claimed_by_user_id is distinct from new\.recorded_by_user_id/i,
  );
  assert.match(
    source,
    /new\.recorded_by_user_id is distinct from new\.incoming_user_id/i,
  );
  assert.match(source, /is_fulfillment_supervisor/i);
  assert.match(source, /unique \(request_id\)/i);
  assert.doesNotMatch(source, /\bgrant\s+(update|delete)\b/i);
  assert.match(
    service,
    /insert into public\.service_fulfillment_case_owner_events/i,
  );
  assert.match(service, /if \(decision\.decision === "accept"\)/i);
  assert.match(service, /await client\.query\("rollback"\)/i);
});

test("private export retains staff session and campground permission checks", () => {
  assert.match(route, /getCurrentSession/);
  assert.match(route, /staff\.manage/);
  assert.match(route, /reservation\.modify/);
  assert.match(route, /format === "legacy"/);
  assert.match(route, /"trend", "case_history"/);
  assert.match(route, /UNSIGNED_CAMPGROUND_PRIVATE_SNAPSHOT/);
  assert.match(route, /no-store/);
});
