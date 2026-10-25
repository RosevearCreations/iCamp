import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ageBand,
  normalizeExceptionReview,
  normalizeOwnerEscalation,
  normalizeOwnerResponse,
} from "../lib/permanent-unit-ageing/core.mjs";
const id = () => randomUUID();
test("exception ageing derives UTC threshold bands from evidence timestamps", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  assert.equal(ageBand("2026-10-25T11:00:00Z", now), "within_24h");
  assert.equal(ageBand("2026-10-24T12:00:00Z", now), "overdue_24h");
  assert.equal(ageBand("2026-10-22T12:00:00Z", now), "critical_72h");
  assert.equal(ageBand("not-a-date", now), "unknown");
});
test("review pins exception and enforces independent bounded future follow-up", () => {
  const base = {
    id: id(),
    consentId: id(),
    exceptionEventId: id(),
    reconciliationId: id(),
    observationState: "open_hold",
    reviewDecision: "request_owner_escalation",
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    evidenceReference: "SYNTH-REVIEW-098",
    note: "Synthetic open hold needs follow-up",
  };
  assert.equal(
    normalizeExceptionReview(base).reviewDecision,
    "request_owner_escalation",
  );
  assert.throws(
    () =>
      normalizeExceptionReview({
        ...base,
        nextReviewAt: "2020-01-01T00:00:00Z",
      }),
    /future date/u,
  );
  assert.throws(
    () =>
      normalizeExceptionReview({
        ...base,
        observationState: "cleared_history",
        reviewDecision: "recommend_manual_clearance",
      }),
    /active hold/u,
  );
});
test("owner escalation and acknowledgement are never credit/contract actions", () => {
  const v = {
    id: id(),
    exceptionReviewId: id(),
    targetOwnerUserId: id(),
    priority: "urgent",
    escalationReference: "SYNTH-ESCALATE-098",
    requestedAction: "Review exception with staff only",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  };
  assert.equal(normalizeOwnerEscalation(v).priority, "urgent");
  assert.throws(
    () => normalizeOwnerEscalation({ ...v, priority: "issue_loan" }),
    /standard, urgent or critical/u,
  );
  assert.equal(
    normalizeOwnerResponse({
      id: id(),
      escalationId: id(),
      response: "accepted_followup",
      evidenceReference: "SYNTH-OWNER-098",
      note: "Owner accepts the manual follow-up",
    }).response,
    "accepted_followup",
  );
  assert.throws(
    () =>
      normalizeOwnerResponse({
        id: id(),
        escalationId: id(),
        response: "loan_approved",
        evidenceReference: "SYNTH-OWNER-098",
        note: "No credit authority is present",
      }),
    /follow-up or return/u,
  );
});
test("private SQL enforces RLS, event lineage, segregation and append-only records", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0130_finance_delivery_exception_ageing.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "exception_event_id is distinct from latest.id",
    "previous_review.reviewed_by_user_id",
    "target_owner_user_id",
    "finance_owner_response_guard",
  ])
    assert.ok(sql.includes(token), token);
});
