import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify as verifySignature,
} from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";
import {
  readExternalRegistrationLedger,
  verifyRegistrationLedger,
} from "./build214-owner-custody-register.mjs";
import { verifyExceptionAcknowledgement } from "./build218-source-recheck-portability.mjs";
import {
  verifyPortabilityManifest,
  verifyRunnerAttestation,
  reviewRetentionExceptionClosure,
} from "./build219-runner-manifest-closure.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOUR = 3_600_000;
const MAX_BYTES = 100 * 1024 * 1024;
const HASH = /^sha256:[0-9a-f]{64}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const NONCE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BYTE = "icamp.build220.local-archive-byte-readback.v1";
const CUSTODY_REQUEST = "icamp.build220.independent-byte-custody-request.v1";
const CUSTODY_RECEIPT = "icamp.build220.signed-byte-custody-receipt.v1";
const CUSTODY_PINS = "icamp.build220.independent-byte-custodian-pins.v1";
const CLOSURE_REQUEST = "icamp.build220.owner-exception-closure-request.v1";
const CLOSURE_RECEIPT = "icamp.build220.signed-owner-exception-closure.v1";
const OWNER_PINS = "icamp.build216.owner-renewal-pins.v1";
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const digest = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
function at(value) {
  const ms = Date.parse(value ?? "");
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value)
    throw new Error("BUILD220_INVALID_TIMESTAMP");
  return ms;
}
function timeBound(request, now) {
  if (
    !NONCE.test(request?.nonce ?? "") ||
    !KEY.test(request.keyId ?? "") ||
    at(request.issuedAt) > now + 60_000 ||
    at(request.expiresAt) <= now ||
    at(request.expiresAt) <= at(request.issuedAt) ||
    at(request.expiresAt) - at(request.issuedAt) > 48 * HOUR
  )
    throw new Error("BUILD220_SIGNATURE_SCOPE_OR_TIME_INVALID");
}
async function external(path) {
  if (
    !isAbsolute(path) ||
    resolve(path) === ROOT ||
    resolve(path).startsWith(`${ROOT}${sep}`)
  )
    throw new Error("BUILD220_PRIVATE_PATH_MUST_BE_OUTSIDE_CHECKOUT");
  const parent = await realpath(dirname(resolve(path)));
  if (parent === ROOT || parent.startsWith(`${ROOT}${sep}`))
    throw new Error("BUILD220_PRIVATE_SYMLINK_PARENT_REFUSED");
  try {
    if (!(await lstat(path)).isFile())
      throw new Error("BUILD220_SYMLINK_OR_DIRECTORY_REFUSED");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function input(path) {
  await external(path);
  const raw = await readFile(path, "utf8");
  if (raw.length > 2_000_000) throw new Error("BUILD220_INPUT_TOO_LARGE");
  return JSON.parse(raw);
}
async function output(path, data) {
  await external(path);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}
function archiveRegistration(ledger, artifactId, now) {
  const audit = verifyRegistrationLedger(ledger, { now });
  const entries = ledger.filter(
    (row) =>
      row.kind === "VERIFIED_ARCHIVE_COPY" &&
      row.sourceIdentity.artifactId === artifactId,
  );
  if (!Number.isSafeInteger(artifactId) || artifactId < 1 || !entries.length)
    throw new Error("BUILD220_ORIGINAL_ARCHIVE_REGISTRATION_NOT_FOUND");
  const first = entries[0];
  if (
    entries.some(
      (row) =>
        row.sourceDigest !== first.sourceDigest ||
        row.sourceIdentity.runId !== first.sourceIdentity.runId ||
        row.sourceIdentity.jobId !== first.sourceIdentity.jobId ||
        row.sourceIdentity.commit !== first.sourceIdentity.commit,
    )
  )
    throw new Error("BUILD220_CROSS_CUSTODIAN_SOURCE_IDENTITY_CONFLICT");
  return { first, entries, audit };
}

export async function readActualArchiveBytes({
  ledger,
  observation,
  archivePath,
  now = Date.now(),
  maxBytes = MAX_BYTES,
  confirmedReadOnly = false,
}) {
  if (
    confirmedReadOnly !== true ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > MAX_BYTES
  )
    throw new Error("BUILD220_EXPLICIT_OWNER_READONLY_BYTE_REVIEW_REQUIRED");
  const { first, entries, audit } = archiveRegistration(
    ledger,
    observation?.artifactId,
    now,
  );
  if (
    observation?.schema !== "icamp.build218.original-source-recheck.v1" ||
    observation.state !==
      "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED" ||
    observation.originalArtifactBytesDownloaded !== false ||
    observation.originalRetentionRenewed !== false ||
    observation.runId !== first.sourceIdentity.runId ||
    observation.jobId !== first.sourceIdentity.jobId ||
    at(observation.observedAt) > now + 60_000
  )
    throw new Error("BUILD220_ORIGINAL_SOURCE_METADATA_AND_OWNER_GATE_HOLD");
  await external(archivePath);
  const meta = await lstat(archivePath);
  if (meta.size < 4 || meta.size > maxBytes)
    throw new Error("BUILD220_ARCHIVE_SIZE_NOT_APPROVED");
  const sha = createHash("sha256");
  let size = 0;
  let header = Buffer.alloc(0);
  for await (const chunk of createReadStream(archivePath, {
    highWaterMark: 64 * 1024,
  })) {
    size += chunk.length;
    if (size > maxBytes)
      throw new Error("BUILD220_ARCHIVE_SIZE_LIMIT_EXCEEDED");
    if (header.length < 4)
      header = Buffer.concat([header, chunk]).subarray(0, 4);
    sha.update(chunk);
  }
  if (size !== meta.size || header.toString("hex") !== "504b0304")
    throw new Error("BUILD220_ORIGINAL_ZIP_CONTAINER_HEADER_OR_SIZE_INVALID");
  const actual = `sha256:${sha.digest("hex")}`;
  return {
    schema: BYTE,
    repository: "RosevearCreations/iCamp",
    artifactId: observation.artifactId,
    sourceIdentity: first.sourceIdentity,
    sourceDigest: first.sourceDigest,
    localByteDigest: actual,
    byteCount: size,
    observedAt: new Date(now).toISOString(),
    sourceMetadataObservationDigest: digest(canonicalJson(observation)),
    ledgerHead: audit.headHash,
    custodianRegistrationsCompared: entries.length,
    state:
      actual === first.sourceDigest
        ? "LOCAL_ZIP_BYTES_MATCH_PINNED_ORIGINAL_DIGEST_SOURCE_PROVENANCE_HOLD"
        : "LOCAL_ZIP_DIGEST_CONFLICT_QUARANTINED_HOLD",
    zipHeaderObserved: true,
    localDigestMatchedPinnedSource: actual === first.sourceDigest,
    originalGitHubDownloadProvenanceAuthenticated: false,
    independentDeviceIdentityProvenByScript: false,
    independentOffsiteDurabilityVerified: false,
    originalGitHubArtifactExpiryRenewed: false,
    retentionExceptionClosed: false,
    commsTestAuthorized: false,
  };
}
function validateByteRecord(ledger, observation, record, now) {
  const { first, audit } = archiveRegistration(
    ledger,
    observation?.artifactId,
    now,
  );
  if (
    record?.schema !== BYTE ||
    observation?.schema !== "icamp.build218.original-source-recheck.v1" ||
    observation.state !==
      "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED" ||
    observation.runId !== first.sourceIdentity.runId ||
    observation.jobId !== first.sourceIdentity.jobId ||
    record.repository !== "RosevearCreations/iCamp" ||
    record.artifactId !== observation.artifactId ||
    canonicalJson(record.sourceIdentity) !==
      canonicalJson(first.sourceIdentity) ||
    record.sourceDigest !== first.sourceDigest ||
    !HASH.test(record.localByteDigest ?? "") ||
    !Number.isSafeInteger(record.byteCount) ||
    record.byteCount < 4 ||
    record.byteCount > MAX_BYTES ||
    record.sourceMetadataObservationDigest !==
      digest(canonicalJson(observation)) ||
    record.ledgerHead !== audit.headHash ||
    !Number.isSafeInteger(record.custodianRegistrationsCompared) ||
    record.zipHeaderObserved !== true ||
    record.originalGitHubDownloadProvenanceAuthenticated !== false ||
    record.independentDeviceIdentityProvenByScript !== false ||
    record.independentOffsiteDurabilityVerified !== false ||
    record.originalGitHubArtifactExpiryRenewed !== false ||
    record.retentionExceptionClosed !== false ||
    record.commsTestAuthorized !== false ||
    at(record.observedAt) > now + 60_000 ||
    at(record.observedAt) < now - 7 * 24 * HOUR ||
    (record.localByteDigest === first.sourceDigest) !==
      record.localDigestMatchedPinnedSource ||
    record.state !==
      (record.localDigestMatchedPinnedSource
        ? "LOCAL_ZIP_BYTES_MATCH_PINNED_ORIGINAL_DIGEST_SOURCE_PROVENANCE_HOLD"
        : "LOCAL_ZIP_DIGEST_CONFLICT_QUARANTINED_HOLD")
  )
    throw new Error("BUILD220_UNVERIFIED_OR_DRIFTED_BYTE_READBACK");
  if (!record.localDigestMatchedPinnedSource)
    throw new Error(
      "BUILD220_ORIGINAL_BYTES_MATCH_REQUIRED_FOR_CUSTODY_SIGNATURE",
    );
  return record;
}
function requestEnvelope(schema, purpose, keyId, now, validHours) {
  if (
    !KEY.test(keyId ?? "") ||
    !Number.isSafeInteger(validHours) ||
    validHours < 1 ||
    validHours > 48
  )
    throw new Error("BUILD220_INVALID_SIGNING_SCOPE");
  return {
    schema,
    repository: "RosevearCreations/iCamp",
    purpose,
    keyId,
    nonce: randomUUID(),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validHours * HOUR).toISOString(),
  };
}
function signature(request, schema, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("BUILD220_ED25519_KEY_REQUIRED");
  return {
    schema,
    algorithm: "Ed25519",
    request,
    signerFingerprint: publicKeyFingerprint(key),
    signatureBase64: sign(
      null,
      Buffer.from(canonicalJson({ schema, request })),
      key,
    ).toString("base64"),
  };
}
function validatePinnedSignature(
  receipt,
  requestSchema,
  receiptSchema,
  pins,
  pinSchema,
  role,
  now,
  consumed,
) {
  if (
    receipt?.schema !== receiptSchema ||
    receipt.algorithm !== "Ed25519" ||
    receipt.request?.schema !== requestSchema ||
    receipt.request.repository !== "RosevearCreations/iCamp" ||
    !HASH.test(receipt.signerFingerprint ?? "") ||
    !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64 ?? "") ||
    pins?.schema !== pinSchema ||
    !Array.isArray(pins.signers)
  )
    throw new Error("BUILD220_INVALID_SIGNED_RECEIPT_OR_PINS");
  timeBound(receipt.request, now);
  if (consumed.has(receipt.request.nonce))
    throw new Error("BUILD220_REPLAYED_NONCE");
  const matches = pins.signers.filter(
    (row) => row.keyId === receipt.request.keyId,
  );
  if (
    matches.length !== 1 ||
    matches[0].enabled !== true ||
    matches[0].role !== role ||
    publicKeyFingerprint(matches[0].publicKeyPem) !== matches[0].fingerprint ||
    matches[0].fingerprint !== receipt.signerFingerprint
  )
    throw new Error("BUILD220_INDEPENDENT_PIN_REQUIRED");
  const bytes = Buffer.from(receipt.signatureBase64, "base64");
  if (
    bytes.length !== 64 ||
    !verifySignature(
      null,
      Buffer.from(
        canonicalJson({ schema: receiptSchema, request: receipt.request }),
      ),
      createPublicKey(matches[0].publicKeyPem),
      bytes,
    )
  )
    throw new Error("BUILD220_SIGNATURE_INVALID");
  consumed.add(receipt.request.nonce);
  return matches[0];
}

