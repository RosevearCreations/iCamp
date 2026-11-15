import { createHash, createPublicKey, verify } from "node:crypto";
import { assessDeviceVerifierPin } from "../booking-charges/fulfillment-dossier-readback-core.mjs";
import {
  BUILD253_CANONICAL_MIGRATIONS,
  canonicalMigrationManifestDigest,
} from "./build253-canonical-migrations.mjs";

const REV = /^[a-f0-9]{40}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const NONCE = /^[A-Za-z0-9_-]{22,96}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
export const sha256Text = (value) =>
  createHash("sha256").update(value).digest("hex");

/** Reconciles a READ-ONLY ledger observation to the canonical, CI-rechecked
 * SQL-file bytes. A match does not prove the DB is the independently approved
 * production database or authorize running missing migrations. */
export function reconcileCanonicalMigrationChecksums({
  sourceRevision,
  hostnameMatchesConfiguredPin,
  querySucceeded,
  ledgerExists,
  records,
}) {
  const rows = BUILD253_CANONICAL_MIGRATIONS.map((expected) => {
    const found = Array.isArray(records)
      ? records.find((row) => row?.version === expected.version)
      : null;
    return {
      version: expected.version,
      found: Boolean(found),
      nameMatches: found?.name === expected.name,
      checksumMatches:
        SHA.test(String(found?.checksum_sha256 ?? "")) &&
        found.checksum_sha256 === expected.sha256,
      canonicalSource: "REVIEWED_GITHUB_SQL_BYTES",
    };
  });
  let status = "HOLD_MIGRATION_READBACK_UNAVAILABLE";
  if (!hostnameMatchesConfiguredPin)
    status = "HOLD_DATABASE_HOST_PIN_MISMATCH_OR_MISSING";
  else if (!querySucceeded) status = "HOLD_MIGRATION_LEDGER_QUERY_FAILED";
  else if (!ledgerExists) status = "HOLD_MIGRATION_LEDGER_TABLE_MISSING";
  else if (rows.some((row) => !row.found || !row.nameMatches))
    status = "HOLD_MIGRATION_LEDGER_MISSING_OR_WRONG_NAME";
  else if (rows.some((row) => !row.checksumMatches))
    status = "HOLD_CANONICAL_MIGRATION_CHECKSUM_MISMATCH";
  else if (!REV.test(String(sourceRevision ?? "")))
    status = "HOLD_EXACT_DEPLOYED_SHA_MISSING";
  else status = "SOURCE_CHECKSUMS_MATCH_RECORDED_LEDGER";
  return {
    status,
    rows,
    sourceChecksumsMatch: status === "SOURCE_CHECKSUMS_MATCH_RECORDED_LEDGER",
    independentDatabaseProvenance: false,
    realSchemaMigrationAdoptionApproved: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}

export function databaseProvenanceReceiptMessage(receipt) {
  return JSON.stringify([
    "icamp.production-database-provenance.v1",
    receipt.sourceId,
    receipt.sourceRevision,
    receipt.databaseHostnameSha256,
    receipt.migrationManifestSha256,
    receipt.reviewerKeyId,
    receipt.observedAt,
    receipt.nonce,
    receipt.decision,
  ]);
}

/** No external key or receipt is generated here. The separate Ed25519
 * custodian/reviewer pin and receipt must come from original authority.
 * Reusable read-only observation is NOT nonce-consumption or owner approval. */
export function verifyIndependentDatabaseProvenance({
  sourceRevision,
  databaseHostname,
  reconciled,
  reviewerEnrolled,
  reviewerPin,
  originalSourceEnrolled,
  originalSourcePin,
  receipt,
  asOf,
}) {
  const fail = (status) => ({
    status,
    signatureVerified: false,
    independentDatabaseProvenance: false,
    receiptDigestSha256: null,
    originalSourceHealthy: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  });
  if (!reconciled?.sourceChecksumsMatch)
    return fail("HOLD_CANONICAL_SOURCE_RECONCILIATION_REQUIRED");
  if (
    !REV.test(String(sourceRevision ?? "")) ||
    !databaseHostname ||
    !receipt ||
    !reviewerPin
  )
    return fail("HOLD_GENUINE_DATABASE_PROVENANCE_RECEIPT_MISSING");
  const reviewerTrust = assessDeviceVerifierPin({
    custodianEnrolled: reviewerEnrolled,
    trust: reviewerPin,
  });
  const sourceTrust = assessDeviceVerifierPin({
    custodianEnrolled: originalSourceEnrolled,
    trust: originalSourcePin,
  });
  if (!reviewerTrust.configured || !sourceTrust.configured)
    return fail("HOLD_INDEPENDENT_SOURCE_AND_REVIEWER_PINS");
  if (
    reviewerPin.keyId === originalSourcePin.keyId ||
    reviewerPin.independentlyAuthenticatedSpkiFingerprint ===
      originalSourcePin.independentlyAuthenticatedSpkiFingerprint
  )
    return fail("HOLD_REVIEWER_NOT_DISTINCT_FROM_ORIGINAL_SOURCE");
  if (
    receipt.schema !== "icamp.database.provenance-receipt.v1" ||
    receipt.sourceId !== "icamp" ||
    receipt.sourceRevision !== sourceRevision ||
    receipt.reviewerKeyId !== reviewerPin.keyId ||
    receipt.decision !== "DATABASE_TARGET_AND_MIGRATION_CHECKSUMS_OBSERVED" ||
    receipt.databaseHostnameSha256 !== sha256Text(databaseHostname) ||
    receipt.migrationManifestSha256 !== canonicalMigrationManifestDigest() ||
    !NONCE.test(String(receipt.nonce ?? ""))
  )
    return fail("HOLD_DATABASE_PROVENANCE_BINDING_MISMATCH");
  const now = Date.parse(asOf);
  const observed = Date.parse(receipt.observedAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(observed) ||
    observed > now + 60_000 ||
    observed < now - 24 * 60 * 60 * 1000
  )
    return fail("HOLD_DATABASE_PROVENANCE_RECEIPT_EXPIRED");
  try {
    const encoded = String(receipt.signatureBase64 ?? "");
    if (!B64.test(encoded) || encoded.length > 512)
      return fail("HOLD_INVALID_DATABASE_PROVENANCE_SIGNATURE");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== 64 || bytes.toString("base64") !== encoded)
      return fail("HOLD_INVALID_DATABASE_PROVENANCE_SIGNATURE");
    const publicKey = createPublicKey({
      key: Buffer.from(reviewerPin.publicKeySpkiBase64, "base64"),
      type: "spki",
      format: "der",
    });
    if (
      publicKey.asymmetricKeyType !== "ed25519" ||
      !verify(
        null,
        Buffer.from(databaseProvenanceReceiptMessage(receipt)),
        publicKey,
        bytes,
      )
    )
      return fail("HOLD_INVALID_DATABASE_PROVENANCE_SIGNATURE");
    return {
      status: "SIGNED_DATABASE_PROVENANCE_OBSERVED_SOURCE_ONLY",
      signatureVerified: true,
      independentDatabaseProvenance: true,
      receiptDigestSha256: sha256Text(
        databaseProvenanceReceiptMessage(receipt),
      ),
      originalSourceHealthy: false,
      masterConnected: false,
      ownerProductionAcceptance: "HOLD",
    };
  } catch {
    return fail("HOLD_INVALID_DATABASE_PROVENANCE_SIGNATURE");
  }
}

