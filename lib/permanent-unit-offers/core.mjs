import { unitId } from "../permanent-unit-market/core.mjs";
import { dollarsToCents } from "../permanent-unit-financing/core.mjs";

function limited(value, label, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return result;
}
function integer(value, name, min, max) {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return Number(s);
}
export function illustrativePayment(principalCents, annualRateBps, months) {
  if (
    !Number.isSafeInteger(principalCents) ||
    principalCents < 1 ||
    !Number.isInteger(annualRateBps) ||
    annualRateBps < 0 ||
    annualRateBps > 6000 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 240
  )
    throw new Error("Invalid illustrative repayment parameters.");
  const monthlyRate = annualRateBps / 120000;
  const payment =
    monthlyRate === 0
      ? principalCents / months
      : (principalCents * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}
export function normalizeOfferTerms(input) {
  const principalCents = dollarsToCents(input.principal);
  const annualRateBps = integer(
    input.annualRateBps,
    "Annual nominal rate (basis points)",
    0,
    6000,
  );
  const months = integer(input.months, "Term months", 1, 240);
  const feeCents =
    input.fee === "0" || input.fee === "0.00" ? 0 : dollarsToCents(input.fee);
  if (feeCents > principalCents)
    throw new Error("Upfront fees cannot exceed principal.");
  return {
    id: unitId(input.id),
    applicationId: unitId(input.applicationId, "Financing application"),
    principalCents,
    annualRateBps,
    months,
    feeCents,
    estimatedMonthlyCents: illustrativePayment(
      principalCents,
      annualRateBps,
      months,
    ),
    policyReference: limited(input.policyReference, "Policy source", 8, 400),
    disclosureReference: limited(
      input.disclosureReference,
      "Disclosure source",
      8,
      400,
    ),
    note: limited(input.note, "Internal terms note", 12, 800),
  };
}
export function normalizeOfferAuthorization(input) {
  const decision = String(input.decision ?? "");
  if (!["authorized_internal_preparation", "rejected"].includes(decision))
    throw new Error(
      "Only internal preparation authorization or rejection is available.",
    );
  return {
    id: unitId(input.id),
    proposalId: unitId(input.proposalId, "Terms proposal"),
    decision,
    externalReviewReference: limited(
      input.externalReviewReference,
      "External policy/credit review source",
      8,
      400,
    ),
    note: limited(input.note, "Independent decision note", 12, 800),
  };
}
