/** Build 221: independent, offline attestation corroboration. A signed statement
 * never establishes GitHub issuer custody, the physical signing device, or
 * offsite retention by itself. No network/tenant/receiver actions occur here.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFile, writeFile, lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";
import { verifyRegistrationLedger } from "./build214-owner-custody-register.mjs";
import {
  verifyByteCustodyAttestation,
  reconcileCrossDeviceAuditReceipts,
} from "./build220-byte-custody-closure.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHA = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const SOURCE = "icamp.build221.original-source-provenance-review.v1";
const RETENTION = "icamp.build221.external-archive-retention-review.v1";
const SOURCE_PINS = "icamp.build221.source-reviewer-pins.v1";
const RETENTION_PINS = "icamp.build221.retention-reviewer-pins.v1";
const SIGNED = "icamp.build221.independent-review-signature.v1";
const FIELDS = [
  "schema",
  "repository",
  "sourceId",
  "tenantBoundary",
  "artifactId",
  "runId",
  "jobId",
  "sourceCommitSha",
  "sourceDigest",
  "localByteRecordDigest",
  "ledgerHead",
  "externalEvidenceDigest",
  "reviewerDeviceClaim",
  "keyId",
  "reviewKind",
  "observedAt",
  "expiresAt",
  "originalIssuerAuthenticatedByScript",
  "physicalDeviceAuthenticatedByScript",
  "immutableRetentionAuthenticatedByScript",
  "retentionExceptionClosed",
  "commsTestAuthorized",
];
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const sha = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const utc = (value) => {
  const ms = Date.parse(value ?? "");
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value)
    throw Error("BUILD221_INVALID_TIMESTAMP");
  return ms;
};

function verifyPriorBytes(bundle, now) {
  const { ledger, observation, byteRecord, custodianReceipt, custodianPins } =
    bundle;
  const head = verifyRegistrationLedger(ledger, { now }).headHash;
  const signed = verifyByteCustodyAttestation(
    ledger,
    observation,
    byteRecord,
    custodianReceipt,
    custodianPins,
    { now },
  );
  if (
    byteRecord.ledgerHead !== head ||
    signed.matchingLocalBytesSigned !== true
  )
    throw Error("BUILD221_PRIOR_LEDGER_OR_SIGNED_BYTES_INVALID");
  return { head, byteRecord };
}

/** Preparation is for a *claim* made by an independently authenticated real
 * reviewer, not a way for application code to issue its own authority. */
export function prepareExternalReview(
  bundle,
  {
    kind,
    externalEvidenceDigest,
    reviewerDeviceClaim,
    keyId,
    observedAt = new Date().toISOString(),
    expiresAt = new Date(Date.parse(observedAt) + 12 * 3_600_000).toISOString(),
    now = Date.now(),
  } = {},
) {
  const { head, byteRecord } = verifyPriorBytes(bundle, now);
  if (
    !["SOURCE", "RETENTION"].includes(kind) ||
    !SHA.test(externalEvidenceDigest ?? "") ||
    !KEY.test(reviewerDeviceClaim ?? "") ||
    !KEY.test(keyId ?? "")
  )
    throw Error("BUILD221_REVIEW_SCOPE_REQUIRED");
  return {
    schema: kind === "SOURCE" ? SOURCE : RETENTION,
    repository: "RosevearCreations/iCamp",
    sourceId: "icamp",
    tenantBoundary: "platform_shell",
    artifactId: byteRecord.artifactId,
    runId: byteRecord.sourceIdentity.runId,
    jobId: byteRecord.sourceIdentity.jobId,
    sourceCommitSha: byteRecord.sourceIdentity.commit,
    sourceDigest: byteRecord.sourceDigest,
    localByteRecordDigest: sha(canonicalJson(byteRecord)),
    ledgerHead: head,
    externalEvidenceDigest,
    reviewerDeviceClaim,
    keyId,
    reviewKind:
      kind === "SOURCE"
        ? "INDEPENDENT_GITHUB_ORIGIN_RECORD_REVIEW"
        : "EXTERNAL_IMMUTABLE_STORAGE_AND_EXPIRY_REATTESTATION",
    observedAt,
    expiresAt,
    originalIssuerAuthenticatedByScript: false,
    physicalDeviceAuthenticatedByScript: false,
    immutableRetentionAuthenticatedByScript: false,
    retentionExceptionClosed: false,
    commsTestAuthorized: false,
  };
}

