import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeRecurrenceReview,
  classifyPortfolio,
  summarizePortfolio,
} from "../lib/permanent-unit-portfolio/core.mjs";
const id = () => randomUUID();
test("recurrence requires repeated evidence and a bounded independent disposition", () => {
  const base = {
    id: id(),
    consentId: id(),
    latestExceptionEventId: id(),
    reasonCode: "delivery_failure",
    observedReasonHoldCount: 2,
    observedEscalationCount: 1,
    reviewDisposition: "recommend_owner_review",
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    evidenceReference: "SYNTH-PORTFOLIO-100",
    note: "Synthetic repeated delivery evidence",
  };
  assert.equal(normalizeRecurrenceReview(base).reasonCode, "delivery_failure");
  assert.throws(
    () => normalizeRecurrenceReview({ ...base, observedReasonHoldCount: 1 }),
    /repeated event history/,
  );
  assert.throws(
    () =>
      normalizeRecurrenceReview({ ...base, reviewDisposition: "approve_loan" }),
    /Unsupported recurrence/,
  );
  assert.throws(
    () => normalizeRecurrenceReview({ ...base, nextReviewAt: "2020-01-01" }),
    /next 90 days/,
  );
});
test("portfolio never merges active hold, owner-task completion or recurrence states", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const cases = [
    {
      latest_event_type: "hold",
      open_tasks: 0,
      overdue_tasks: 0,
      reasons: [
        {
          reason_code: "delivery_failure",
          hold_count: 2,
          next_review_at: null,
        },
      ],
    },
    {
      latest_event_type: "clear",
      open_tasks: 1,
      overdue_tasks: 1,
      reasons: [],
    },
    { latest_event_type: null, open_tasks: 0, overdue_tasks: 0, reasons: [] },
  ];
  assert.equal(classifyPortfolio(cases[0], now).status, "active_hold");
  assert.equal(classifyPortfolio(cases[1], now).status, "owner_followup");
  assert.equal(classifyPortfolio(cases[0], now).staleReview, true);
  assert.deepEqual(summarizePortfolio(cases, now), {
    consents: 3,
    activeHolds: 1,
    openOwnerTasks: 1,
    overdueOwnerTasks: 1,
    recurringConsents: 1,
    pendingRecurrenceReviews: 1,
  });
});
test("DB enforces append-only private scope, current evidence and independent reviews", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0132_finance_portfolio_recurrence.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "winterization_append_only",
    "new.latest_exception_event_id is distinct from latest_event.id",
    "new.observed_reason_hold_count<>count_holds",
    "last_review.reviewed_by_user_id",
    "pg_advisory_xact_lock",
    "finance_recurrence_review_guard",
  ])
    assert.ok(sql.includes(token), token);
});
