import { unitId } from "../permanent-unit-market/core.mjs";

export const closingSteps = Object.freeze([
  { key: "buyer_application", label: "Buyer application & identity review" },
  { key: "unit_inspection", label: "Unit condition and safety inspection" },
  { key: "fee_receipt", label: "Fees and external payment receipt" },
  { key: "sale_documents", label: "Sale documents and seller authority" },
  {
    key: "closing_checklist",
    label: "Closing checklist and local requirements",
  },
  {
    key: "agreement_replacement",
    label: "New occupancy/land agreement evidence",
  },
]);
function text(value, label, min, max) {
  const v = String(value ?? "").trim();
  if (v.length < min || v.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return v;
}
export function normalizeSaleApplication(input) {
  return {
    id: unitId(input.id),
    listingId: unitId(input.listingId, "Listing"),
    inquiryId: unitId(input.inquiryId, "Inquiry"),
    applicationReference: text(
      input.applicationReference,
      "Application source",
      8,
      400,
    ),
    applicationNote: text(input.applicationNote, "Application note", 12, 1200),
  };
}
export function normalizeSaleEvidence(input) {
  const stepKey = String(input.stepKey ?? "");
  if (!closingSteps.some((s) => s.key === stepKey))
    throw new Error("Unknown closing evidence step.");
  const outcome = String(input.outcome ?? "");
  if (!["pass", "defect"].includes(outcome))
    throw new Error("Evidence must pass or record a defect.");
  const fee = String(input.feeAmount ?? "").trim();
  if (stepKey === "fee_receipt" && !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(fee))
    throw new Error("Fee receipt needs a nonnegative amount in CAD.");
  if (stepKey !== "fee_receipt" && fee)
    throw new Error("Only fee receipts record a monetary amount.");
  const [whole = "", fraction = ""] = fee.split(".");
  return {
    id: unitId(input.id),
    caseId: unitId(input.caseId, "Sale case"),
    stepKey,
    outcome,
    sourceReference: text(input.sourceReference, "Evidence source", 8, 400),
    note: text(input.note, "Evidence note", 12, 1200),
    feeAmountCents:
      stepKey === "fee_receipt"
        ? Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
        : null,
  };
}
export function normalizeSaleDecision(input) {
  const decision = String(input.decision ?? "");
  if (!["approved", "rejected"].includes(decision))
    throw new Error("Decision must approve or reject.");
  return {
    id: unitId(input.id),
    caseId: unitId(input.caseId, "Sale case"),
    decision,
    note: text(input.note, "Decision note", 12, 1200),
  };
}
export function normalizeSaleHandoff(input) {
  return {
    id: unitId(input.id),
    caseId: unitId(input.caseId, "Sale case"),
    newOwnershipEventId: unitId(
      input.newOwnershipEventId,
      "New ownership record",
    ),
    agreementReference: text(
      input.agreementReference,
      "Agreement source",
      8,
      400,
    ),
    closingReference: text(input.closingReference, "Closing source", 8, 400),
    note: text(input.note, "Closing note", 12, 1200),
  };
}
export function closingProgress(evidence, decision, handoff) {
  const latest = new Map();
  for (const row of evidence)
    if (!latest.has(row.step_key)) latest.set(row.step_key, row);
  const steps = closingSteps.map((step) => ({
    ...step,
    outcome: latest.get(step.key)?.outcome ?? "missing",
    source: latest.get(step.key)?.source_reference ?? null,
  }));
  return {
    steps,
    ready: steps.every((s) => s.outcome === "pass"),
    decision: decision?.decision ?? null,
    recorded: !!handoff,
  };
}
