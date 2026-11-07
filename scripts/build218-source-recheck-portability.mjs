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
  readExternalRegistrationLedger,
  verifyRegistrationLedger,
} from "./build214-owner-custody-register.mjs";
import { normalizeArtifactResponse } from "./build211-runner-artifact-sla.mjs";
import {
  reconcileOwnerRenewalOutcomes,
  summarizeRetentionDashboard,
} from "./build217-custody-retention-dashboard.mjs";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DAY = 86_400_000;
const HOUR = 3_600_000;
const HASH = /^sha256:[0-9a-f]{64}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const NONCE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACK = "icamp.build218.owner-exception-acknowledgement.v1";
const ACK_RECEIPT = "icamp.build218.signed-owner-exception-receipt.v1";
const RECHECK = "icamp.build218.original-source-recheck.v1";
const EXCEPTIONS = Object.freeze([
  "ORIGINAL_ARTIFACT_EXPIRED",
  "SOURCE_METADATA_UNAVAILABLE",
  "SOURCE_DIGEST_OR_IDENTITY_CONFLICT",
  "INDEPENDENT_CUSTODY_NOT_PROVEN",
  "SLA_RECHECK_OVERDUE",
]);
const digest = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const instant = (value) => {
  const at = Date.parse(value ?? "");
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value)
    throw new Error("INVALID_BUILD218_TIMESTAMP");
  return at;
};