export function prepareByteCustodyAttestation(
  ledger,
  observation,
  byteRecord,
  { keyId, claimedOriginalDeviceId, now = Date.now(), validHours = 12 } = {},
) {
  validateByteRecord(ledger, observation, byteRecord, now);
  if (
    !byteRecord.localDigestMatchedPinnedSource ||
    !KEY.test(claimedOriginalDeviceId ?? "")
  )
    throw new Error("BUILD220_ORIGINAL_BYTES_MATCH_AND_DEVICE_CLAIM_REQUIRED");
  return {
    ...requestEnvelope(
      CUSTODY_REQUEST,
      "CUSTODIAN_SIGNED_LOCAL_ZIP_DIGEST_NOT_INDEPENDENT_PROVENANCE",
      keyId,
      now,
      validHours,
    ),
    artifactId: byteRecord.artifactId,
    byteRecordDigest: digest(canonicalJson(byteRecord)),
    pinnedSourceDigest: byteRecord.sourceDigest,
    ledgerHead: byteRecord.ledgerHead,
    claimedOriginalDeviceId,
    realWorldDeviceIdentityVerifiedByScript: false,
    independentlyImmutableStorageProven: false,
    retentionExceptionClosed: false,
    commsTestAuthorized: false,
  };
}
function validateCustodyRequest(ledger, observation, byteRecord, request, now) {
  validateByteRecord(ledger, observation, byteRecord, now);
  if (
    request?.schema !== CUSTODY_REQUEST ||
    !exactKeys(request, [
      "schema",
      "repository",
      "purpose",
      "keyId",
      "nonce",
      "issuedAt",
      "expiresAt",
      "artifactId",
      "byteRecordDigest",
      "pinnedSourceDigest",
      "ledgerHead",
      "claimedOriginalDeviceId",
      "realWorldDeviceIdentityVerifiedByScript",
      "independentlyImmutableStorageProven",
      "retentionExceptionClosed",
      "commsTestAuthorized",
    ]) ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !==
      "CUSTODIAN_SIGNED_LOCAL_ZIP_DIGEST_NOT_INDEPENDENT_PROVENANCE" ||
    request.artifactId !== byteRecord.artifactId ||
    request.byteRecordDigest !== digest(canonicalJson(byteRecord)) ||
    request.pinnedSourceDigest !== byteRecord.sourceDigest ||
    request.ledgerHead !== byteRecord.ledgerHead ||
    !KEY.test(request.claimedOriginalDeviceId ?? "") ||
    request.realWorldDeviceIdentityVerifiedByScript !== false ||
    request.independentlyImmutableStorageProven !== false ||
    request.retentionExceptionClosed !== false ||
    request.commsTestAuthorized !== false
  )
    throw new Error("BUILD220_BYTE_CUSTODY_CLAIM_DRIFT_OR_SCOPE_MISMATCH");
  timeBound(request, now);
}
export function signByteCustodyAttestation(
  ledger,
  observation,
  byteRecord,
  request,
  privateKeyPem,
  now = Date.now(),
) {
  validateCustodyRequest(ledger, observation, byteRecord, request, now);
  return signature(request, CUSTODY_RECEIPT, privateKeyPem);
}
export function verifyByteCustodyAttestation(
  ledger,
  observation,
  byteRecord,
  receipt,
  pins,
  { now = Date.now(), consumedNonces = new Set() } = {},
) {
  validateCustodyRequest(
    ledger,
    observation,
    byteRecord,
    receipt?.request,
    now,
  );
  validatePinnedSignature(
    receipt,
    CUSTODY_REQUEST,
    CUSTODY_RECEIPT,
    pins,
    CUSTODY_PINS,
    "ICAMP_INDEPENDENT_ARCHIVE_BYTE_CUSTODIAN",
    now,
    consumedNonces,
  );
  return {
    schema: "icamp.build220.verified-local-byte-custody-signature.v1",
    state:
      "PINNED_CUSTODIAN_SIGNED_MATCHING_LOCAL_ZIP_SOURCE_AND_STORAGE_PROVENANCE_HOLD",
    artifactId: byteRecord.artifactId,
    custodianDeviceClaim: receipt.request.claimedOriginalDeviceId,
    signerFingerprint: receipt.signerFingerprint,
    matchingLocalBytesSigned: true,
    deviceIdentityIndependentlyAuthenticated: false,
    originalSourceDownloadIndependentlyVerified: false,
    immutableOffsiteArchiveVerified: false,
    commsTestAuthorized: false,
  };
}

