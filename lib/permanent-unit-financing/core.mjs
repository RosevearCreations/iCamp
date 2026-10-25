import { unitId } from "../permanent-unit-market/core.mjs";

export const financingEvidenceTypes = Object.freeze([
  {
    key: "identity_consent",
    label: "Identity and explicit consent verified externally",
  },
  {
    key: "income_reference",
    label: "Income/affordability document received securely",
  },
  { key: "unit_sale_terms", label: "Unit price and proposed sale terms" },
  {
    key: "disclosures",
    label: "Financing disclosures and applicant acknowledgement",
  },
]);
function bounded(value, label, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return result;
}
export function dollarsToCents(input) {
  const value = String(input ?? "").trim();
  if (!/^[1-9]\d{0,7}(\.\d{1,2})?$/.test(value))
    throw new Error(
      "Requested financing must be a positive CAD amount (maximum $99,999,999.99).",
    );
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function normalizeFinancingApplication(input) {
  if (input.consentAttested !== true && input.consentAttested !== "on")
    throw new Error(
      "Applicant consent must be verified and attested before intake.",
    );
  return {
    id: unitId(input.id),
    caseId: unitId(input.caseId, "Sale case"),
    requestedAmountCents: dollarsToCents(input.requestedAmount),
    applicantContactReference: bounded(
      input.applicantContactReference,
      "Private CRM contact reference",
      8,
      400,
    ),
    consentReference: bounded(
      input.consentReference,
      "Consent source reference",
      8,
      400,
    ),
    purposeNote: bounded(input.purposeNote, "Financing purpose", 12, 800),
  };
}
export function normalizeFinancingEvidence(input) {
  const documentType = String(input.documentType ?? "");
  if (!financingEvidenceTypes.some((x) => x.key === documentType))
    throw new Error("Unknown financing document category.");
  const outcome = String(input.outcome ?? "");
  if (!["received", "defect"].includes(outcome))
    throw new Error("Document status must be received or defect.");
  return {
    id: unitId(input.id),
    applicationId: unitId(input.applicationId, "Financing application"),
    documentType,
    outcome,
    sourceReference: bounded(
      input.sourceReference,
      "Secure document reference",
      8,
      400,
    ),
    note: bounded(input.note, "Document note", 12, 800),
  };
}
export function normalizeFinancingTriage(input) {
  const decision = String(input.decision ?? "");
  if (
    ![
      "complete_for_external_review",
      "returned_incomplete",
      "withdrawn",
    ].includes(decision)
  )
    throw new Error("Unknown intake triage outcome.");
  return {
    id: unitId(input.id),
    applicationId: unitId(input.applicationId, "Financing application"),
    decision,
    note: bounded(input.note, "Intake triage note", 12, 800),
  };
}
export function financingProgress(evidence, triage) {
  const latest = new Map();
  for (const entry of evidence)
    if (!latest.has(entry.document_type))
      latest.set(entry.document_type, entry);
  const requirements = financingEvidenceTypes.map((entry) => ({
    ...entry,
    outcome: latest.get(entry.key)?.outcome ?? "missing",
    source: latest.get(entry.key)?.source_reference ?? null,
  }));
  return {
    requirements,
    complete: requirements.every((entry) => entry.outcome === "received"),
    triage: triage?.decision ?? "awaiting_review",
  };
}
