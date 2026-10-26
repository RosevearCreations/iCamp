import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerReassessmentOutcome,
  normalizeOwnerOutcomeAcceptance,
} from "../lib/permanent-unit-owner-retention/outcomes-core.mjs";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const base = {
  id: a,
  reassessmentId: b,
  sourceCampgroundId: a,
  targetCampgroundId: b,
  outcomeKind: "closure_evidence_ready",
  evidenceReference: "internal-ref-001",
  outcomeNote: "Independent source records checked.",
};
test("valid follow-up and independent acceptance inputs", () => {
  assert.equal(
    normalizeOwnerReassessmentOutcome(base).outcomeKind,
    "closure_evidence_ready",
  );
  assert.equal(
    normalizeOwnerOutcomeAcceptance({
      ...base,
      outcomeId: b,
      acceptanceKind: "held",
      auditNote: "Evidence recheck required.",
    }).acceptanceKind,
    "held",
  );
});
test("forged pair, unknown disposition and sensitive notes rejected", () => {
  assert.throws(
    () => normalizeOwnerReassessmentOutcome({ ...base, targetCampgroundId: a }),
    /different/,
  );
  assert.throws(
    () =>
      normalizeOwnerReassessmentOutcome({
        ...base,
        outcomeKind: "force_close",
      }),
    /Unknown/,
  );
  assert.throws(
    () =>
      normalizeOwnerReassessmentOutcome({
        ...base,
        outcomeNote: "Contact abc@example.com for proof",
      }),
    /identifiers/,
  );
  assert.throws(
    () =>
      normalizeOwnerOutcomeAcceptance({
        ...base,
        outcomeId: b,
        acceptanceKind: "force_close",
        auditNote: "Independently reviewed.",
      }),
    /Unknown/,
  );
});
test("database enforces immutable dual-owner audit and source freshness", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0142_owner_reassessment_outcomes_acceptance.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const clause of [
    "force row level security",
    "owner_export_outcome_immutable",
    "owner_export_acceptance_immutable",
    "latest_reassessment",
    "latest_decision",
    "latest_outcome",
    "recorded_by_user_id",
    "reassessed_by_user_id",
    "new_count>0",
    "open_count>0",
    "109109",
  ])
    assert.ok(sql.includes(clause), `missing ${clause}`);
});