export function prepareOwnerClosureDecision({
  ledger,
  exceptionReceipt,
  ownerPins,
  schedule,
  observation,
  runnerReceipt,
  runnerPins,
  report,
  manifestReceipt,
  manifestPins,
  byteRecord,
  custodianReceipt,
  custodianPins,
  decision,
  ownerKeyId,
  claimedOwnerDeviceId,
  now = Date.now(),
  validHours = 12,
}) {
  reviewRetentionExceptionClosure({
    ledger,
    exceptionReceipt,
    ownerPins,
    schedule,
    observation,
    runnerReceipt,
    runnerPins,
    report,
    manifestReceipt,
    manifestPins,
    now,
  });
  verifyByteCustodyAttestation(
    ledger,
    observation,
    byteRecord,
    custodianReceipt,
    custodianPins,
    { now },
  );
  if (
    ![
      "APPROVE_CLOSURE_REVIEW",
      "DEFER_CLOSURE_REVIEW",
      "REJECT_CLOSURE_REVIEW",
    ].includes(decision) ||
    !KEY.test(claimedOwnerDeviceId ?? "") ||
    ownerKeyId === custodianReceipt.request.keyId
  )
    throw new Error("BUILD220_OWNER_CLOSURE_REVIEW_CHOICE_OR_DEVICE_INVALID");
  const ledgerHead = verifyRegistrationLedger(ledger, { now }).headHash;
  return {
    ...requestEnvelope(
      CLOSURE_REQUEST,
      "OWNER_CLOSURE_REVIEW_ONLY_NOT_AUTOMATIC_SOURCE_RETENTION_RENEWAL",
      ownerKeyId,
      now,
      validHours,
    ),
    decision,
    targetSequence: exceptionReceipt.request.targetSequence,
    artifactId: byteRecord.artifactId,
    exceptionAcknowledgementDigest: digest(canonicalJson(exceptionReceipt)),
    runnerAttestationDigest: digest(canonicalJson(runnerReceipt)),
    portabilityManifestDigest: digest(canonicalJson(manifestReceipt)),
    originalZipReadbackDigest: digest(canonicalJson(byteRecord)),
    custodianSignatureDigest: digest(canonicalJson(custodianReceipt)),
    ledgerHead,
    claimedOwnerDeviceId,
    identityAndDeviceProvenByScript: false,
    originalArchiveSourceDownloadIndependentlyProven: false,
    immutableOffsiteStorageProven: false,
    exceptionAutomaticallyClosed: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}
export function signOwnerClosureDecision(
  request,
  privateKeyPem,
  now = Date.now(),
) {
  timeBound(request, now);
  if (request.schema !== CLOSURE_REQUEST)
    throw new Error("BUILD220_INVALID_OWNER_CLOSURE_REQUEST");
  return signature(request, CLOSURE_RECEIPT, privateKeyPem);
}
export function reconcileCrossDeviceAuditReceipts({
  ledger,
  exceptionReceipt,
  ownerPins,
  schedule,
  observation,
  runnerReceipt,
  runnerPins,
  report,
  manifestReceipt,
  manifestPins,
  byteRecord,
  custodianReceipt,
  custodianPins,
  ownerClosureReceipt,
  now = Date.now(),
  consumedNonces = new Set(),
}) {
  const acknowledgement = verifyExceptionAcknowledgement(
    ledger,
    exceptionReceipt,
    ownerPins,
    { now },
  );
  const runner = verifyRunnerAttestation(
    schedule,
    observation,
    runnerReceipt,
    runnerPins,
    { now },
  );
  const manifest = verifyPortabilityManifest(
    report,
    manifestReceipt,
    manifestPins,
    {
      now,
      ownerPins,
      runnerPins,
    },
  );
  const custodian = verifyByteCustodyAttestation(
    ledger,
    observation,
    byteRecord,
    custodianReceipt,
    custodianPins,
    { now },
  );
  const req = ownerClosureReceipt?.request;
  const expected = prepareOwnerClosureDecision({
    ledger,
    exceptionReceipt,
    ownerPins,
    schedule,
    observation,
    runnerReceipt,
    runnerPins,
    report,
    manifestReceipt,
    manifestPins,
    byteRecord,
    custodianReceipt,
    custodianPins,
    decision: req?.decision,
    ownerKeyId: req?.keyId,
    claimedOwnerDeviceId: req?.claimedOwnerDeviceId,
    now,
  });
  for (const key of [
    "decision",
    "targetSequence",
    "artifactId",
    "exceptionAcknowledgementDigest",
    "runnerAttestationDigest",
    "portabilityManifestDigest",
    "originalZipReadbackDigest",
    "custodianSignatureDigest",
    "ledgerHead",
    "claimedOwnerDeviceId",
    "identityAndDeviceProvenByScript",
    "originalArchiveSourceDownloadIndependentlyProven",
    "immutableOffsiteStorageProven",
    "exceptionAutomaticallyClosed",
    "productionApprovalGranted",
    "commsTestAuthorized",
  ]) {
    if (req?.[key] !== expected[key])
      throw new Error("BUILD220_OWNER_CLOSURE_SOURCE_OR_LEDGER_DRIFT");
  }
  if (
    !exactKeys(req, [
      "schema",
      "repository",
      "purpose",
      "keyId",
      "nonce",
      "issuedAt",
      "expiresAt",
      "decision",
      "targetSequence",
      "artifactId",
      "exceptionAcknowledgementDigest",
      "runnerAttestationDigest",
      "portabilityManifestDigest",
      "originalZipReadbackDigest",
      "custodianSignatureDigest",
      "ledgerHead",
      "claimedOwnerDeviceId",
      "identityAndDeviceProvenByScript",
      "originalArchiveSourceDownloadIndependentlyProven",
      "immutableOffsiteStorageProven",
      "exceptionAutomaticallyClosed",
      "productionApprovalGranted",
      "commsTestAuthorized",
    ])
  )
    throw new Error("BUILD220_OWNER_CLOSURE_UNEXPECTED_FIELDS");
  if (req?.purpose !== expected.purpose)
    throw new Error("BUILD220_OWNER_CLOSURE_PURPOSE_INVALID");
  const owner = validatePinnedSignature(
    ownerClosureReceipt,
    CLOSURE_REQUEST,
    CLOSURE_RECEIPT,
    ownerPins,
    OWNER_PINS,
    "ICAMP_CUSTODY_RENEWAL_OWNER",
    now,
    consumedNonces,
  );
  const fingerprints = [
    owner.fingerprint,
    runnerReceipt.signerFingerprint,
    manifestReceipt.signerFingerprint,
    custodianReceipt.signerFingerprint,
  ];
  if (
    new Set(fingerprints).size !== 4 ||
    req.claimedOwnerDeviceId === custodian.custodianDeviceClaim
  )
    throw new Error("BUILD220_CROSS_DEVICE_SIGNER_OR_DEVICE_CLAIM_CONFLICT");
  return {
    schema: "icamp.build220.cross-device-retention-audit.v1",
    state:
      req.decision === "APPROVE_CLOSURE_REVIEW"
        ? "OWNER_SIGNED_REVIEW_CANDIDATE_SOURCE_PROVENANCE_AND_STORAGE_HOLD"
        : "OWNER_DEFERRED_OR_REJECTED_CLOSURE_HOLD",
    artifactId: byteRecord.artifactId,
    targetSequence: acknowledgement.targetSequence,
    ownerDecision: req.decision,
    localOriginalByteDigestMatched: byteRecord.localDigestMatchedPinnedSource,
    verifiedRunnerSignature: runner.signatureAndPinVerified,
    verifiedManifestSignature: manifest.signatureAndPinVerified,
    verifiedByteCustodianSignature: custodian.matchingLocalBytesSigned,
    verifiedOwnerClosureReviewSignature: true,
    distinctCryptographicSignerKeys: true,
    independentOriginalDeviceIdentityEstablished: false,
    originalDownloadProvenanceVerified: false,
    independentOffsiteStorageVerified: false,
    retentionExceptionClosed: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function analyzeBuild220Ci(previous) {
  return {
    schema:
      "icamp.build220.external-byte-custody-and-cross-device-closure-ci-handoff.v1",
    state: "REAL_ORIGINAL_ZIP_BYTES_AND_INDEPENDENT_SIGNERS_NOT_IMPORTED_HOLD",
    previousHandoff: previous?.state ?? null,
    originalArtifactBytesInCi: false,
    privateOwnerOrCustodianKeysInCi: false,
    automatedOwnerClosure: false,
    externalSourceWritesOrNetworkReads: false,
    protectedChecksChanged: false,
    commsTestAuthorized: false,
  };
}

async function main([command, ...v]) {
  if (
    command === "byte-readback" &&
    v.length === 5 &&
    v[4] === "--confirm-owner-local-readonly"
  ) {
    const [ledger, observation, archive, out] = v;
    return output(
      out,
      await readActualArchiveBytes({
        ledger: await readExternalRegistrationLedger(ledger),
        observation: await input(observation),
        archivePath: archive,
        confirmedReadOnly: true,
      }),
    );
  }
  if (command === "custodian-prepare" && v.length === 6) {
    const [ledger, observation, bytes, keyId, deviceId, out] = v;
    return output(
      out,
      prepareByteCustodyAttestation(
        await readExternalRegistrationLedger(ledger),
        await input(observation),
        await input(bytes),
        { keyId, claimedOriginalDeviceId: deviceId },
      ),
    );
  }
  if (
    command === "custodian-sign" &&
    v.length === 7 &&
    v[6] === "--confirm-original-device-signature"
  ) {
    const [ledger, observation, bytes, request, key, out] = v;
    await external(key);
    return output(
      out,
      signByteCustodyAttestation(
        await readExternalRegistrationLedger(ledger),
        await input(observation),
        await input(bytes),
        await input(request),
        await readFile(key, "utf8"),
      ),
    );
  }
  if (command === "custodian-verify" && v.length === 5) {
    const [ledger, observation, bytes, receipt, pins] = v;
    return console.log(
      JSON.stringify(
        verifyByteCustodyAttestation(
          await readExternalRegistrationLedger(ledger),
          await input(observation),
          await input(bytes),
          await input(receipt),
          await input(pins),
        ),
      ),
    );
  }
  if (command === "closure-prepare" && v.length === 17) {
    const [
      ledger,
      ack,
      ownerPins,
      schedule,
      observation,
      runner,
      runnerPins,
      report,
      manifest,
      manifestPins,
      bytes,
      custodian,
      custodianPins,
      decision,
      keyId,
      deviceId,
      out,
    ] = v;
    return output(
      out,
      prepareOwnerClosureDecision({
        ledger: await readExternalRegistrationLedger(ledger),
        exceptionReceipt: await input(ack),
        ownerPins: await input(ownerPins),
        schedule: await input(schedule),
        observation: await input(observation),
        runnerReceipt: await input(runner),
        runnerPins: await input(runnerPins),
        report: await input(report),
        manifestReceipt: await input(manifest),
        manifestPins: await input(manifestPins),
        byteRecord: await input(bytes),
        custodianReceipt: await input(custodian),
        custodianPins: await input(custodianPins),
        decision,
        ownerKeyId: keyId,
        claimedOwnerDeviceId: deviceId,
      }),
    );
  }
  if (
    command === "closure-sign" &&
    v.length === 4 &&
    v[3] === "--confirm-original-owner-signature"
  ) {
    const [request, key, out] = v;
    await external(key);
    return output(
      out,
      signOwnerClosureDecision(
        await input(request),
        await readFile(key, "utf8"),
      ),
    );
  }
  if (
    command === "closure-verify" &&
    v.length === 15 &&
    v[14] === "--confirm-review-only"
  ) {
    const [
      ledger,
      ack,
      ownerPins,
      schedule,
      observation,
      runner,
      runnerPins,
      report,
      manifest,
      manifestPins,
      bytes,
      custodian,
      custodianPins,
      closure,
    ] = v;
    return console.log(
      JSON.stringify(
        reconcileCrossDeviceAuditReceipts({
          ledger: await readExternalRegistrationLedger(ledger),
          exceptionReceipt: await input(ack),
          ownerPins: await input(ownerPins),
          schedule: await input(schedule),
          observation: await input(observation),
          runnerReceipt: await input(runner),
          runnerPins: await input(runnerPins),
          report: await input(report),
          manifestReceipt: await input(manifest),
          manifestPins: await input(manifestPins),
          byteRecord: await input(bytes),
          custodianReceipt: await input(custodian),
          custodianPins: await input(custodianPins),
          ownerClosureReceipt: await input(closure),
        }),
      ),
    );
  }
  throw new Error(
    "BUILD220_USAGE: byte-readback|custodian-prepare|custodian-sign|custodian-verify|closure-prepare|closure-sign|closure-verify; see docs/BUILD_220_ORIGINAL_BYTES_OWNER_CLOSURE.md",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "BUILD220_PRIVATE_EVIDENCE_WORKBENCH_FAILED",
    );
    process.exitCode = 1;
  });
}