export function signExternalReview(payload, privatePem) {
  const key = createPrivateKey(privatePem);
  if (key.asymmetricKeyType !== "ed25519")
    throw Error("BUILD221_ED25519_REQUIRED");
  return {
    schema: SIGNED,
    keyId: payload.keyId,
    signerFingerprint: publicKeyFingerprint(key),
    payload,
    signatureBase64: sign(
      null,
      Buffer.from(canonicalJson(payload)),
      key,
    ).toString("base64"),
  };
}

export function verifyExternalReview(
  bundle,
  receipt,
  pins,
  kind,
  { now = Date.now() } = {},
) {
  if (kind !== "SOURCE" && kind !== "RETENTION")
    throw Error("BUILD221_UNKNOWN_EXTERNAL_REVIEW_ROLE_DENIED");
  const { head, byteRecord } = verifyPriorBytes(bundle, now);
  const p = receipt?.payload;
  const role =
    kind === "SOURCE"
      ? "ICAMP_INDEPENDENT_ORIGINAL_SOURCE_REVIEWER"
      : "ICAMP_INDEPENDENT_EXTERNAL_ARCHIVE_REVIEWER";
  const schema = kind === "SOURCE" ? SOURCE : RETENTION;
  const pinSchema = kind === "SOURCE" ? SOURCE_PINS : RETENTION_PINS;
  if (
    !exact(receipt, [
      "schema",
      "keyId",
      "signerFingerprint",
      "payload",
      "signatureBase64",
    ]) ||
    receipt.schema !== SIGNED ||
    !exact(p, FIELDS) ||
    p.schema !== schema ||
    p.repository !== "RosevearCreations/iCamp" ||
    p.sourceId !== "icamp" ||
    p.tenantBoundary !== "platform_shell" ||
    p.artifactId !== byteRecord.artifactId ||
    p.runId !== byteRecord.sourceIdentity.runId ||
    p.jobId !== byteRecord.sourceIdentity.jobId ||
    p.sourceCommitSha !== byteRecord.sourceIdentity.commit ||
    !COMMIT.test(p.sourceCommitSha ?? "") ||
    p.sourceDigest !== byteRecord.sourceDigest ||
    p.localByteRecordDigest !== sha(canonicalJson(byteRecord)) ||
    p.ledgerHead !== head ||
    !SHA.test(p.externalEvidenceDigest ?? "") ||
    !KEY.test(p.reviewerDeviceClaim ?? "") ||
    p.reviewKind !==
      (kind === "SOURCE"
        ? "INDEPENDENT_GITHUB_ORIGIN_RECORD_REVIEW"
        : "EXTERNAL_IMMUTABLE_STORAGE_AND_EXPIRY_REATTESTATION") ||
    p.originalIssuerAuthenticatedByScript !== false ||
    p.physicalDeviceAuthenticatedByScript !== false ||
    p.immutableRetentionAuthenticatedByScript !== false ||
    p.retentionExceptionClosed !== false ||
    p.commsTestAuthorized !== false ||
    utc(p.observedAt) > now + 60_000 ||
    utc(p.observedAt) < now - 24 * 3_600_000 ||
    utc(p.expiresAt) <= now ||
    utc(p.expiresAt) <= utc(p.observedAt) ||
    utc(p.expiresAt) - utc(p.observedAt) > 48 * 3_600_000 ||
    pins?.schema !== pinSchema ||
    !Array.isArray(pins.signers)
  )
    throw Error("BUILD221_PROVENANCE_OR_RETENTION_SCOPE_HOLD");
  const matched = pins.signers.filter((x) => x.keyId === p.keyId);
  if (
    matched.length !== 1 ||
    matched[0].role !== role ||
    matched[0].enabled !== true ||
    receipt.keyId !== p.keyId ||
    !SHA.test(receipt.signerFingerprint ?? "") ||
    receipt.signerFingerprint !== matched[0].fingerprint ||
    publicKeyFingerprint(matched[0].publicKeyPem) !== matched[0].fingerprint
  )
    throw Error("BUILD221_INDEPENDENT_SIGNER_PIN_HOLD");
  const sig = Buffer.from(receipt.signatureBase64 ?? "", "base64");
  if (
    sig.length !== 64 ||
    !verify(
      null,
      Buffer.from(canonicalJson(p)),
      createPublicKey(matched[0].publicKeyPem),
      sig,
    )
  )
    throw Error("BUILD221_INVALID_EXTERNAL_REVIEW_SIGNATURE");
  return {
    schema: "icamp.build221.verified-external-claim.v1",
    kind,
    state:
      "PINNED_INDEPENDENT_REVIEW_STATEMENT_VERIFIED_ORIGINAL_FIELD_PROOF_HELD",
    artifactId: p.artifactId,
    statementSha256: sha(canonicalJson(p)),
    signerFingerprint: matched[0].fingerprint,
    claimedDeviceId: p.reviewerDeviceClaim,
    signedClaimCryptographicallyVerified: true,
    originalGitHubIssuerIndependentlyAuthenticated: false,
    offsiteStoragePhysicalIndependenceVerified: false,
    reviewerPhysicalDeviceAuthenticated: false,
    retentionExceptionClosed: false,
    commsTestAuthorized: false,
  };
}

