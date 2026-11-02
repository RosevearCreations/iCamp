import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  financingEvidenceTypes,
  dollarsToCents,
  normalizeFinancingApplication,
  normalizeFinancingEvidence,
  normalizeFinancingTriage,
  financingProgress,
} from "../lib/permanent-unit-financing/core.mjs";
const id = () => randomUUID();
test("four intake document categories and latest defect block completeness", () => {
  assert.equal(financingEvidenceTypes.length, 4);
  const evidence = financingEvidenceTypes.map((x) => ({
    document_type: x.key,
    outcome: "received",
    source_reference: "SYNTH-093-DOC",
  }));
  assert.equal(financingProgress(evidence).complete, true);
  assert.equal(
    financingProgress([{ ...evidence[0], outcome: "defect" }, ...evidence])
      .complete,
    false,
  );
});
test("requested CAD amount requires precise cents and explicit consent", () => {
  assert.equal(dollarsToCents("12500.05"), 1250005);
  for (const amount of ["0", "-1", "1.999", "999999999", "1e3"])
    assert.throws(() => dollarsToCents(amount), /positive CAD/u);
  const input = {
    id: id(),
    caseId: id(),
    requestedAmount: "15000.20",
    applicantContactReference: "CRM-SYNTH-093",
    consentReference: "CONSENT-SYNTH-093",
    purposeNote: "Synthetic RV purchase financing",
  };
  assert.throws(() => normalizeFinancingApplication(input), /consent/u);
  assert.equal(
    normalizeFinancingApplication({ ...input, consentAttested: true })
      .requestedAmountCents,
    1500020,
  );
});
test("evidence and independent triage validate supported states", () => {
  const base = {
    id: id(),
    applicationId: id(),
    documentType: "identity_consent",
    outcome: "received",
    sourceReference: "SECURE-REF-093",
    note: "Staff recorded external receipt",
  };
  assert.equal(
    normalizeFinancingEvidence(base).documentType,
    "identity_consent",
  );
  assert.throws(
    () => normalizeFinancingEvidence({ ...base, documentType: "bank_account" }),
    /Unknown/u,
  );
  assert.equal(
    normalizeFinancingTriage({
      id: id(),
      applicationId: id(),
      decision: "returned_incomplete",
      note: "Missing signed disclosure",
    }).decision,
    "returned_incomplete",
  );
  assert.throws(
    () =>
      normalizeFinancingTriage({
        id: id(),
        applicationId: id(),
        decision: "loan_approved",
        note: "Not allowed here",
      }),
    /Unknown/u,
  );
});
test("schema enforces privacy, independent evidence and never offers credit", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0125_permanent_unit_financing_intake.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "consent_attested",
    "Financing triage requires independent review",
    "complete_count<>4",
    "permanent_unit.transfer",
    "winterization_append_only",
  ])
    assert.match(sql, new RegExp(fragment, "iu"));
});
