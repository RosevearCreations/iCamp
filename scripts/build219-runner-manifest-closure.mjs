import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify as verifySignature,
} from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";
import { readExternalRegistrationLedger } from "./build214-owner-custody-register.mjs";
import { verifyExceptionAcknowledgement } from "./build218-source-recheck-portability.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOUR = 3_600_000;
const HASH = /^sha256:[0-9a-f]{64}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const NONCE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RUNNER_REQUEST = "icamp.build219.readonly-runner-attestation-request.v1";
const RUNNER_RECEIPT = "icamp.build219.signed-readonly-runner-attestation.v1";
const MANIFEST_REQUEST = "icamp.build219.portability-manifest-request.v1";
const MANIFEST_RECEIPT = "icamp.build219.signed-portability-manifest.v1";
const RUNNER_PINS = "icamp.build219.independent-runner-pins.v1";
const MANIFEST_PINS = "icamp.build219.independent-portability-pins.v1";
const RECHECK = "icamp.build218.original-source-recheck.v1";
const SCHEDULE = "icamp.build218.owner-scoped-source-recheck-schedule.v1";
const EXPORT = "icamp.build218.cross-custodian-redacted-portability.v1";
const observedStates = new Set([
  "SOURCE_UNAVAILABLE_REVIEW_HOLD",
  "GITHUB_METADATA_FETCH_OR_PARSE_FAILED_HOLD",
  "GITHUB_SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD",
  "GITHUB_ORIGINAL_ARTIFACT_EXPIRED_HOLD",
  "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED",
]);
const digest = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
function at(value) {
  const ms = Date.parse(value ?? "");
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value)
    throw new Error("BUILD219_INVALID_TIMESTAMP");
  return ms;
}
function ensureWindow(request, now) {
  const start = at(request.issuedAt);
  const end = at(request.expiresAt);
  if (
    start > now + 60_000 ||
    end <= now ||
    end <= start ||
    end - start > 48 * HOUR
  )
    throw new Error("BUILD219_ATTESTATION_EXPIRED_OR_OUT_OF_SCOPE");
}
function matchObservation(schedule, observation, now) {
  if (
    schedule?.schema !== SCHEDULE ||
    !Array.isArray(schedule.tasks) ||
    schedule.automaticNetworkCalls !== false ||
    schedule.externalSchedulerInstalled !== false ||
    observation?.schema !== RECHECK ||
    !observedStates.has(observation.state) ||
    !Number.isSafeInteger(observation.artifactId) ||
    observation.originalArtifactBytesDownloaded !== false ||
    observation.originalRetentionRenewed !== false ||
    observation.commsTestAuthorized !== false ||
    observation.durableArchiveStorageVerified !== false ||
    observation.originalJobAssociationIndependentlyVerified !== false ||
    at(observation.observedAt) > now + 60_000 ||
    at(observation.observedAt) < now - 30 * 24 * HOUR
  )
    throw new Error("BUILD219_UNTRUSTED_OR_UNSCOPED_RECHECK");
  const tasks = schedule.tasks.filter(
    (task) =>
      task.taskKey === observation.taskKey &&
      task.artifactId === observation.artifactId,
  );
  if (
    tasks.length !== 1 ||
    tasks[0].ownerSignedRequestPresent !== true ||
    tasks[0].sourceSnapshotIdentityMatched !== true ||
    tasks[0].manualReadOnlyActivationRequired !== true ||
    tasks[0].runId !== observation.runId ||
    tasks[0].jobId !== observation.jobId
  )
    throw new Error("BUILD219_OWNER_APPROVED_SOURCE_RECHECK_NOT_PROVEN");
  return tasks[0];
}
function pinnedSignature(
  receipt,
  requestSchema,
  receiptSchema,
  pins,
  pinSchema,
  role,
  now,
  used,
) {
  if (
    receipt?.schema !== receiptSchema ||
    receipt.algorithm !== "Ed25519" ||
    receipt.request?.schema !== requestSchema ||
    receipt.request.repository !== "RosevearCreations/iCamp" ||
    !KEY.test(receipt.request.keyId ?? "") ||
    !NONCE.test(receipt.request.nonce ?? "") ||
    !HASH.test(receipt.signerFingerprint ?? "") ||
    !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64 ?? "") ||
    pins?.schema !== pinSchema ||
    !Array.isArray(pins.signers)
  )
    throw new Error("BUILD219_INVALID_SIGNED_RECEIPT_OR_PINS");
  ensureWindow(receipt.request, now);
  if (used.has(receipt.request.nonce))
    throw new Error("BUILD219_REPLAYED_SIGNER_NONCE");
  const matching = pins.signers.filter(
    (row) => row.keyId === receipt.request.keyId,
  );
  if (
    matching.length !== 1 ||
    matching[0].role !== role ||
    matching[0].enabled !== true ||
    !HASH.test(matching[0].fingerprint ?? "") ||
    publicKeyFingerprint(matching[0].publicKeyPem) !==
      matching[0].fingerprint ||
    matching[0].fingerprint !== receipt.signerFingerprint
  )
    throw new Error("BUILD219_UNENROLLED_OR_INVALID_SIGNER_PIN");
  const bytes = Buffer.from(receipt.signatureBase64, "base64");
  if (
    bytes.length !== 64 ||
    !verifySignature(
      null,
      Buffer.from(
        canonicalJson({ schema: receiptSchema, request: receipt.request }),
      ),
      createPublicKey(matching[0].publicKeyPem),
      bytes,
    )
  )
    throw new Error("BUILD219_SIGNATURE_VERIFICATION_FAILED");
  used.add(receipt.request.nonce);
  return matching[0];
}
function signed(request, schema, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("BUILD219_ED25519_PRIVATE_KEY_REQUIRED");
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

export function prepareRunnerAttestation(
  schedule,
  observation,
  { keyId, now = Date.now(), validHours = 12 } = {},
) {
  matchObservation(schedule, observation, now);
  if (
    !KEY.test(keyId ?? "") ||
    !Number.isSafeInteger(validHours) ||
    validHours < 1 ||
    validHours > 48
  )
    throw new Error("BUILD219_INVALID_RUNNER_SCOPE");
  return {
    schema: RUNNER_REQUEST,
    repository: "RosevearCreations/iCamp",
    purpose: "RUNNER_SIGNATURE_ON_LOCAL_READONLY_RECHECK_NOT_PROVIDER_PROOF",
    keyId,
    nonce: randomUUID(),
    taskKey: observation.taskKey,
    artifactId: observation.artifactId,
    observationDigest: digest(canonicalJson(observation)),
    scheduleDigest: digest(canonicalJson(schedule)),
    reportedSourceState: observation.state,
    observedAt: observation.observedAt,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validHours * HOUR).toISOString(),
    originalArchiveBytesVerified: false,
    externalRunnerIdentityIndependentlyEstablishedByScript: false,
    ownerApprovalGrantedByAttestation: false,
    commsTestAuthorized: false,
  };
}
export function signRunnerAttestation(
  schedule,
  observation,
  request,
  privateKeyPem,
  now = Date.now(),
) {
  validateRunnerRequest(schedule, observation, request, now);
  return signed(request, RUNNER_RECEIPT, privateKeyPem);
}
function validateRunnerRequest(schedule, observation, request, now) {
  matchObservation(schedule, observation, now);
  if (
    request?.schema !== RUNNER_REQUEST ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !==
      "RUNNER_SIGNATURE_ON_LOCAL_READONLY_RECHECK_NOT_PROVIDER_PROOF" ||
    request.taskKey !== observation.taskKey ||
    request.artifactId !== observation.artifactId ||
    request.observationDigest !== digest(canonicalJson(observation)) ||
    request.scheduleDigest !== digest(canonicalJson(schedule)) ||
    request.reportedSourceState !== observation.state ||
    request.observedAt !== observation.observedAt ||
    request.originalArchiveBytesVerified !== false ||
    request.externalRunnerIdentityIndependentlyEstablishedByScript !== false ||
    request.ownerApprovalGrantedByAttestation !== false ||
    request.commsTestAuthorized !== false
  )
    throw new Error("BUILD219_RUNNER_REQUEST_DRIFT_OR_SCOPE_MISMATCH");
  ensureWindow(request, now);
}
export function verifyRunnerAttestation(
  schedule,
  observation,
  receipt,
  pins,
  { now = Date.now(), consumedNonces = new Set() } = {},
) {
  validateRunnerRequest(schedule, observation, receipt?.request, now);
  pinnedSignature(
    receipt,
    RUNNER_REQUEST,
    RUNNER_RECEIPT,
    pins,
    RUNNER_PINS,
    "ICAMP_INDEPENDENT_READONLY_RUNNER",
    now,
    consumedNonces,
  );
  return {
    schema: "icamp.build219.verified-readonly-runner-attestation.v1",
    state: "PINNED_RUNNER_SIGNED_LOCAL_OBSERVATION_PROVIDER_AND_BYTES_UNPROVEN",
    artifactId: observation.artifactId,
    taskKey: observation.taskKey,
    reportedState: observation.state,
    signatureAndPinVerified: true,
    independentRealWorldRunnerIdentityProven: false,
    originalArchiveBytesVerified: false,
    retentionRenewed: false,
    commsTestAuthorized: false,
  };
}