export function auditOwnerClosureEligibility(
  bundle,
  {
    sourceReceipt,
    sourcePins,
    retentionReceipt,
    retentionPins,
    now = Date.now(),
  } = {},
) {
  const ownerAudit = reconcileCrossDeviceAuditReceipts({ ...bundle, now });
  const source = verifyExternalReview(
    bundle,
    sourceReceipt,
    sourcePins,
    "SOURCE",
    { now },
  );
  const retention = verifyExternalReview(
    bundle,
    retentionReceipt,
    retentionPins,
    "RETENTION",
    { now },
  );
  const existing = [
    bundle.ownerClosureReceipt.signerFingerprint,
    bundle.runnerReceipt.signerFingerprint,
    bundle.manifestReceipt.signerFingerprint,
    bundle.custodianReceipt.signerFingerprint,
  ];
  if (
    new Set([
      ...existing,
      source.signerFingerprint,
      retention.signerFingerprint,
    ]).size !== 6 ||
    new Set([
      bundle.ownerClosureReceipt.request.claimedOwnerDeviceId,
      bundle.custodianReceipt.request.claimedOriginalDeviceId,
      source.claimedDeviceId,
      retention.claimedDeviceId,
    ]).size !== 4
  )
    throw Error("BUILD221_REUSED_SIGNER_OR_CLAIMED_DEVICE_HOLD");
  return {
    schema: "icamp.build221.owner-governed-closure-eligibility.v1",
    state:
      "INDEPENDENT_SIGNED_SOURCE_AND_RETENTION_CLAIMS_REVIEWED_ORIGINAL_FIELD_EVIDENCE_HOLD",
    artifactId: ownerAudit.artifactId,
    ownerDecision: ownerAudit.ownerDecision,
    priorFourSignersIndependentlyPinned:
      ownerAudit.distinctCryptographicSignerKeys,
    sixDistinctCryptographicSigners: true,
    signedExternalSourceReviewVerified:
      source.signedClaimCryptographicallyVerified,
    signedExternalRetentionReviewVerified:
      retention.signedClaimCryptographicallyVerified,
    originalSourceProvenanceIndependentlyEstablished: false,
    offsiteStorageDurabilityIndependentlyEstablished: false,
    originalDevicesIndependentlyAuthenticated: false,
    eligibleForFurtherOwnerFieldReview:
      ownerAudit.ownerDecision === "APPROVE_CLOSURE_REVIEW",
    retentionExceptionClosed: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
    customerCommunications: false,
    deviceActions: false,
    connectionState: "DISCONNECTED / HOLD",
  };
}