export function superviseRemediationEvidence({ checksum, provenance, prior }) {
  const tasks = [
    {
      id: "CANONICAL_SQL_BYTES",
      owner: "iCamp database operator",
      status: checksum.sourceChecksumsMatch ? "SOURCE_MATCH_OBSERVED" : "HOLD",
      action:
        "Compare versioned SQL source to the live recorded ledger. Do not mutate a database or treat a migration record as an independently approved migration.",
    },
    {
      id: "ORIGINAL_DATABASE_PROVENANCE",
      owner: "Independent database and source custodians",
      status: provenance.independentDatabaseProvenance
        ? "SIGNED_SOURCE_OBSERVED"
        : "HOLD",
      action:
        "Obtain genuine distinct-custodian Ed25519 provenance binding the active DB-host digest, canonical migration-manifest digest, exact SHA, time and nonce. Never create a test receipt for production.",
    },
    {
      id: "DATABASE_SCHEMA_AND_BACKUP",
      owner: "Production database administrator",
      status: prior?.database?.schemaVerified ? "SCHEMA_READBACK_ONLY" : "HOLD",
      action:
        "Independently verify production target identity, RLS, backups and any missing migrations before considering a supervised, separately authorized change.",
    },
    {
      id: "ORIGINAL_SIGNER_AND_THREE_MASTERS",
      owner: "Original source custodian and three Master reviewers",
      status: "HOLD",
      action:
        "Collect current original SOURCE_HEALTHY and separately signed Master receipts. This page never grants connected status or receiver ON.",
    },
    {
      id: "FORMAL_OWNER_DECISION",
      owner: "Authorized owner in an independent review ceremony",
      status: "HOLD",
      action:
        "Real production approval must use a separately authorized, auditable control-plane decision. This read-only reviewer cannot sign acceptance.",
    },
  ];
  return {
    status: "SUPERVISED_EVIDENCE_REVIEW_SOURCE_ONLY",
    tasks,
    productionMigrationApproved: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}
