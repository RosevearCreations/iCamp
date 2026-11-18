import { createHash, createPublicKey, verify } from "node:crypto";

import { BUILD261_MIGRATION } from "../finance-assurance261/core.mjs";

const REV = /^[a-f0-9]{40}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const REF = /^[A-Za-z0-9:._/-]{8,120}$/u;

export function sha256Custody262(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function fingerprint(keyPem) {
  if (typeof keyPem !== "string" || keyPem.length > 6000)
    throw new Error("Independent database custody signing key unavailable.");
  const key = createPublicKey(keyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("Independent database custody Ed25519 key required.");
  return {
    key,
    fingerprintSha256: createHash("sha256")
      .update(key.export({ format: "der", type: "spki" }))
      .digest("hex"),
  };
}

function safeTime(value) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value)
    return null;
  return date.valueOf();
}

/** Verifies original signatures over a pinned production source and DB target.
 * The reviewer and issuer must be separately authenticated OUTSIDE the app. */
export function verifyDbCustody262({
  envelopeJson,
  actualDatabaseHost,
  expectedDatabaseHost,
  sourceRevision,
  custodianPublicKeyPem,
  reviewerPublicKeyPem,
  custodianIndependentlyEnrolled,
  reviewerIndependentlyEnrolled,
  now = new Date(),
}) {
  if (
    !custodianIndependentlyEnrolled ||
    !reviewerIndependentlyEnrolled ||
    !REV.test(sourceRevision ?? "") ||
    typeof actualDatabaseHost !== "string" ||
    actualDatabaseHost.length < 5 ||
    actualDatabaseHost !== expectedDatabaseHost
  )
    throw new Error("HOLD: current production database, source or separate custodians not independently pinned.");
  if (typeof envelopeJson !== "string" || envelopeJson.length > 16_000)
    throw new Error("HOLD: signed database custody evidence unavailable.");
  const custodian = fingerprint(custodianPublicKeyPem);
  const reviewer = fingerprint(reviewerPublicKeyPem);
  if (custodian.fingerprintSha256 === reviewer.fingerprintSha256)
    throw new Error("HOLD: custodian and reviewer must be different signing authorities.");
  let envelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error("HOLD: database custody envelope is not valid JSON.");
  }
  const { payload, custodianSignatureBase64, reviewerSignatureBase64 } =
    envelope ?? {};
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.schema !== "icamp.production-db-custody.v1" ||
    payload.sourceRevision !== sourceRevision ||
    payload.databaseHostnameSha256 !== sha256Custody262(actualDatabaseHost) ||
    payload.migrationVersion !== BUILD261_MIGRATION.version ||
    payload.migrationChecksumSha256 !== BUILD261_MIGRATION.checksumSha256 ||
    payload.custodianFingerprintSha256 !== custodian.fingerprintSha256 ||
    payload.reviewerFingerprintSha256 !== reviewer.fingerprintSha256 ||
    !REF.test(String(payload.originalHostReviewReference ?? "")) ||
    !SHA.test(payload.databaseHostnameSha256 ?? "")
  )
    throw new Error("HOLD: signed custody source, original host, migration or independent signers differ.");
  const issued = safeTime(payload.issuedAt);
  const expires = safeTime(payload.expiresAt);
  const current = now.valueOf();
  if (
    issued === null ||
    expires === null ||
    issued > current + 60_000 ||
    issued < current - 7 * 86_400_000 ||
    expires <= current ||
    expires - issued > 7 * 86_400_000
  )
    throw new Error("HOLD: database custody signature is stale, expired or future-dated.");
  const body = Buffer.from(JSON.stringify(payload));
  for (const [authority, signatureBase64] of [
    [custodian, custodianSignatureBase64],
    [reviewer, reviewerSignatureBase64],
  ]) {
    if (
      typeof signatureBase64 !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(signatureBase64) ||
      signatureBase64.length > 160
    )
      throw new Error("HOLD: independent database custody signature missing.");
    const signature = Buffer.from(signatureBase64, "base64");
    if (
      signature.length !== 64 ||
      !verify(null, body, authority.key, signature)
    )
      throw new Error("HOLD: original database custody signature mismatch.");
  }
  return {
    status: "DUAL_SIGNED_ORIGINAL_DB_CUSTODY_OBSERVED",
    expiresAt: payload.expiresAt,
    sourceRevision,
    custodyDigestSha256: sha256Custody262(JSON.stringify(payload)),
    bankSettlementCertified: false,
    independentlyVerifiedLegalIdentity: false,
  };
}

export function assessFinancialActivation262({
  migration,
  providerEnrollment,
  dbCustody,
  paymentAdapterReady,
  refundAdapterReady,
  independentBankReceiptPresent = false,
}) {
  const blockers = [];
  if (migration?.verifiedOnProductionDatabase !== true)
    blockers.push("Original production migration checksum, RLS and database scope are not verified.");
  if (providerEnrollment !== "DUAL_SIGNED_ENROLLMENT_OBSERVED")
    blockers.push("Independent provider identity and two signed enrollment receipts are missing.");
  if (dbCustody?.status !== "DUAL_SIGNED_ORIGINAL_DB_CUSTODY_OBSERVED")
    blockers.push("Fresh, two-party signed original production database custody is missing.");
  const ownerEvidenceEligible = blockers.length === 0;
  if (!paymentAdapterReady || !refundAdapterReady)
    blockers.push("Production payment/refund adapter capabilities are not installed and independently accepted.");
  if (!independentBankReceiptPresent)
    blockers.push("Independent original provider/bank settlement receipt is not verified.");
  return {
    status: blockers.length
      ? "HOLD_PROVIDER_SETTLEMENT_ACTIVATION"
      : "TECHNICALLY_READY_REQUIRES_OWNER_ACTIVATION",
    ownerEvidenceEligible,
    settlementActivationEligible: blockers.length === 0,
    blockers,
    actualPaymentCaptured: false,
    bankSettled: false,
    accountingClosed: false,
    hstFiled: false,
  };
}