export function analyzeBuild221Ci() {
  return {
    schema: "icamp.build221.source-retention-audit-ci-handoff.v1",
    externalOriginalEvidenceImportedToCI: false,
    originalPrivateSigningKeysInCI: false,
    syntheticTestsAreNotGenuinePrivateTEST: true,
    autonomousConnectionAllowed: false,
    retentionAutomaticallyClosed: false,
    allFiveProtectedChecksPreserved: true,
  };
}

async function privatePath(path) {
  if (
    !isAbsolute(path) ||
    resolve(path) === ROOT ||
    resolve(path).startsWith(ROOT + sep)
  )
    throw Error("BUILD221_PRIVATE_EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY");
  const parent = await realpath(dirname(resolve(path)));
  if (parent === ROOT || parent.startsWith(ROOT + sep))
    throw Error("BUILD221_SYMLINK_PARENT_REFUSED");
  try {
    if (!(await lstat(path)).isFile())
      throw Error("BUILD221_SYMLINK_OR_DIRECTORY_REFUSED");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function readPrivate(path) {
  await privatePath(path);
  const bytes = await readFile(path, "utf8");
  if (bytes.length > 2_000_000)
    throw Error("BUILD221_PRIVATE_EVIDENCE_SIZE_DENIED");
  return JSON.parse(bytes);
}
async function writePrivate(path, obj) {
  await privatePath(path);
  await writeFile(path, JSON.stringify(obj, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
async function main([command, ...args]) {
  if (command === "prepare" && args.length === 6) {
    const [bundle, kind, digest, device, keyId, out] = args;
    return writePrivate(
      out,
      prepareExternalReview(await readPrivate(bundle), {
        kind,
        externalEvidenceDigest: digest,
        reviewerDeviceClaim: device,
        keyId,
      }),
    );
  }
  if (
    command === "sign" &&
    args.length === 4 &&
    args[3] === "--confirm-original-device-signature"
  ) {
    const [request, privatePem, out] = args;
    await privatePath(privatePem);
    return writePrivate(
      out,
      signExternalReview(
        await readPrivate(request),
        await readFile(privatePem, "utf8"),
      ),
    );
  }
  if (command === "verify" && args.length === 4) {
    const [bundle, receipt, pins, kind] = args;
    return console.log(
      JSON.stringify(
        verifyExternalReview(
          await readPrivate(bundle),
          await readPrivate(receipt),
          await readPrivate(pins),
          kind,
        ),
      ),
    );
  }
  if (
    command === "audit" &&
    args.length === 5 &&
    args[4] === "--confirm-readonly-review"
  ) {
    throw Error("BUILD221_RETENTION_PINS_REQUIRED_SEPARATELY");
  }
  if (
    command === "audit" &&
    args.length === 6 &&
    args[5] === "--confirm-readonly-review"
  ) {
    const [bundle, sourceReceipt, sourcePins, retentionReceipt, retentionPins] =
      args;
    return console.log(
      JSON.stringify(
        auditOwnerClosureEligibility(await readPrivate(bundle), {
          sourceReceipt: await readPrivate(sourceReceipt),
          sourcePins: await readPrivate(sourcePins),
          retentionReceipt: await readPrivate(retentionReceipt),
          retentionPins: await readPrivate(retentionPins),
        }),
      ),
    );
  }
  throw Error(
    "BUILD221_USAGE: prepare <bundle> SOURCE|RETENTION <sha256:...> <device> <keyId> <out>; sign <request> <private.pem> <out> --confirm-original-device-signature; verify <bundle> <receipt> <pins> SOURCE|RETENTION; audit <bundle> <source-receipt> <source-pins> <retention-receipt> <retention-pins> --confirm-readonly-review",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD221_OFFLINE_REVIEW_FAILED",
    );
    process.exitCode = 1;
  });
}
