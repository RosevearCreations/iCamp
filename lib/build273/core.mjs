import { createHash, timingSafeEqual } from "node:crypto";
export function verifyOneTimeCredential273({
  supplied,
  configured,
  expiresAt,
  now = Date.now(),
  environment,
}) {
  if (
    environment !== "production" ||
    typeof supplied !== "string" ||
    typeof configured !== "string" ||
    configured.length < 40 ||
    !/^[A-Za-z0-9_-]{32,128}$/u.test(supplied) ||
    supplied.length > 128
  )
    return false;
  const expiry = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expected, actual);
}
export function ownerSetupReadiness273({
  originalAccount, accountType, archived,
  existingCredential, existingCredentialChangedAt, issuedAt, mfaRequired
}) {
  if(!originalAccount||accountType!=="staff"||archived)
    return "HOLD_ORIGINAL_OWNER_NOT_ELIGIBLE";
  if(mfaRequired!==true)return "HOLD_EXPECTED_ORIGINAL_MFA_POLICY";
  const issued=Date.parse(issuedAt??"");
  if(!Number.isFinite(issued))return "HOLD_OWNER_CEREMONY_NOT_ISSUED";
  if(existingCredential){
    const changed=Date.parse(existingCredentialChangedAt??"");
    if(!Number.isFinite(changed)||changed>=issued)
      return "OWNER_CREDENTIAL_ALREADY_CLAIMED";
    return "ELIGIBLE_SUPERVISED_ONE_TIME_EXISTING_PASSWORD_RECOVERY";
  }
  return "ELIGIBLE_FIRST_PASSWORD_ONE_TIME_CLAIM";
}
export function signedConsumerScope273(x) {
  if (!x || typeof x !== "object" || Array.isArray(x))
    return "HOLD_INVALID_SOURCE";
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      x.campgroundId ?? "",
    )
  )
    return "HOLD_TENANT_SCOPE";
  if (!["booking", "comms", "incident", "restore"].includes(x.kind))
    return "HOLD_SOURCE_KIND";
  if (!/^[A-Za-z0-9_-]{16,96}$/u.test(x.nonce ?? "")) return "HOLD_NONCE";
  if (!/^[a-f0-9]{64}$/u.test(x.evidenceSha256 ?? "")) return "HOLD_EVIDENCE";
  return "SOURCE_SHAPE_VALID_NEEDS_AUTHENTICATED_ORIGINAL_HOST";
}
export function consumerAckDecision273(x) {
  if (!x?.sourcePaired || !x?.hmacVerified) return "HOLD_SOURCE_SIGNER";
  if (!x?.originalReference) return "HOLD_ORIGINAL_BOOKING_OR_MESSAGE";
  if (!x?.tenantMatched) return "HOLD_TENANT_SCOPE";
  if (!x?.providerDelivered) return "HOLD_PROVIDER_DELIVERY";
  if (!x?.recipientAcknowledged) return "HOLD_ACTUAL_CONSUMER_ACK";
  return "ACK_EVIDENCE_ELIGIBLE_NO_CASE_OR_PAYMENT_MUTATION";
}
export function restoreProviderDecision273(x) {
  if (!x?.originalBackup || !x?.isolatedRestore)
    return "HOLD_BACKUP_OR_ISOLATED_TARGET";
  if (!x?.providerSigned || !x?.providerHostMatched)
    return "HOLD_INDEPENDENT_HOST_ATTESTATION";
  if (!x?.allFourScopesMatch) return "HOLD_CANONICAL_SCOPE_MISMATCH";
  if (!x?.independentReviewer) return "HOLD_SEPARATE_REVIEWER";
  return "ATTESTED_PROVENANCE_SOURCE_RECEIPT_NOT_AUTOMATIC_RECOVERY";
}