const exportKeys = [
  "schema",
  "repository",
  "scope",
  "createdAt",
  "dashboard",
  "recheckSchedule",
  "sourceRechecks",
  "sourceObservationProvenance",
  "ownerExceptionAcknowledgements",
  "privateEvidenceIncluded",
  "originalDigestsOrStorageLocationsIncluded",
  "campgroundTenantDataIncluded",
  "externallyDurableArchiveVerified",
  "automaticSlaWaiverOrRenewal",
  "productionApprovalGranted",
  "commsTestAuthorized",
  "exportDigest",
];
const safeState = (value) =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]{2,119}$/.test(value);
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
function validateRedactedExport(report, now) {
  if (
    report?.schema !== EXPORT ||
    report.repository !== "RosevearCreations/iCamp" ||
    report.scope !==
      "PLATFORM_RELEASE_CUSTODY_ONLY_NO_CAMPGROUND_TENANT_DATA" ||
    !exactKeys(report, exportKeys) ||
    !Array.isArray(report.sourceRechecks) ||
    !Array.isArray(report.ownerExceptionAcknowledgements) ||
    !exactKeys(report.dashboard, [
      "state",
      "counts",
      "anchorState",
      "ownerDecisionState",
      "sourceState",
    ]) ||
    ![
      report.dashboard.state,
      report.dashboard.anchorState,
      report.dashboard.ownerDecisionState,
      report.dashboard.sourceState,
    ].every(safeState) ||
    !exactKeys(report.recheckSchedule, [
      "state",
      "dueCount",
      "ownerAuthorizedCount",
      "unattendedNetworkExecution",
    ]) ||
    !safeState(report.recheckSchedule.state) ||
    !Number.isSafeInteger(report.recheckSchedule.dueCount) ||
    report.recheckSchedule.dueCount < 0 ||
    !Number.isSafeInteger(report.recheckSchedule.ownerAuthorizedCount) ||
    report.recheckSchedule.ownerAuthorizedCount < 0 ||
    report.recheckSchedule.unattendedNetworkExecution !== false ||
    !exactKeys(report.dashboard.counts, [
      "overdue",
      "due7Days",
      "due14Days",
      "later",
      "unknown",
      "sourceConflicts",
      "ownerChoiceConflicts",
      "distinctReviewerKeys",
      "signedOwnerChoices",
    ]) ||
    !Object.values(report.dashboard.counts).every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    !report.sourceRechecks.every(
      (row) =>
        exactKeys(row, [
          "artifactId",
          "reportedObservationStateUntrustedWithoutOriginalReadback",
          "observedAt",
          "archiveBytesVerified",
        ]) &&
        Number.isSafeInteger(row.artifactId) &&
        row.artifactId > 0 &&
        observedStates.has(
          row.reportedObservationStateUntrustedWithoutOriginalReadback,
        ) &&
        row.archiveBytesVerified === false &&
        at(row.observedAt) <= now + 60_000,
    ) ||
    !report.ownerExceptionAcknowledgements.every(
      (row) =>
        exactKeys(row, ["targetSequence", "exceptionCode", "state"]) &&
        Number.isSafeInteger(row.targetSequence) &&
        row.targetSequence > 0 &&
        safeState(row.exceptionCode) &&
        safeState(row.state),
    ) ||
    report.sourceObservationProvenance !==
      "REDACTED_LOCAL_RECEIPTS_NOT_INDEPENDENT_PROVIDER_ATTESTATION" ||
    report.privateEvidenceIncluded !== false ||
    report.originalDigestsOrStorageLocationsIncluded !== false ||
    report.campgroundTenantDataIncluded !== false ||
    report.externallyDurableArchiveVerified !== false ||
    report.automaticSlaWaiverOrRenewal !== false ||
    report.productionApprovalGranted !== false ||
    report.commsTestAuthorized !== false ||
    at(report.createdAt) > now + 60_000 ||
    JSON.stringify(report).length > 2_000_000
  )
    throw new Error("BUILD219_UNSAFE_PORTABLE_REPORT");
  const { exportDigest, ...payload } = report;
  if (
    !HASH.test(exportDigest ?? "") ||
    exportDigest !== digest(canonicalJson(payload))
  )
    throw new Error("BUILD219_PORTABLE_REPORT_HASH_MISMATCH");
  return exportDigest;
}
export function preparePortabilityManifest(
  report,
  { keyId, now = Date.now(), validHours = 24 } = {},
) {
  const exportDigest = validateRedactedExport(report, now);
  if (
    !KEY.test(keyId ?? "") ||
    !Number.isSafeInteger(validHours) ||
    validHours < 1 ||
    validHours > 48
  )
    throw new Error("BUILD219_INVALID_MANIFEST_SCOPE");
  return {
    schema: MANIFEST_REQUEST,
    repository: "RosevearCreations/iCamp",
    purpose: "INDEPENDENT_SIGNATURE_ON_REDACTED_MANIFEST_NOT_ARCHIVE_CUSTODY",
    keyId,
    nonce: randomUUID(),
    portableSchema: report.schema,
    exportDigest,
    exportedAt: report.createdAt,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validHours * HOUR).toISOString(),
    externalCustodyVerified: false,
    actualSourceArchiveBytesIncluded: false,
    tenantDataIncluded: false,
    ownerReleaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}
