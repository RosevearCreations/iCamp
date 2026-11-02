import { unitId } from "../permanent-unit-market/core.mjs";
function reference(value, name, min = 8, max = 400) {
  const v = String(value ?? "").trim();
  if (v.length < min || v.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  return v;
}
function timestamp(value, name) {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime()))
    throw new Error(`${name} must be a valid time.`);
  if (date.getTime() > Date.now() + 300000)
    throw new Error(`${name} cannot be in the future.`);
  return date.toISOString();
}
export function normalizeManualReceipt(input) {
  const channel = String(input.channel ?? "");
  if (!["in_person", "secure_portal"].includes(channel))
    throw new Error("Manual receipt channel must match approved consent.");
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Consent"),
    signoffId: unitId(input.signoffId, "Sign-off"),
    channel,
    deliveredAt: timestamp(input.deliveredAt, "Delivery time"),
    evidenceReference: reference(
      input.evidenceReference,
      "Restricted delivery evidence",
    ),
    recipientVerificationReference: reference(
      input.recipientVerificationReference,
      "Recipient verification evidence",
    ),
    note: reference(input.note, "Manual delivery note", 12, 800),
  };
}
export function normalizeApplicantResponse(input) {
  const response = String(input.response ?? "");
  if (
    !["receipt_confirmed", "receipt_disputed", "no_response"].includes(response)
  )
    throw new Error(
      "Applicant response is receipt confirmation, dispute or no response only.",
    );
  return {
    id: unitId(input.id),
    receiptId: unitId(input.receiptId, "Receipt"),
    response,
    responseAt: timestamp(input.responseAt, "Response time"),
    evidenceReference: reference(
      input.evidenceReference,
      "Restricted response source",
    ),
    note: reference(input.note, "Response context", 12, 800),
  };
}
export function normalizeExceptionEvent(input) {
  const eventType = String(input.eventType ?? "");
  const reasonCode = String(input.reasonCode ?? "");
  if (!["hold", "clear"].includes(eventType))
    throw new Error("Exception event must hold or clear.");
  if (
    ![
      "identity_mismatch",
      "disclosure_dispute",
      "delivery_failure",
      "consent_withdrawn",
      "other",
    ].includes(reasonCode)
  )
    throw new Error("Select a supported exception reason.");
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Consent"),
    eventType,
    reasonCode,
    evidenceReference: reference(
      input.evidenceReference,
      "Restricted exception source",
    ),
    note: reference(input.note, "Exception resolution note", 12, 800),
  };
}