export function createSourceRecheckSchedule({
  ledger,
  ciEvidence,
  ownerReceipts,
  ownerPins,
  priorObservations = [],
  now = Date.now(),
  warningDays = 14,
  repeatHours = 24,
}) {
  verifyRegistrationLedger(ledger, { now });
  if (
    !Number.isSafeInteger(warningDays) ||
    warningDays < 1 ||
    warningDays > 30 ||
    !Number.isSafeInteger(repeatHours) ||
    repeatHours < 6 ||
    repeatHours > 168 ||
    !Array.isArray(priorObservations)
  )
    throw new Error("INVALID_SOURCE_RECHECK_SCHEDULE_POLICY");
  const owner = reconcileOwnerRenewalOutcomes({
    ledger,
    receipts: ownerReceipts,
    pins: ownerPins,
    now,
  });
  const authorizedSequences = new Set(
    owner.outcomes
      .filter(
        (row) =>
          row.activeChoice === "REQUEST_EVIDENCE_RENEWAL" && !row.conflict,
      )
      .map((row) => row.targetSequence),
  );
  const sourceRows = ciEvidence?.build211?.artifactReview;
  if (
    sourceRows?.schema !== "icamp.build211.artifact-expiry-renewal.v1" ||
    !Array.isArray(sourceRows.sources)
  )
    return {
      schema: "icamp.build218.owner-scoped-source-recheck-schedule.v1",
      state: "ORIGINAL_GITHUB_SOURCE_SNAPSHOT_UNAVAILABLE_HOLD",
      tasks: [],
      dueCount: 0,
      ownerAuthorizedCount: 0,
      automaticNetworkCalls: false,
      externalSchedulerInstalled: false,
      sourceProofGranted: false,
      commsTestAuthorized: false,
    };
  const sourceById = new Map();
  for (const row of sourceRows.sources) {
    if (
      !Number.isSafeInteger(row?.artifactId) ||
      sourceById.has(row.artifactId)
    )
      throw new Error("DUPLICATE_OR_INVALID_ORIGINAL_ARTIFACT_SOURCE");
    sourceById.set(row.artifactId, row);
  }
  const priorByKey = new Map();
  for (const observation of priorObservations) {
    if (
      observation?.schema !== RECHECK ||
      typeof observation.taskKey !== "string" ||
      !Number.isSafeInteger(observation.artifactId)
    )
      throw new Error("INVALID_PRIOR_SOURCE_RECHECK_RECORD");
    const observedAt = instant(observation.observedAt);
    if (observedAt > now + 60_000)
      throw new Error("FUTURE_DATED_SOURCE_RECHECK_RECORD");
    const latest = priorByKey.get(observation.taskKey);
    if (!latest || observedAt > instant(latest.observedAt))
      priorByKey.set(observation.taskKey, observation);
  }
  const grouped = new Map();
  for (const entry of ledger.filter(
    (item) => item.kind === "VERIFIED_ARCHIVE_COPY",
  )) {
    const id = entry.sourceIdentity.artifactId;
    if (!Number.isSafeInteger(id) || id < 1)
      throw new Error("INVALID_CUSTODIAN_ARTIFACT_IDENTIFIER");
    const rows = grouped.get(id) ?? [];
    rows.push(entry);
    grouped.set(id, rows);
  }
  const tasks = [];
  for (const [artifactId, entries] of [...grouped].sort(([a], [b]) => a - b)) {
    const approved = entries.find((entry) =>
      authorizedSequences.has(entry.sequence),
    );
    const entry = approved ?? entries[0];
    const source = sourceById.get(entry.sourceIdentity.artifactId);
    const sourceMatch =
      !!source &&
      entries.every(
        (item) =>
          source.runId === item.sourceIdentity.runId &&
          source.jobId === item.sourceIdentity.jobId &&
          source.pinnedOriginalDigest === item.sourceDigest &&
          item.sourceIdentity.commit === entry.sourceIdentity.commit,
      );
    const expiries = entries.map((item) => instant(item.expiresAt));
    if (source?.expiresAt) expiries.push(instant(source.expiresAt));
    const earliest = Math.min(...expiries);
    const dueAt = earliest - warningDays * DAY;
    const key = digest(
      canonicalJson({
        repository: "RosevearCreations/iCamp",
        artifactId,
        sourceDigest: entry.sourceDigest,
        runId: entry.sourceIdentity.runId,
        sourceCommit: entry.sourceIdentity.commit,
        dueAt: new Date(dueAt).toISOString(),
      }),
    );
    const last = priorByKey.get(key);
    if (last && last.artifactId !== artifactId)
      throw new Error("SOURCE_RECHECK_IDEMPOTENCY_KEY_COLLISION");
    const nextEligible = last
      ? instant(last.observedAt) + repeatHours * HOUR
      : dueAt;
    const authorized = !!approved;
    const state = !sourceMatch
      ? "SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD"
      : !authorized
        ? "SIGNED_OWNER_REQUEST_REQUIRED_HOLD"
        : nextEligible > now
          ? "WAITING_FOR_RECHECK_DUE_WINDOW"
          : "OWNER_REQUESTED_READONLY_RECHECK_DUE";
    tasks.push({
      taskKey: key,
      artifactId,
      runId: entry.sourceIdentity.runId,
      jobId: entry.sourceIdentity.jobId,
      sourceCommit: entry.sourceIdentity.commit,
      registrationSequence: entry.sequence,
      custodianRegistrationsReviewed: entries.length,
      state,
      nextEligibleAt: new Date(nextEligible).toISOString(),
      originalExpiresAt: source?.expiresAt ?? null,
      registrationExpiresAt: new Date(
        Math.min(...entries.map((item) => instant(item.expiresAt))),
      ).toISOString(),
      ownerSignedRequestPresent: authorized,
      sourceSnapshotIdentityMatched: sourceMatch,
      recurrenceHours: repeatHours,
      manualReadOnlyActivationRequired: true,
    });
  }
  return {
    schema: "icamp.build218.owner-scoped-source-recheck-schedule.v1",
    state: tasks.some(
      (task) => task.state === "OWNER_REQUESTED_READONLY_RECHECK_DUE",
    )
      ? "OWNER_REQUESTED_READONLY_RECHECK_PENDING_MANUAL_EXECUTION"
      : "NO_APPROVED_DUE_RECHECKS_HOLD_OR_WAIT",
    tasks,
    dueCount: tasks.filter(
      (task) => task.state === "OWNER_REQUESTED_READONLY_RECHECK_DUE",
    ).length,
    ownerAuthorizedCount: tasks.filter((task) => task.ownerSignedRequestPresent)
      .length,
    automaticNetworkCalls: false,
    externalSchedulerInstalled: false,
    sourceProofGranted: false,
    commsTestAuthorized: false,
  };
}

