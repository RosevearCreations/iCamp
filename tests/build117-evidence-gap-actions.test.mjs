import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyEvidenceGap,
  normalizeEvidenceGapAction,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00Z");
const raw = {
  id: "d4444444-4444-4444-8444-444444444444",
  reassessmentId: "c3333333-3333-4333-8333-333333333333",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  actionKind: "evidence_requested",
  nextDueAt: "2026-11-01",
  evidenceReference: "Owner audit evidence 41",
  actionNote: "Please provide independent follow-up documentation.",
};
test("Build 117 owner actions require scoped evidence and bounded due dates", () => {
  assert.equal(
    normalizeEvidenceGapAction(raw, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeEvidenceGapAction({ ...raw, actionKind: "auto_release" }, now),
    /Unknown/,
  );
  assert.throws(
    () =>
      normalizeEvidenceGapAction(
        { ...raw, targetCampgroundId: raw.sourceCampgroundId },
        now,
      ),
    /different/,
  );
  assert.throws(
    () => normalizeEvidenceGapAction({ ...raw, nextDueAt: "2026-10-20" }, now),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeEvidenceGapAction(
        { ...raw, actionKind: "owner_reconciled" },
        now,
      ),
    /cannot schedule/,
  );
});
test("Build 117 gap aging never represents missing evidence as resolved", () => {
  assert.equal(
    classifyEvidenceGap({ assessed_at: "2026-09-01T00:00:00Z" }, null, now),
    "unreconciled_30_plus",
  );
  assert.equal(
    classifyEvidenceGap({ assessed_at: "2026-10-25T00:00:00Z" }, null, now),
    "unreconciled",
  );
  assert.equal(
    classifyEvidenceGap(
      {},
      { action_kind: "evidence_requested", next_due_at: "2026-10-20" },
      now,
    ),
    "overdue",
  );
  assert.equal(
    classifyEvidenceGap(
      {},
      { action_kind: "manual_escalation", next_due_at: "2026-09-01" },
      now,
    ),
    "overdue_30_plus",
  );
  assert.equal(
    classifyEvidenceGap({}, { action_kind: "evidence_submitted" }, now),
    "evidence_submitted",
  );
  assert.equal(
    classifyEvidenceGap({}, { action_kind: "owner_reconciled" }, now),
    "owner_reconciled",
  );
});
test("Build 117 database requires append-only RLS and evidence-before-reconciliation", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0147_independent_evidence_gap_owner_actions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "force row level security",
    "winterization_append_only",
    "owner_reconciled",
    "evidence_submitted",
    "assessed_by_user_id",
    "pg_advisory_xact_lock",
    "observed_continued_holds",
  ])
    assert.ok(sql.includes(invariant), invariant);
});