function validateManifestRequest(report, request, now) {
  const hash = validateRedactedExport(report, now);
  if (
    request?.schema !== MANIFEST_REQUEST ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !==
      "INDEPENDENT_SIGNATURE_ON_REDACTED_MANIFEST_NOT_ARCHIVE_CUSTODY" ||
    request.portableSchema !== report.schema ||
    request.exportDigest !== hash ||
    request.exportedAt !== report.createdAt ||
    request.externalCustodyVerified !== false ||
    request.actualSourceArchiveBytesIncluded !== false ||
    request.tenantDataIncluded !== false ||
    request.ownerReleaseApprovalGranted !== false ||
    request.commsTestAuthorized !== false
  )
    throw new Error("BUILD219_PORTABILITY_MANIFEST_DRIFT_OR_SCOPE_MISMATCH");
  ensureWindow(request, now);
}
export function signPortabilityManifest(
  report,
  request,
  privateKeyPem,
  now = Date.now(),
) {
  validateManifestRequest(report, request, now);
  return signed(request, MANIFEST_RECEIPT, privateKeyPem);
}
export function verifyPortabilityManifest(
  report,
  receipt,
  pins,
  {
    now = Date.now(),
    ownerPins = null,
    runnerPins = null,
    consumedNonces = new Set(),
  } = {},
) {
  validateManifestRequest(report, receipt?.request, now);
  const pin = pinnedSignature(
    receipt,
    MANIFEST_REQUEST,
    MANIFEST_RECEIPT,
    pins,
    MANIFEST_PINS,
    "ICAMP_INDEPENDENT_PORTABILITY_CUSTODIAN",
    now,
    consumedNonces,
  );
  for (const other of [ownerPins, runnerPins]) {
    if (
      other?.signers?.some(
        (row) => row.enabled && row.fingerprint === pin.fingerprint,
      )
    )
      throw new Error(
        "BUILD219_MANIFEST_SIGNER_NOT_SEPARATE_FROM_OWNER_OR_RUNNER",
      );
  }
  return {
    schema: "icamp.build219.verified-redacted-portability-manifest.v1",
    state:
      "INDEPENDENT_PINNED_MANIFEST_SIGNATURE_VALID_ARCHIVE_CUSTODY_UNPROVEN",
    signedExportDigest: report.exportDigest,
    signatureAndPinVerified: true,
    signerSeparateFromSuppliedOwnerAndRunnerPins: !!ownerPins && !!runnerPins,
    archiveStorageOrSourceBytesVerified: false,
    sourceRetentionRenewed: false,
    commsTestAuthorized: false,
  };
}