export async function performReadOnlySourceRecheck({
  ledger,
  ciEvidence,
  ownerReceipts,
  ownerPins,
  artifactId,
  priorObservations = [],
  now = Date.now(),
  fetchImpl = fetch,
  token,
  ownerConfirmed = false,
}) {
  if (
    ownerConfirmed !== true ||
    !Number.isSafeInteger(artifactId) ||
    artifactId < 1
  )
    throw new Error("EXPLICIT_OWNER_READONLY_RECHECK_REQUIRED");
  const schedule = createSourceRecheckSchedule({
    ledger,
    ciEvidence,
    ownerReceipts,
    ownerPins,
    priorObservations,
    now,
  });
  const eligible = schedule.tasks.filter(
    (task) => task.artifactId === artifactId,
  );
  if (
    eligible.length !== 1 ||
    eligible[0].state !== "OWNER_REQUESTED_READONLY_RECHECK_DUE"
  )
    throw new Error("ORIGINAL_SOURCE_RECHECK_NOT_AUTHORIZED_OR_NOT_DUE");
  const task = eligible[0];
  if (typeof token !== "string" || token.length < 10 || /\s/.test(token))
    throw new Error("GITHUB_READONLY_TOKEN_REQUIRED");
  const url = `https://api.github.com/repos/RosevearCreations/iCamp/actions/artifacts/${artifactId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let result = "SOURCE_UNAVAILABLE_REVIEW_HOLD";
  let metadataExpiresAt = null;
  let githubDigestMatched = false;
  let sourceRunMatched = false;
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });
    if (response?.ok) {
      const raw = await response.json();
      const normalized = normalizeArtifactResponse(raw, artifactId);
      metadataExpiresAt = normalized.expiresAt;
      sourceRunMatched =
        raw.workflow_run?.id === task.runId &&
        raw.workflow_run?.head_sha === task.sourceCommit;
      const entry = ledger[task.registrationSequence - 1];
      githubDigestMatched =
        !!normalized.digest && normalized.digest === entry.sourceDigest;
      result =
        !sourceRunMatched || !githubDigestMatched
          ? "GITHUB_SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD"
          : normalized.expired || instant(normalized.expiresAt) <= now
            ? "GITHUB_ORIGINAL_ARTIFACT_EXPIRED_HOLD"
            : "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED";
    }
  } catch {
    result = "GITHUB_METADATA_FETCH_OR_PARSE_FAILED_HOLD";
  } finally {
    clearTimeout(timeout);
  }
  return {
    schema: RECHECK,
    taskKey: task.taskKey,
    artifactId,
    runId: task.runId,
    jobId: task.jobId,
    observedAt: new Date(now).toISOString(),
    state: result,
    metadataExpiresAt,
    originalDigestMatchedMetadata: githubDigestMatched,
    githubRunAndCommitMatched: sourceRunMatched,
    originalArtifactBytesDownloaded: false,
    originalJobAssociationIndependentlyVerified: false,
    durableArchiveStorageVerified: false,
    originalRetentionRenewed: false,
    ownerProductionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function prepareExceptionAcknowledgement(
  ledger,
  {
    sequence,
    exceptionCode,
    keyId,
    note = "",
    now = Date.now(),
    validDays = 3,
  } = {},
) {
  const verified = verifyRegistrationLedger(ledger, { now });
  const target = ledger[sequence - 1];
  if (
    !Number.isSafeInteger(sequence) ||
    !target ||
    !EXCEPTIONS.includes(exceptionCode) ||
    !KEY.test(keyId ?? "") ||
    typeof note !== "string" ||
    note.length > 240 ||
    !Number.isSafeInteger(validDays) ||
    validDays < 1 ||
    validDays > 7
  )
    throw new Error("INVALID_OWNER_SLA_EXCEPTION_ACK_REQUEST");
  return {
    schema: ACK,
    repository: "RosevearCreations/iCamp",
    purpose: "OWNER_EXCEPTION_ACKNOWLEDGEMENT_NOT_WAIVER_OR_RENEWAL",
    keyId,
    nonce: randomUUID(),
    exceptionCode,
    note,
    targetSequence: sequence,
    targetEntryHash: target.entryHash,
    targetExpiresAt: target.expiresAt,
    reviewedLedgerHead: verified.headHash,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validDays * DAY).toISOString(),
    sourceRenewalGranted: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

function validateExceptionRequest(ledger, request, now) {
  const verified = verifyRegistrationLedger(ledger, { now });
  const target = ledger[request?.targetSequence - 1];
  if (
    request?.schema !== ACK ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !==
      "OWNER_EXCEPTION_ACKNOWLEDGEMENT_NOT_WAIVER_OR_RENEWAL" ||
    !KEY.test(request.keyId ?? "") ||
    !NONCE.test(request.nonce ?? "") ||
    !EXCEPTIONS.includes(request.exceptionCode) ||
    typeof request.note !== "string" ||
    request.note.length > 240 ||
    !Number.isSafeInteger(request.targetSequence) ||
    !target ||
    target.entryHash !== request.targetEntryHash ||
    target.expiresAt !== request.targetExpiresAt ||
    request.reviewedLedgerHead !== verified.headHash ||
    request.sourceRenewalGranted !== false ||
    request.productionApprovalGranted !== false ||
    request.commsTestAuthorized !== false ||
    instant(request.issuedAt) > now + 60_000 ||
    instant(request.expiresAt) <= now ||
    instant(request.expiresAt) - instant(request.issuedAt) > 7 * DAY
  )
    throw new Error("OWNER_EXCEPTION_ACK_SCOPE_OR_EXPIRY_INVALID");
  return request;
}

export function signExceptionAcknowledgement(
  ledger,
  request,
  privateKeyPem,
  now = Date.now(),
) {
  validateExceptionRequest(ledger, request, now);
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("OWNER_EXCEPTION_SIGNER_MUST_BE_ED25519");
  return {
    schema: ACK_RECEIPT,
    algorithm: "Ed25519",
    request,
    signerFingerprint: publicKeyFingerprint(key),
    signatureBase64: sign(
      null,
      Buffer.from(canonicalJson({ schema: ACK_RECEIPT, request })),
      key,
    ).toString("base64"),
  };
}

export function verifyExceptionAcknowledgement(
  ledger,
  receipt,
  pins,
  { now = Date.now(), consumedNonces = new Set() } = {},
) {
  if (
    receipt?.schema !== ACK_RECEIPT ||
    receipt.algorithm !== "Ed25519" ||
    !HASH.test(receipt.signerFingerprint ?? "") ||
    typeof receipt.signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64) ||
    pins?.schema !== "icamp.build216.owner-renewal-pins.v1" ||
    !Array.isArray(pins.signers)
  )
    throw new Error("INVALID_OWNER_EXCEPTION_ACK_RECEIPT");
  validateExceptionRequest(ledger, receipt.request, now);
  if (consumedNonces.has(receipt.request.nonce))
    throw new Error("DUPLICATE_OWNER_EXCEPTION_ACK_NONCE");
  const matches = pins.signers.filter(
    (pin) => pin.keyId === receipt.request.keyId,
  );
  if (
    matches.length !== 1 ||
    matches[0].enabled !== true ||
    matches[0].role !== "ICAMP_CUSTODY_RENEWAL_OWNER" ||
    !HASH.test(matches[0].fingerprint ?? "") ||
    publicKeyFingerprint(matches[0].publicKeyPem) !== matches[0].fingerprint ||
    matches[0].fingerprint !== receipt.signerFingerprint
  )
    throw new Error("OWNER_EXCEPTION_ACK_PIN_NOT_INDEPENDENTLY_VERIFIED");
  const signature = Buffer.from(receipt.signatureBase64, "base64");
  if (
    signature.length !== 64 ||
    !verifySignature(
      null,
      Buffer.from(
        canonicalJson({ schema: ACK_RECEIPT, request: receipt.request }),
      ),
      createPublicKey(matches[0].publicKeyPem),
      signature,
    )
  )
    throw new Error("INVALID_OWNER_EXCEPTION_ACK_SIGNATURE");
  consumedNonces.add(receipt.request.nonce);
  return {
    schema: "icamp.build218.verified-owner-exception-acknowledgement.v1",
    state: "SIGNED_EXCEPTION_REVIEW_ONLY_NOT_POLICY_WAIVER",
    targetSequence: receipt.request.targetSequence,
    exceptionCode: receipt.request.exceptionCode,
    acknowledgedByPinnedKey: true,
    realWorldOwnerIdentityProvenByScript: false,
    originalEvidenceRenewed: false,
    releaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function buildPortableEvidenceExport({
  ledger,
  dashboard,
  schedule,
  sourceRechecks,
  exceptionReceipts,
  ownerPins,
  now = Date.now(),
}) {
  verifyRegistrationLedger(ledger, { now });
  if (
    dashboard?.schema !==
      "icamp.build217.redacted-evidence-retention-sla-dashboard.v1" ||
    dashboard.includesPrivateSignerKeys !== false ||
    dashboard.includesPrivateSignedReceipts !== false ||
    dashboard.includesSourceDigestsOrArchiveLocations !== false ||
    schedule?.schema !==
      "icamp.build218.owner-scoped-source-recheck-schedule.v1" ||
    !Array.isArray(schedule.tasks) ||
    !Array.isArray(sourceRechecks) ||
    !Array.isArray(exceptionReceipts)
  )
    throw new Error("UNSAFE_OR_INCOMPLETE_EVIDENCE_PORTABILITY_INPUT");
  const safeStatus = (value) =>
    typeof value === "string" && /^[A-Z][A-Z0-9_]{2,119}$/.test(value);
  const metricKeys = [
    "overdue",
    "due7Days",
    "due14Days",
    "later",
    "unknown",
    "sourceConflicts",
    "ownerChoiceConflicts",
    "distinctReviewerKeys",
    "signedOwnerChoices",
  ];
  if (
    ![
      dashboard.state,
      dashboard.anchorState,
      dashboard.ownerDecisionState,
      dashboard.sourceState,
      schedule.state,
    ].every(safeStatus) ||
    !Number.isSafeInteger(schedule.dueCount) ||
    schedule.dueCount < 0 ||
    !Number.isSafeInteger(schedule.ownerAuthorizedCount) ||
    schedule.ownerAuthorizedCount < 0
  )
    throw new Error("UNSAFE_PORTABILITY_STATUS_OR_SCHEDULE_METRICS");
  const safeCounts = Object.fromEntries(
    metricKeys.map((key) => {
      const value = dashboard.counts?.[key];
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("UNSAFE_PORTABILITY_DASHBOARD_METRIC");
      return [key, value];
    }),
  );
  const allowedArtifacts = new Set(
    ledger
      .filter((e) => e.kind === "VERIFIED_ARCHIVE_COPY")
      .map((e) => e.sourceIdentity.artifactId),
  );
  const seenRechecks = new Set();
  const rechecks = sourceRechecks.map((row) => {
    if (
      row?.schema !== RECHECK ||
      !allowedArtifacts.has(row.artifactId) ||
      !schedule.tasks.some(
        (task) =>
          task.taskKey === row.taskKey && task.artifactId === row.artifactId,
      ) ||
      ![
        "SOURCE_UNAVAILABLE_REVIEW_HOLD",
        "GITHUB_METADATA_FETCH_OR_PARSE_FAILED_HOLD",
        "GITHUB_SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD",
        "GITHUB_ORIGINAL_ARTIFACT_EXPIRED_HOLD",
        "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED",
      ].includes(row.state) ||
      row.originalArtifactBytesDownloaded !== false ||
      row.originalRetentionRenewed !== false ||
      row.commsTestAuthorized !== false ||
      seenRechecks.has(`${row.taskKey}:${row.observedAt}`) ||
      instant(row.observedAt) > now + 60_000
    )
      throw new Error("UNVERIFIED_OR_CROSS_SOURCE_PORTABILITY_RECHECK");
    seenRechecks.add(`${row.taskKey}:${row.observedAt}`);
    return {
      artifactId: row.artifactId,
      reportedObservationStateUntrustedWithoutOriginalReadback: row.state,
      observedAt: row.observedAt,
      archiveBytesVerified: false,
    };
  });
  const consumed = new Set();
  const acknowledgements = exceptionReceipts.map((receipt) => {
    const historicalNow = Math.min(
      now,
      instant(receipt.request.expiresAt) - 1000,
    );
    const verified = verifyExceptionAcknowledgement(
      ledger,
      receipt,
      ownerPins,
      {
        now: historicalNow,
        consumedNonces: consumed,
      },
    );
    return {
      targetSequence: verified.targetSequence,
      exceptionCode: verified.exceptionCode,
      state:
        instant(receipt.request.expiresAt) <= now
          ? "HISTORIC_SIGNED_ACK_EXPIRED_REVIEW"
          : verified.state,
    };
  });
  const payload = {
    schema: "icamp.build218.cross-custodian-redacted-portability.v1",
    repository: "RosevearCreations/iCamp",
    scope: "PLATFORM_RELEASE_CUSTODY_ONLY_NO_CAMPGROUND_TENANT_DATA",
    createdAt: new Date(now).toISOString(),
    dashboard: {
      state: dashboard.state,
      counts: safeCounts,
      anchorState: dashboard.anchorState,
      ownerDecisionState: dashboard.ownerDecisionState,
      sourceState: dashboard.sourceState,
    },
    recheckSchedule: {
      state: schedule.state,
      dueCount: schedule.dueCount,
      ownerAuthorizedCount: schedule.ownerAuthorizedCount,
      unattendedNetworkExecution: false,
    },
    sourceRechecks: rechecks,
    sourceObservationProvenance:
      "REDACTED_LOCAL_RECEIPTS_NOT_INDEPENDENT_PROVIDER_ATTESTATION",
    ownerExceptionAcknowledgements: acknowledgements,
    privateEvidenceIncluded: false,
    originalDigestsOrStorageLocationsIncluded: false,
    campgroundTenantDataIncluded: false,
    externallyDurableArchiveVerified: false,
    automaticSlaWaiverOrRenewal: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
  return { ...payload, exportDigest: digest(canonicalJson(payload)) };
}

export function analyzeBuild218Ci(previous) {
  return {
    schema:
      "icamp.build218.readonly-source-recheck-and-portability-ci-handoff.v1",
    state: "EXTERNAL_OWNER_APPROVAL_AND_GITHUB_ARTIFACT_READBACK_REQUIRED",
    previousHandoff: previous?.state ?? null,
    remoteArtifactReadsInCi: false,
    automaticSchedulingInstalled: false,
    privateOwnerKeysImported: false,
    sourceRetentionRenewed: false,
    protectedChecksChanged: false,
    commsTestAuthorized: false,
  };
}

async function external(path) {
  if (
    !isAbsolute(path) ||
    resolve(path) === ROOT ||
    resolve(path).startsWith(`${ROOT}${sep}`)
  )
    throw new Error("PRIVATE_BUILD218_PATH_MUST_BE_EXTERNAL");
  const parent = await realpath(dirname(resolve(path)));
  if (parent === ROOT || parent.startsWith(`${ROOT}${sep}`))
    throw new Error("PRIVATE_BUILD218_PATH_MUST_BE_EXTERNAL");
  try {
    if (!(await lstat(path)).isFile())
      throw new Error("PRIVATE_BUILD218_SYMLINK_REFUSED");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function json(path) {
  await external(path);
  const raw = await readFile(path, "utf8");
  if (raw.length > 2_000_000)
    throw new Error("PRIVATE_BUILD218_INPUT_TOO_LARGE");
  return JSON.parse(raw);
}
async function rotations(path) {
  await external(path);
  const raw = await readFile(path, "utf8");
  if (raw.length > 2_000_000 || (raw && !raw.endsWith("\n")))
    throw new Error("INCOMPLETE_PRIVATE_ROTATION_LEDGER");
  return raw.trim() ? raw.trimEnd().split("\n").map(JSON.parse) : [];
}
async function output(path, value) {
  await external(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}

async function main(args) {
  const [command, ...v] = args;
  if (
    command === "schedule" &&
    v.length === 6 &&
    v[5] === "--confirm-owner-review"
  ) {
    const [ledgerPath, evidencePath, receiptsPath, pinsPath, outPath] = v;
    const [ledger, ciEvidence, ownerReceipts, ownerPins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(evidencePath),
      json(receiptsPath),
      json(pinsPath),
    ]);
    const schedule = createSourceRecheckSchedule({
      ledger,
      ciEvidence,
      ownerReceipts,
      ownerPins,
    });
    await output(outPath, schedule);
    console.log(
      JSON.stringify({
        state: schedule.state,
        dueCount: schedule.dueCount,
        automaticNetworkCalls: false,
      }),
    );
    return;
  }
  if (
    command === "recheck" &&
    v.length === 7 &&
    v[6] === "--confirm-owner-authorized-readonly"
  ) {
    const [ledgerPath, evidencePath, receiptsPath, pinsPath, id, outPath] = v;
    const [ledger, ciEvidence, ownerReceipts, ownerPins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(evidencePath),
      json(receiptsPath),
      json(pinsPath),
    ]);
    const receipt = await performReadOnlySourceRecheck({
      ledger,
      ciEvidence,
      ownerReceipts,
      ownerPins,
      artifactId: Number(id),
      token: process.env.GITHUB_TOKEN,
      ownerConfirmed: true,
    });
    await output(outPath, receipt);
    console.log(
      JSON.stringify({
        state: receipt.state,
        artifactId: receipt.artifactId,
        originalArtifactBytesDownloaded: false,
      }),
    );
    return;
  }
  if (command === "ack-prepare" && v.length === 5) {
    const [ledgerPath, sequence, code, keyId, outPath] = v;
    const ledger = await readExternalRegistrationLedger(ledgerPath);
    await output(
      outPath,
      prepareExceptionAcknowledgement(ledger, {
        sequence: Number(sequence),
        exceptionCode: code,
        keyId,
      }),
    );
    console.log(
      "Unsigned scoped owner exception acknowledgement prepared; no SLA waiver created.",
    );
    return;
  }
  if (
    command === "ack-sign" &&
    v.length === 5 &&
    v[4] === "--confirm-owner-signature"
  ) {
    const [ledgerPath, requestPath, keyPath, outPath] = v;
    const [ledger, request] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(requestPath),
    ]);
    await external(keyPath);
    const key = await readFile(keyPath, "utf8");
    await output(outPath, signExceptionAcknowledgement(ledger, request, key));
    console.log(
      "Owner exception review signed locally; no retention, release or Comms gate waived.",
    );
    return;
  }
  if (command === "ack-verify" && v.length === 3) {
    const [ledgerPath, receiptPath, pinsPath] = v;
    const [ledger, receipt, pins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(receiptPath),
      json(pinsPath),
    ]);
    console.log(
      JSON.stringify(verifyExceptionAcknowledgement(ledger, receipt, pins)),
    );
    return;
  }
  if (
    command === "export" &&
    v.length === 11 &&
    v[10] === "--confirm-redacted-export"
  ) {
    const [
      ledgerPath,
      evidencePath,
      rotationPath,
      anchorPinsPath,
      tail,
      receiptsPath,
      ownerPinsPath,
      rechecksPath,
      acknowledgementsPath,
      outPath,
    ] = v;
    const [
      ledger,
      ciEvidence,
      rotationRecords,
      anchorPins,
      ownerReceipts,
      ownerPins,
      sourceRechecks,
      exceptionReceipts,
    ] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(evidencePath),
      rotations(rotationPath),
      json(anchorPinsPath),
      json(receiptsPath),
      json(ownerPinsPath),
      json(rechecksPath),
      json(acknowledgementsPath),
    ]);
    const dashboard = summarizeRetentionDashboard({
      ledger,
      rotations: rotationRecords,
      anchorPins,
      expectedTail: tail,
      ownerReceipts,
      ownerPins,
      ciEvidence,
    });
    const schedule = createSourceRecheckSchedule({
      ledger,
      ciEvidence,
      ownerReceipts,
      ownerPins,
      priorObservations: sourceRechecks,
    });
    const data = buildPortableEvidenceExport({
      ledger,
      dashboard,
      schedule,
      sourceRechecks,
      exceptionReceipts,
      ownerPins,
    });
    await output(outPath, data);
    console.log(
      JSON.stringify({
        schema: data.schema,
        exportDigest: data.exportDigest,
        privateEvidenceIncluded: false,
        commsTestAuthorized: false,
      }),
    );
    return;
  }
  throw new Error(
    "USAGE: schedule <ledger> <build205-evidence> <renewal-receipts.json> <owner-pins.json> <output.json> --confirm-owner-review | recheck <ledger> <build205-evidence> <renewal-receipts.json> <owner-pins.json> <artifactId> <output.json> --confirm-owner-authorized-readonly | ack-prepare <ledger> <sequence> <exception-code> <ownerKeyId> <output.json> | ack-sign <ledger> <request.json> <owner-private.pem> <output.json> --confirm-owner-signature | ack-verify <ledger> <receipt.json> <owner-pins.json> | export <ledger> <build205-evidence> <rotations.jsonl> <reviewer-pins.json> <independently-pinned-tail> <renewal-receipts.json> <owner-pins.json> <source-rechecks.json> <exception-receipts.json> <output.json> --confirm-redacted-export",
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
        : "BUILD218_SOURCE_OR_OWNER_REVIEW_FAILED",
    );
    process.exitCode = 1;
  });
}
