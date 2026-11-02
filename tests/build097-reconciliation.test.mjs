import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeEvidenceReconciliation,
  normalizeClosureReview,
} from "../lib/permanent-unit-reconciliation/core.mjs";
const id = () => randomUUID();
test("reconciliation pins exact disclosure, receipt, acknowledgement and hold snapshot", () => {
  const v = {
    id: id(),
    consentId: id(),
    receiptId: id(),
    acknowledgementId: id(),
    disclosureVersionId: id(),
    disclosureSha256: "a".repeat(64),
    lastExceptionEventId: id(),
    completeness: "evidence_complete",
    reconciliationReference: "SYNTH-COMPARE-097",
    note: "Synthetic internal evidence reconciliation",
  };
  assert.equal(
    normalizeEvidenceReconciliation(v).disclosureSha256,
    "a".repeat(64),
  );
  assert.throws(
    () =>
      normalizeEvidenceReconciliation({ ...v, disclosureSha256: "invalid" }),
    /SHA-256/u,
  );
  assert.throws(
    () =>
      normalizeEvidenceReconciliation({ ...v, completeness: "loan_approved" }),
    /complete or require follow-up/u,
  );
});
test("incomplete evidence permits null receipt and acknowledgement pointers only", () => {
  const v = {
    id: id(),
    consentId: id(),
    receiptId: "",
    acknowledgementId: "",
    disclosureVersionId: id(),
    disclosureSha256: "b".repeat(64),
    lastExceptionEventId: "",
    completeness: "needs_followup",
    reconciliationReference: "SYNTH-FOLLOWUP-097",
    note: "Synthetic missing proof of receipt",
  };
  assert.equal(normalizeEvidenceReconciliation(v).receiptId, null);
  assert.equal(normalizeEvidenceReconciliation(v).lastExceptionEventId, null);
});
test("closure review cannot issue financial products or accept legal agreements", () => {
  const v = {
    id: id(),
    reconciliationId: id(),
    decision: "closed_internal_evidence",
    reviewReference: "SYNTH-REVIEW-097",
    note: "Administrative evidence closure only",
  };
  assert.equal(normalizeClosureReview(v).decision, "closed_internal_evidence");
  assert.throws(
    () => normalizeClosureReview({ ...v, decision: "signed_loan" }),
    /internal evidence or return it/u,
  );
});
test("SQL enforces source lineage, RLS and independent current closure", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0129_finance_delivery_evidence_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const part of [
    "force row level security",
    "winterization_append_only",
    "disclosure_sha256",
    "last_exception_event_id",
    "ready_for_manual_handoff",
    "reviewed_by_user_id in",
    "closed_internal_evidence",
    "pg_advisory_xact_lock",
  ])
    assert.ok(sql.includes(part), part);
});
