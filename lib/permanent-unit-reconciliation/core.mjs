import { unitId } from "../permanent-unit-market/core.mjs";
function bounded(value, name, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  return result;
}
function optionalId(value) {
  return value ? unitId(value) : null;
}
export function normalizeEvidenceReconciliation(input) {
  const completeness = String(input.completeness ?? "");
  if (!["evidence_complete", "needs_followup"].includes(completeness))
    throw new Error("Reconciliation must be complete or require follow-up.");
  const digest = String(input.disclosureSha256 ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest))
    throw new Error("Exact disclosure SHA-256 is required.");
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Consent"),
    receiptId: optionalId(input.receiptId),
    acknowledgementId: optionalId(input.acknowledgementId),
    disclosureVersionId: unitId(
      input.disclosureVersionId,
      "Disclosure version",
    ),
    disclosureSha256: digest,
    lastExceptionEventId: optionalId(input.lastExceptionEventId),
    completeness,
    reconciliationReference: bounded(
      input.reconciliationReference,
      "Restricted reconciliation source",
      8,
      400,
    ),
    note: bounded(input.note, "Reconciliation note", 12, 800),
  };
}
export function normalizeClosureReview(input) {
  const decision = String(input.decision ?? "");
  if (!["closed_internal_evidence", "returned_for_rework"].includes(decision))
    throw new Error(
      "Closure review can only close internal evidence or return it for rework.",
    );
  return {
    id: unitId(input.id),
    reconciliationId: unitId(input.reconciliationId, "Reconciliation"),
    decision,
    reviewReference: bounded(
      input.reviewReference,
      "Independent closure review source",
      8,
      400,
    ),
    note: bounded(input.note, "Review rationale", 12, 800),
  };
}
