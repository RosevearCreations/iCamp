import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  closingSteps,
  normalizeSaleApplication,
  normalizeSaleEvidence,
  normalizeSaleDecision,
  normalizeSaleHandoff,
  closingProgress,
} from "../lib/permanent-unit-transfer/core.mjs";
const id = () => randomUUID();
test("six exact closure domains, with defects never count as passing", () => {
  assert.equal(closingSteps.length, 6);
  const evidence = closingSteps.map((step) => ({
    step_key: step.key,
    outcome: "pass",
    source_reference: "SYNTH-092-EVIDENCE",
  }));
  assert.equal(closingProgress(evidence).ready, true);
  assert.equal(
    closingProgress([
      { ...evidence[0], outcome: "defect" },
      ...evidence.slice(1),
    ]).ready,
    false,
  );
  assert.equal(
    closingProgress(evidence, { decision: "approved" }, { id: id() }).recorded,
    true,
  );
});
test("buyer application is source-linked and scoped by UUID", () => {
  assert.equal(
    normalizeSaleApplication({
      id: id(),
      listingId: id(),
      inquiryId: id(),
      applicationReference: "SYNTH-092-APP",
      applicationNote: "Test buyer review source",
    }).applicationReference,
    "SYNTH-092-APP",
  );
  assert.throws(() => normalizeSaleApplication({ id: "bad" }), /UUID/u);
});
test("fee evidence parses cents exactly and rejects misplaced amounts", () => {
  const base = {
    id: id(),
    caseId: id(),
    stepKey: "fee_receipt",
    outcome: "pass",
    sourceReference: "SYNTH-092-RECEIPT",
    note: "Verified external receipt",
    feeAmount: "25.05",
  };
  assert.equal(normalizeSaleEvidence(base).feeAmountCents, 2505);
  assert.throws(
    () => normalizeSaleEvidence({ ...base, feeAmount: "25.999" }),
    /nonnegative amount/u,
  );
  assert.throws(
    () => normalizeSaleEvidence({ ...base, stepKey: "unit_inspection" }),
    /Only fee receipts/u,
  );
});
test("independent decisions and explicit handoff normalize only supported states", () => {
  const base = {
    id: id(),
    caseId: id(),
    decision: "approved",
    note: "All evidence reviewed independently",
  };
  assert.equal(normalizeSaleDecision(base).decision, "approved");
  assert.throws(
    () => normalizeSaleDecision({ ...base, decision: "sold" }),
    /approve or reject/u,
  );
  assert.equal(
    normalizeSaleHandoff({
      id: id(),
      caseId: id(),
      newOwnershipEventId: id(),
      agreementReference: "SYNTH-AGREEMENT",
      closingReference: "SYNTH-CLOSING",
      note: "Manual agreement reviewed",
    }).agreementReference,
    "SYNTH-AGREEMENT",
  );
});
test("schema requires independent review, six steps and guarded owner handoff", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0124_permanent_unit_sale_transfer.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "Sale review must be independent",
    "valid_steps<>6",
    "Final handoff requires approved independent case",
    "permanent_unit.transfer",
    "winterization_append_only",
  ])
    assert.match(sql, new RegExp(fragment, "iu"));
});
