import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeHandoffIndependentClosureAudit,
  classifyHandoffIndependentClosureStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const pair = {
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
};
const input = {
  id: "e6666666-6666-4666-8666-666666666666",
  handoffDecisionId: "f5555555-5555-4555-8555-555555555555",
  ...pair,
  auditKind: "request_evidence_reassessment",
  nextDueAt: "2026-11-01",
  evidenceReference: "Independent handoff evidence 122",
  auditNote:
    "Independently review the new owner escalation evidence before the next audit.",
};

test("Build 122 validates independent audit outcomes, ordered pairs and UTC dates", () => {
  assert.equal(
    normalizeHandoffIndependentClosureAudit(input, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, auditKind: "auto_release" },
        now,
      ),
    /Unknown independent/,
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, nextDueAt: "2026-10-20" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, nextDueAt: "2027-07-01" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, nextDueAt: "2026-11-31" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, auditKind: "independent_audit_closed" },
        now,
      ),
    /cannot schedule/,
  );
  assert.equal(
    normalizeHandoffIndependentClosureAudit(
      { ...input, auditKind: "independent_audit_closed", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeHandoffIndependentClosureAudit(
        { ...input, targetCampgroundId: pair.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 122 labels handoff aging, evidence reassessment and independent audit closure", () => {
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      { action_kind: "evidence_reconciled" },
      null,
      now,
    ),
    "awaiting_independent_evidence_audit",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      { action_kind: "escalation_handoff_accepted", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "handoff_overdue_30_plus",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      { action_kind: "monitoring_continues", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "handoff_overdue",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      { action_kind: "monitoring_continues", next_due_at: "2026-11-01" },
      null,
      now,
    ),
    "handoff_independent_audit_pending",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      {},
      { audit_kind: "manual_escalation" },
      now,
    ),
    "independently_escalated",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      {},
      { audit_kind: "request_evidence_reassessment" },
      now,
    ),
    "evidence_reassessment_requested",
  );
  assert.equal(
    classifyHandoffIndependentClosureStatus(
      {},
      { audit_kind: "independent_audit_closed" },
      now,
    ),
    "independent_audit_closed",
  );
});

test("Build 122 SQL guards independent actor separation, pair-wide closure, aging and RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0152_owner_handoff_independent_closure_audit.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const guard of [
    "handoff_decision_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "audited_by_user_id=handoff_record.acted_by_user_id",
    "audited_by_user_id=review_record.reviewed_by_user_id",
    "observed_handoff_days_overdue",
    "observed_other_open_handoffs",
    "observed_other_overdue_handoffs",
    "observed_other_escalation_handoffs",
    "observed_handoff_days_overdue>=30",
    "independent_audit_closed",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing invariant: ${guard}`);
  assert.ok(
    !/update public\.owner_export_independent_followup_owner_decisions/i.test(
      sql,
    ),
  );
});

test("Build 122 owner management UI includes age, audited evidence and closure gate", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordHandoffIndependentClosureAuditAction/);
  assert.match(page, /independent_audit_status/);
  assert.match(page, /observed_other_open_handoffs/);
  assert.match(page, /observed_other_escalation_handoffs/);
});
