import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeClosureOwnerDecision,
  classifyClosureOwnerDecision,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
const now = new Date("2026-10-26T12:00:00Z");
const pair = {
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
};
const input = {
  id: "d4444444-4444-4444-8444-444444444444",
  closureRecheckId: "c3333333-3333-4333-8333-333333333333",
  ...pair,
  decisionKind: "keep_exception_open",
  nextDueAt: "2026-11-01",
  evidenceReference: "Owner exception evidence 81",
  decisionNote: "Owner will revisit the independently held exception.",
};
test("Build 119 validates owner decisions, UTC bounds and acknowledgment dates", () => {
  assert.equal(
    normalizeClosureOwnerDecision(input, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeClosureOwnerDecision(
        { ...input, decisionKind: "auto_release" },
        now,
      ),
    /Unknown/,
  );
  assert.throws(
    () =>
      normalizeClosureOwnerDecision({ ...input, nextDueAt: "2026-10-20" }, now),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeClosureOwnerDecision(
        { ...input, decisionKind: "acknowledge_audit_closure" },
        now,
      ),
    /cannot schedule/,
  );
  assert.throws(
    () =>
      normalizeClosureOwnerDecision(
        { ...input, targetCampgroundId: pair.sourceCampgroundId },
        now,
      ),
    /different/,
  );
});
test("Build 119 distinguishes aging, pending follow-ups, overdue, and acknowledgments", () => {
  assert.equal(
    classifyClosureOwnerDecision({ rechecked_at: "2026-09-01" }, null, now),
    "awaiting_owner_30_plus",
  );
  assert.equal(
    classifyClosureOwnerDecision({ rechecked_at: "2026-10-25" }, null, now),
    "awaiting_owner",
  );
  assert.equal(
    classifyClosureOwnerDecision(
      {},
      { decision_kind: "keep_exception_open", next_due_at: "2026-11-01" },
      now,
    ),
    "owner_followup_pending",
  );
  assert.equal(
    classifyClosureOwnerDecision(
      {},
      { decision_kind: "request_evidence", next_due_at: "2026-10-20" },
      now,
    ),
    "overdue",
  );
  assert.equal(
    classifyClosureOwnerDecision(
      {},
      { decision_kind: "manual_escalation", next_due_at: "2026-09-01" },
      now,
    ),
    "overdue_30_plus",
  );
  assert.equal(
    classifyClosureOwnerDecision(
      {},
      { decision_kind: "acknowledge_audit_closure" },
      now,
    ),
    "audit_acknowledged",
  );
});
test("Build 119 RLS, immutable owner decisions and independent actor separation", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0149_independent_closure_owner_followup_aging.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const s of [
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "decided_by_user_id=recheck.rechecked_by_user_id",
    "acknowledge_audit_closure",
    "independent_audit_closed",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(s), s);
});
