import { createHash, createPublicKey, verify } from "node:crypto";

export const BUILD261_MIGRATION = Object.freeze({
  version: "0238",
  name: "build260_owner_financial_close",
  checksumSha256: "7cec224311959280b6199fa3ed373bc86c2a08678807e4a6d2795ae11280def3",
});

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA64 = /^[a-f0-9]{64}$/u;
const PROVIDER = /^[a-z][a-z0-9_-]{1,63}$/u;
const IDENTIFIER = /^[A-Za-z0-9:_./-]{3,120}$/u;

export function sha256Text261(value) {
  return createHash("sha256").update(value).digest("hex");
}

function keyInfo(pem) {
  if (typeof pem !== "string" || pem.length > 6000)
    throw new Error("Independent enrollment public key unavailable.");
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("Ed25519 signing key is required.");
  return {
    key,
    fingerprint: createHash("sha256")
      .update(key.export({ type: "spki", format: "der" }))
      .digest("hex"),
  };
}

function validInstant(value) {
  if (typeof value !== "string") return null;
  const instant = new Date(value);
  return Number.isNaN(instant.valueOf()) ||
    instant.toISOString() !== value
    ? null
    : instant.valueOf();
}

/**
 * Two distinct signatures provide cryptographic custody evidence only.
 * Identity and institutional independence must be established out of band.
 */
export function verifyProviderEnrollment261({
  envelopeJson,
  provider,
  keyId,
  providerPublicKeyPem,
  reviewerPublicKeyPem,
  reviewerIndependentlyEnrolled,
  sourceRevision,
  now = new Date(),
}) {
  if (
    !reviewerIndependentlyEnrolled ||
    !SHA40.test(sourceRevision ?? "") ||
    !PROVIDER.test(provider ?? "") ||
    provider === "mock" ||
    !IDENTIFIER.test(keyId ?? "")
  )
    throw new Error("HOLD: external issuer, independent reviewer or exact source not enrolled.");
  if (typeof envelopeJson !== "string" || envelopeJson.length > 16000)
    throw new Error("HOLD: signed enrollment document missing.");
  const issuer = keyInfo(providerPublicKeyPem);
  const reviewer = keyInfo(reviewerPublicKeyPem);
  if (issuer.fingerprint === reviewer.fingerprint)
    throw new Error("HOLD: issuer and independent reviewer must have distinct keys.");
  let envelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error("HOLD: enrollment document is invalid JSON.");
  }
  const { payload, issuerSignatureBase64, reviewerSignatureBase64 } =
    envelope ?? {};
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("HOLD: enrollment payload missing.");
  if (
    payload.schema !== "icamp.provider-enrollment.v1" ||
    payload.provider !== provider ||
    payload.keyId !== keyId ||
    payload.issuerFingerprintSha256 !== issuer.fingerprint ||
    payload.reviewerFingerprintSha256 !== reviewer.fingerprint ||
    payload.sourceRevision !== sourceRevision ||
    payload.migrationVersion !== BUILD261_MIGRATION.version ||
    payload.migrationChecksumSha256 !== BUILD261_MIGRATION.checksumSha256 ||
    !IDENTIFIER.test(payload.independentReviewReference ?? "")
  )
    throw new Error("HOLD: signer enrollment is for a different source, issuer or migration.");
  const issued = validInstant(payload.issuedAt);
  const expires = validInstant(payload.expiresAt);
  const timestamp = now.valueOf();
  if (
    issued === null ||
    expires === null ||
    issued > timestamp + 60_000 ||
    issued < timestamp - 30 * 86400_000 ||
    expires <= timestamp ||
    expires <= issued ||
    expires - issued > 30 * 86400_000
  )
    throw new Error("HOLD: signer enrollment is expired, stale or future-dated.");
  const data = Buffer.from(JSON.stringify(payload));
  for (const [signature, authority] of [
    [issuerSignatureBase64, issuer],
    [reviewerSignatureBase64, reviewer],
  ]) {
    if (
      typeof signature !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(signature) ||
      signature.length > 200
    )
      throw new Error("HOLD: original independent signature missing.");
    const signatureBytes = Buffer.from(signature, "base64");
    if (
      signatureBytes.length !== 64 ||
      !verify(null, data, authority.key, signatureBytes)
    )
      throw new Error("HOLD: independent enrollment signature does not verify.");
  }
  return {
    status: "DUAL_SIGNED_ENROLLMENT_OBSERVED",
    provider,
    keyId,
    sourceRevision,
    expiresAt: payload.expiresAt,
    enrollmentDigestSha256: sha256Text261(JSON.stringify(payload)),
    independentlyVerifiedInstitutionalIdentity: false,
  };
}

export function assessMigrationReadback261({
  runtimeProduction,
  revision,
  targetPinned,
  ledgerExists,
  ledgerReadSucceeded,
  record,
  schema,
}) {
  const blockers = [];
  if (!runtimeProduction || !SHA40.test(revision ?? ""))
    blockers.push("Exact Vercel production source revision unavailable.");
  if (!targetPinned)
    blockers.push("Actual DATABASE_URL hostname is not independently pinned.");
  if (!ledgerReadSucceeded || !ledgerExists)
    blockers.push("Original production migration ledger could not be read.");
  if (
    record?.version !== BUILD261_MIGRATION.version ||
    record?.name !== BUILD261_MIGRATION.name ||
    record?.checksum_sha256 !== BUILD261_MIGRATION.checksumSha256
  )
    blockers.push("Migration 0238 is missing or does not match the exact released SQL SHA-256.");
  if (
    !schema ||
    schema.forceRls !== true ||
    schema.guardPresent !== true ||
    schema.scopedPolicyCount !== 2 ||
    schema.mutableGrantPresent !== false
  )
    blockers.push("Build 260 owner ledger RLS, immutable privileges or guard are not verified.");
  return {
    status: blockers.length
      ? "HOLD_PRODUCTION_MIGRATION_PROVENANCE"
      : "PINNED_RUNTIME_LEDGER_AND_SCHEMA_MATCH",
    blockers,
    expectedMigrationVersion: BUILD261_MIGRATION.version,
    expectedMigrationChecksumSha256: BUILD261_MIGRATION.checksumSha256,
    verifiedOnProductionDatabase: blockers.length === 0,
    independentlySignedDatabaseCustody: false,
  };
}

export function evaluateAssurance261({
  migration,
  enrollment,
  configuredProvider,
  expectedProvider,
  revision,
}) {
  const blockers = [...migration.blockers];
  if (!enrollment || enrollment.status !== "DUAL_SIGNED_ENROLLMENT_OBSERVED")
    blockers.push("Two authentic, separately enrolled provider/reviewer signatures are required.");
  if (
    configuredProvider === "mock" ||
    configuredProvider !== expectedProvider ||
    !enrollment ||
    enrollment.provider !== configuredProvider ||
    enrollment.sourceRevision !== revision
  )
    blockers.push("Provider configuration and signed source enrollment disagree.");
  return {
    approvalEligible: blockers.length === 0,
    status: blockers.length
      ? "HOLD_EXTERNAL_FINANCIAL_ASSURANCE"
      : "EVIDENCE_REVIEW_ELIGIBLE_NONPOSTING_ONLY",
    blockers,
    livePaymentsEnabled: false,
    bankSettlementCertified: false,
    statutoryTaxCloseCertified: false,
    externalProviderAdapterInstalled: false,
  };
}
