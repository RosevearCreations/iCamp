import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeFollowupTask,
  normalizeFollowupEvidence,
  normalizeFollowupReassessment,
  normalizeEscalationClosure,
} from "../lib/permanent-unit-followup/core.mjs";
const id = () => randomUUID();
test("owner assignment requires bounded future due date and source-linked plan", () => {
  const base = {
    id: id(),
    escalationId: id(),
    ownerResponseId: id(),
    assignedOwnerUserId: id(),
    taskReference: "SYNTH-TASK-099",
    actionPlan: "Manually review referenced evidence",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  };
  assert.equal(normalizeFollowupTask(base).taskReference, "SYNTH-TASK-099");
  assert.throws(
    () => normalizeFollowupTask({ ...base, dueAt: "2020-01-01" }),
    /within 90 days/,
  );
  assert.throws(
    () => normalizeFollowupTask({ ...base, actionPlan: "short" }),
    /12–800/,
  );
});
test("progress, reassessment and closure have finite non-lending decisions", () => {
  const base = {
    id: id(),
    taskId: id(),
    evidenceReference: "SYNTH-EVIDENCE-099",
    note: "Synthetic operator-only test evidence",
  };
  assert.equal(
    normalizeFollowupEvidence({ ...base, evidenceKind: "blocked" })
      .evidenceKind,
    "blocked",
  );
  assert.throws(
    () => normalizeFollowupEvidence({ ...base, evidenceKind: "approve_loan" }),
    /Invalid follow-up/,
  );
  assert.equal(
    normalizeFollowupReassessment({
      ...base,
      evidenceId: id(),
      reassessment: "continue_followup",
    }).reassessment,
    "continue_followup",
  );
  assert.throws(
    () =>
      normalizeFollowupReassessment({
        ...base,
        evidenceId: id(),
        reassessment: "clear_hold",
      }),
    /Invalid independent/,
  );
  assert.equal(
    normalizeEscalationClosure({
      ...base,
      reassessmentId: id(),
      outcome: "administrative_followup_complete",
    }).outcome,
    "administrative_followup_complete",
  );
  assert.throws(
    () =>
      normalizeEscalationClosure({
        ...base,
        reassessmentId: id(),
        outcome: "approved_credit",
      }),
    /Invalid administrative/,
  );
});
test("migration pins independent guard checks with private immutable ledgers", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0131_finance_owner_followup_continuity.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "winterization_append_only",
    "accepted_followup",
    "assigned_owner_user_id",
    "reassessed_by_user_id",
    "latest_rev.id",
    "pg_advisory_xact_lock",
    "finance_escalation_closure_guard",
  ])
    assert.ok(sql.includes(token), token);
});
