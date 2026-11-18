import { createHash, createPublicKey, verify } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const SHA = /^[a-f0-9]{40}$/u;
const REFERENCE = /^[A-Za-z0-9:._/-]{6,140}$/u;
const PROVIDER = /^[a-z][a-z0-9_-]{1,63}$/u;

function verificationKey(pem) {
  if (typeof pem !== "string" || pem.length > 6000)
    throw new Error("Independent evidence public key is missing.");
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("Independent evidence must use an Ed25519 key.");
  return {
    key,
    fingerprint: createHash("sha256")
      .update(key.export({ format: "der", type: "spki" }))
      .digest("hex"),
  };
}
function instant(value) {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) || d.toISOString() !== value
    ? null
    : d.valueOf();
}

/** Cryptographically corroborated reported source, not independent bank API proof. */
export function verifyIndependentFinancialEvidence263({
  envelopeJson,
  provider,
  statementId,
  statementDigestSha256,
  sourceRevision,
  issuerPublicKeyPem,
  reviewerPublicKeyPem,
  issuerIndependentlyEnrolled,
  reviewerIndependentlyEnrolled,
  now = new Date(),
}) {
  if (
    !issuerIndependentlyEnrolled ||
    !reviewerIndependentlyEnrolled ||
    !PROVIDER.test(provider ?? "") ||
    provider === "mock" ||
    !REFERENCE.test(statementId ?? "") ||
    !DIGEST.test(statementDigestSha256 ?? "") ||
    !SHA.test(sourceRevision ?? "")
  )
    throw new Error("HOLD: authentic provider/reviewer and original statement pins required.");
  if (typeof envelopeJson !== "string" || envelopeJson.length > 16000)
    throw new Error("HOLD: original financial evidence packet unavailable.");
  const issuer = verificationKey(issuerPublicKeyPem);
  const reviewer = verificationKey(reviewerPublicKeyPem);
  if (issuer.fingerprint === reviewer.fingerprint)
    throw new Error("HOLD: original issuer and reviewer cannot share a signing key.");
  let envelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error("HOLD: original evidence is invalid JSON.");
  }
  const { payload, issuerSignatureBase64, reviewerSignatureBase64 } =
    envelope ?? {};
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.schema !== "icamp.external-financial-evidence.v1" ||
    payload.provider !== provider ||
    payload.statementId !== statementId ||
    payload.statementDigestSha256 !== statementDigestSha256 ||
    payload.sourceRevision !== sourceRevision ||
    payload.issuerFingerprintSha256 !== issuer.fingerprint ||
    payload.reviewerFingerprintSha256 !== reviewer.fingerprint ||
    !REFERENCE.test(payload.externalReference ?? "") ||
    !/^[A-Z]{3}$/u.test(payload.currencyCode ?? "") ||
    !Number.isSafeInteger(payload.netAmountCents) ||
    payload.netAmountCents < 0 ||
    payload.netAmountCents > 2_000_000_000
  )
    throw new Error("HOLD: independent financial source identity, currency or amounts differ.");
  const created = instant(payload.issuedAt);
  const expires = instant(payload.expiresAt);
  if (
    created === null ||
    expires === null ||
    created > now.valueOf() + 60_000 ||
    created < now.valueOf() - 7 * 86_400_000 ||
    expires <= now.valueOf() ||
    expires - created > 7 * 86_400_000
  )
    throw new Error("HOLD: financial receipt expired, stale or future-dated.");
  const message = Buffer.from(JSON.stringify(payload));
  for (const [signature, authority] of [
    [issuerSignatureBase64, issuer],
    [reviewerSignatureBase64, reviewer],
  ]) {
    if (
      typeof signature !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(signature) ||
      signature.length > 200
    )
      throw new Error("HOLD: independent financial signature is missing.");
    const bytes = Buffer.from(signature, "base64");
    if (bytes.length !== 64 || !verify(null, message, authority.key, bytes))
      throw new Error("HOLD: independent financial signature verification failed.");
  }
  return {
    status: "DUAL_SIGNED_FINANCIAL_STATEMENT_MATCHED_NOT_BANK_CLEARING",
    sourceRevision,
    statementId,
    netAmountCents: payload.netAmountCents,
    currencyCode: payload.currencyCode,
    evidenceDigestSha256: createHash("sha256").update(message).digest("hex"),
    externallyConfirmedBankDeposit: false,
    legalProviderIdentityVerified: false,
    liveSettlementAuthority: false,
  };
}

export function financialCloseReadiness263({ originalMigrationMatched, originalDbCustody, signedFinancialEvidence, originalBankApiReadback }) {
  const blockers = [];
  if (!originalMigrationMatched)
    blockers.push("Actual production migration history is not independently verified.");
  if (!originalDbCustody)
    blockers.push("Independent production database custody remains unverified.");
  if (!signedFinancialEvidence)
    blockers.push("Two distinct original financial evidence signatures are not present.");
  if (!originalBankApiReadback)
    blockers.push("Independent bank/provider API settlement readback is unavailable.");
  return {
    status: "HOLD_LIVE_FINANCIAL_ACTIVATION",
    blockers,
    evidencePacketReadyForManualReview: blockers.length === 1 && !originalBankApiReadback,
    actualBankSettlementConfirmed: false,
    livePaymentActivation: false,
    statutoryClose: false,
  };
}