export function reviewRetentionExceptionClosure({
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
  now = Date.now(),
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
  const sourceMatch =
    observation.state === "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED";
  const matchingRecord = report.sourceRechecks.some(
    (row) =>
      row.artifactId === observation.artifactId &&
      row.observedAt === observation.observedAt &&
      row.reportedObservationStateUntrustedWithoutOriginalReadback ===
        observation.state,
  );
  const acknowledgedArtifact =
    ledger[acknowledgement.targetSequence - 1]?.sourceIdentity?.artifactId;
  if (!matchingRecord || acknowledgedArtifact !== observation.artifactId)
    throw new Error("BUILD219_CROSS_ARTIFACT_CLOSURE_REVIEW_REFUSED");
  return {
    schema: "icamp.build219.retention-exception-closure-review.v1",
    state: sourceMatch
      ? "SIGNED_METADATA_RECHECK_REVIEWED_ORIGINAL_BYTES_AND_OWNER_CLOSURE_HOLD"
      : "SOURCE_CONFLICT_OR_UNAVAILABLE_OWNER_CLOSURE_HOLD",
    exceptionCode: acknowledgement.exceptionCode,
    targetSequence: acknowledgement.targetSequence,
    artifactId: observation.artifactId,
    verifiedRunnerSignature: runner.signatureAndPinVerified,
    verifiedIndependentManifestSignature: manifest.signatureAndPinVerified,
    ownerExceptionAcknowledgedNotWaived:
      acknowledgement.acknowledgedByPinnedKey,
    independentOriginalArchiveByteReadbackVerified: false,
    custodianStorageIndependenceVerified: false,
    ownerSignedExceptionClosureGranted: false,
    retentionExceptionClosed: false,
    originalArtifactRetentionRenewed: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function analyzeBuild219Ci(previous) {
  return {
    schema:
      "icamp.build219.offline-runner-attestation-and-retention-review-ci-handoff.v1",
    state: "INDEPENDENT_OPERATOR_AND_ARCHIVE_EVIDENCE_NOT_IMPORTED_HOLD",
    previousHandoff: previous?.state ?? null,
    externalSourceReadsInCi: false,
    privateSignerKeysOrOwnerReceiptsInCi: false,
    unsignedManifestTreatedAsTrusted: false,
    automaticExceptionClosure: false,
    newBackgroundJobs: false,
    protectedChecksChanged: false,
    commsTestAuthorized: false,
  };
}

async function external(file) {
  if (
    !isAbsolute(file) ||
    resolve(file) === ROOT ||
    resolve(file).startsWith(`${ROOT}${sep}`) ||
    [ROOT].includes(await realpath(dirname(resolve(file)))) ||
    (await realpath(dirname(resolve(file)))).startsWith(`${ROOT}${sep}`)
  )
    throw new Error("BUILD219_PRIVATE_PATH_MUST_BE_OUTSIDE_CHECKOUT");
  try {
    if (!(await lstat(file)).isFile())
      throw new Error("BUILD219_SYMLINK_OR_DIRECTORY_REFUSED");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function input(file) {
  await external(file);
  const data = await readFile(file, "utf8");
  if (data.length > 2_000_000)
    throw new Error("BUILD219_PRIVATE_INPUT_TOO_LARGE");
  return JSON.parse(data);
}
async function output(file, value) {
  await external(file);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}
async function main([command, ...args]) {
  if (command === "runner-prepare" && args.length === 4) {
    const [schedule, observation, keyId, out] = args;
    return output(
      out,
      prepareRunnerAttestation(
        await input(schedule),
        await input(observation),
        { keyId },
      ),
    );
  }
  if (
    command === "runner-sign" &&
    args.length === 6 &&
    args[5] === "--confirm-runner-signature"
  ) {
    const [schedule, observation, request, key, out] = args;
    await external(key);
    return output(
      out,
      signRunnerAttestation(
        await input(schedule),
        await input(observation),
        await input(request),
        await readFile(key, "utf8"),
      ),
    );
  }
  if (command === "runner-verify" && args.length === 4) {
    const [schedule, observation, receipt, pins] = args;
    return console.log(
      JSON.stringify(
        verifyRunnerAttestation(
          await input(schedule),
          await input(observation),
          await input(receipt),
          await input(pins),
        ),
      ),
    );
  }
  if (command === "manifest-prepare" && args.length === 3) {
    const [report, keyId, out] = args;
    return output(
      out,
      preparePortabilityManifest(await input(report), { keyId }),
    );
  }
  if (
    command === "manifest-sign" &&
    args.length === 5 &&
    args[4] === "--confirm-independent-custodian-signature"
  ) {
    const [report, request, key, out] = args;
    await external(key);
    return output(
      out,
      signPortabilityManifest(
        await input(report),
        await input(request),
        await readFile(key, "utf8"),
      ),
    );
  }
  if (command === "manifest-verify" && args.length === 5) {
    const [report, receipt, pins, ownerPins, runnerPins] = args;
    return console.log(
      JSON.stringify(
        verifyPortabilityManifest(
          await input(report),
          await input(receipt),
          await input(pins),
          {
            ownerPins: await input(ownerPins),
            runnerPins: await input(runnerPins),
          },
        ),
      ),
    );
  }
  if (
    command === "closure-review" &&
    args.length === 11 &&
    args[10] === "--confirm-review-only"
  ) {
    const [
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
    ] = args;
    return console.log(
      JSON.stringify(
        reviewRetentionExceptionClosure({
          ledger: await readExternalRegistrationLedger(ledger),
          exceptionReceipt: await input(exceptionReceipt),
          ownerPins: await input(ownerPins),
          schedule: await input(schedule),
          observation: await input(observation),
          runnerReceipt: await input(runnerReceipt),
          runnerPins: await input(runnerPins),
          report: await input(report),
          manifestReceipt: await input(manifestReceipt),
          manifestPins: await input(manifestPins),
        }),
      ),
    );
  }
  throw new Error(
    "BUILD219_USAGE: runner-prepare|runner-sign|runner-verify|manifest-prepare|manifest-sign|manifest-verify|closure-review; see docs/BUILD_219_RUNNER_ATTESTATION_MANIFEST_CLOSURE.md",
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
        : "BUILD219_PRIVATE_WORKBENCH_FAILED",
    );
    process.exitCode = 1;
  });
}
