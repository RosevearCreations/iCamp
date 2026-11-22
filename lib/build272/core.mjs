export const SHA272 = /^[a-f0-9]{64}$/u;
export const UUID272 =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export const MASTER272 = Object.freeze([
  "rosevear-comms-hub",
  "ai-data-platform",
]);
export function evaluateOwnerLogin272(v) {
  if (v.originalPinned !== true) return "HOLD_ORIGINAL_HOST";
  if (v.accountActive !== true) return "HOLD_DISABLED_OWNER";
  if (v.verifiedEmail !== true) return "HOLD_VERIFIED_CONTACT";
  if (v.passwordExists !== true) return "HOLD_SECURE_PASSWORD";
  if (v.verifiedMfa !== true) return "HOLD_MFA";
  if (v.independentGrant !== true) return "HOLD_INDEPENDENT_GRANT";
  if (v.actualAal2Session !== true) return "HOLD_REAL_OWNER_LOGIN";
  if (v.independentWitness !== true) return "HOLD_DISTINCT_REVIEWER";
  return "ORIGINAL_SIGNIN_INDEPENDENTLY_WITNESSED";
}
export function evaluateField272(v) {
  if (v.originalPinned !== true || v.migration !== true)
    return "HOLD_ORIGINAL_SCHEMA_OR_HOST";
  if (v.providerPair !== true || v.providerMatch !== true)
    return "HOLD_ORIGINAL_PROVIDER";
  if (v.processorSettlementWitness !== true) return "HOLD_PROCESSOR_SETTLEMENT";
  if (v.siteWitness !== true) return "HOLD_ORIGINAL_SITE";
  if (v.confirmationWitness !== true || v.guestAcknowledged !== true)
    return "HOLD_GUEST_DELIVERY_OR_ACK";
  if (v.independentReview !== true) return "HOLD_TWO_PARTY_REVIEW";
  return "ELIGIBLE_FOR_SOURCE_LINKED_ACCEPTANCE_NOT_A_NEW_PAYMENT";
}
export function evaluateIncident272(v) {
  if (v.sourcePaired !== true) return "HOLD_AUTHENTICATED_COMMS_SOURCE";
  if (v.durableAttemptAccepted !== true) return "HOLD_COMMS_ACCEPTANCE";
  if (v.signedDeliveredReceipt !== true) return "HOLD_PROVIDER_DELIVERY";
  if (v.independentReviewer !== true) return "HOLD_OPERATOR_REVIEW";
  if (v.originalRecipientAcknowledged !== true) return "HOLD_RECIPIENT_ACK";
  return "ORIGINAL_INCIDENT_LIFECYCLE_CONFIRMED";
}
export function evaluateDryRun272(v) {
  if (v.originalBackupWitness !== true || v.isolatedRestoreWitness !== true)
    return "HOLD_ORIGINAL_BACKUP_RESTORE";
  if (v.allFourCanonicalFingerprints !== true) return "HOLD_FOUR_SCOPE_REPLAY";
  if (v.independentReviewer !== true) return "HOLD_RESTORE_REVIEWER";
  return "DRYRUN_REVIEW_RECORDED_EXTERNAL_HOST_CERTIFICATION_SEPARATE";
}
