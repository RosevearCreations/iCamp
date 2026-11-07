import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify as verifySignature,
} from "node:crypto";
import {
  appendFile,
  lstat,
  open,
  readFile,
  realpath,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readExternalRegistrationLedger,
  verifyRegistrationLedger,
} from "./build214-owner-custody-register.mjs";
import { verifyIndependentAnchor } from "./build215-independent-anchor-triage.mjs";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DAY = 86_400_000;
const HASH = /^sha256:[0-9a-f]{64}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const NONCE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROTATION = "icamp.build216.signed-head-rotation.v1";
const RENEWAL = "icamp.build216.owner-renewal-request.v1";
const RECEIPT = "icamp.build216.owner-renewal-receipt.v1";
const PINS = "icamp.build216.owner-renewal-pins.v1";
const CHOICES = Object.freeze([
  "REQUEST_EVIDENCE_RENEWAL",
  "DEFER_RENEWAL_REVIEW",
  "REJECT_RENEWAL",
  "ESCALATE_SOURCE_CONFLICT",
]);

const hash = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
function utc(value) {
  const ms = Date.parse(value ?? "");
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value)
    throw new Error("INVALID_RENEWAL_OR_ROTATION_TIMESTAMP");
  return ms;
}
function outsideRoot(path) {
  return path === ROOT || path.startsWith(`${ROOT}${sep}`);
}
async function externalPath(path) {
  if (
    !isAbsolute(path) ||
    outsideRoot(resolve(path)) ||
    outsideRoot(await realpath(dirname(resolve(path))))
  )
    throw new Error("PRIVATE_RENEWAL_FILE_MUST_BE_OUTSIDE_REPOSITORY");
  try {
    const meta = await lstat(path);
    if (!meta.isFile())
      throw new Error("PRIVATE_RENEWAL_FILE_MUST_NOT_BE_SYMLINK");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function verifyRotationHistory({
  ledger,
  records,
  pins,
  expectedTail = null,
  now = Date.now(),
}) {
  const audit = verifyRegistrationLedger(ledger, { now });
  if (!Array.isArray(records) || !Number.isFinite(now))
    throw new Error("INVALID_CHECKPOINT_ROTATION_HISTORY");
  const used = new Set();
  let previous = "GENESIS";
  let previousSequence = 0;
  let previousTime = -Infinity;
  const checkpoints = [];
  for (const [index, record] of records.entries()) {
    if (
      record?.schema !== ROTATION ||
      record.index !== index + 1 ||
      record.previousHash !== previous ||
      !HASH.test(record.recordHash ?? "") ||
      !record.claims ||
      !record.attestation
    )
      throw new Error("INVALID_OR_REORDERED_CHECKPOINT_ROTATION");
    const { recordHash, ...payload } = record;
    if (hash(canonicalJson(payload)) !== recordHash)
      throw new Error("CHECKPOINT_ROTATION_HASH_CHAIN_MISMATCH");
    const at = utc(record.claims.anchoredAt);
    if (record.claims.sequence < previousSequence || at <= previousTime)
      throw new Error("CHECKPOINT_ROTATION_REWIND_OR_REPLAY");
    const verified = verifyIndependentAnchor({
      ledger,
      claims: record.claims,
      attestation: record.attestation,
      pins,
      now: at + 1000,
      consumedAnchorIds: used,
    });
    if (verified.signatureAndPinVerified !== true)
      throw new Error("UNVERIFIED_CHECKPOINT_ROTATION_SIGNATURE");
    previous = record.recordHash;
    previousSequence = record.claims.sequence;
    previousTime = at;
    checkpoints.push({
      index: record.index,
      reviewerKeyId: record.claims.keyId,
      ledgerSequence: record.claims.sequence,
      headHash: record.claims.headHash,
      expiresAt: record.claims.expiresAt,
      state:
        utc(record.claims.expiresAt) <= now
          ? "HISTORIC_ANCHOR_EXPIRED_NOT_CURRENT_AUTHORITY"
          : "SIGNATURE_VALID_FOR_PINNED_HISTORIC_PREFIX",
    });
  }
  if (expectedTail !== null && expectedTail !== previous)
    throw new Error("INDEPENDENTLY_PINNED_ROTATION_TAIL_MISMATCH");
  const last = records.at(-1);
  return {
    schema: "icamp.build216.verified-checkpoint-rotation-history.v1",
    state: !last
      ? "NO_INDEPENDENT_ROTATION_CHECKPOINTS"
      : last.claims.sequence !== ledger.length
        ? "NEW_LEDGER_ENTRIES_NOT_YET_ANCHORED"
        : utc(last.claims.expiresAt) <= now
          ? "LATEST_SIGNED_ANCHOR_EXPIRED_REVIEW_REQUIRED"
          : "CURRENT_SIGNED_PREFIX_VERIFIED_STORAGE_UNPROVEN",
    checkpoints,
    tailHash: previous,
    externallyPinnedTailMatched: expectedTail !== null,
    currentLedgerHeadHash: audit.headHash,
    independentlyDurableStorageVerified: false,
    ownerReleaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function appendRotationCheckpoint({
  ledger,
  records,
  claims,
  attestation,
  pins,
  expectedTail,
  now = Date.now(),
}) {
  if (
    !expectedTail ||
    expectedTail !== (records.at(-1)?.recordHash ?? "GENESIS")
  )
    throw new Error("INDEPENDENT_PREVIOUS_ROTATION_TAIL_REQUIRED");
  verifyRotationHistory({ ledger, records, pins, expectedTail, now });
  const verified = verifyIndependentAnchor({
    ledger,
    claims,
    attestation,
    pins,
    now,
  });
  if (verified.signatureAndPinVerified !== true)
    throw new Error("ROTATION_CHECKPOINT_NOT_AUTHENTICATED");
  const prior = records.at(-1);
  if (
    prior &&
    (claims.sequence < prior.claims.sequence ||
      utc(claims.anchoredAt) <= utc(prior.claims.anchoredAt))
  )
    throw new Error("ROTATION_REWIND_REFUSED");
  const payload = {
    schema: ROTATION,
    index: records.length + 1,
    previousHash: prior?.recordHash ?? "GENESIS",
    claims,
    attestation,
  };
  const record = { ...payload, recordHash: hash(canonicalJson(payload)) };
  verifyRotationHistory({ ledger, records: [...records, record], pins, now });
  return record;
}

export function prepareOwnerRenewal(
  ledger,
  {
    sequence,
    choice = "DEFER_RENEWAL_REVIEW",
    keyId,
    notes = "",
    now = Date.now(),
    days = 7,
  } = {},
) {
  const audit = verifyRegistrationLedger(ledger, { now });
  const target = ledger[sequence - 1];
  if (
    !target ||
    !Number.isSafeInteger(sequence) ||
    !CHOICES.includes(choice) ||
    !KEY.test(keyId ?? "") ||
    typeof notes !== "string" ||
    notes.length > 320 ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > 30
  )
    throw new Error("INVALID_OWNER_RENEWAL_DECISION_REQUEST");
  return {
    schema: RENEWAL,
    repository: "RosevearCreations/iCamp",
    purpose: "REVIEW_ONLY_NO_AUTOMATIC_RENEWAL",
    keyId,
    nonce: randomUUID(),
    choice,
    notes,
    targetSequence: sequence,
    targetEntryHash: target.entryHash,
    targetKind: target.kind,
    targetSourceDigest: target.sourceDigest,
    targetExpiresAt: target.expiresAt,
    reviewedLedgerHead: audit.headHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + days * DAY).toISOString(),
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function validateOwnerRenewalRequest(request, ledger, now = Date.now()) {
  const audit = verifyRegistrationLedger(ledger, { now });
  const target = ledger[request?.targetSequence - 1];
  if (
    request?.schema !== RENEWAL ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !== "REVIEW_ONLY_NO_AUTOMATIC_RENEWAL" ||
    !KEY.test(request.keyId ?? "") ||
    !NONCE.test(request.nonce ?? "") ||
    !CHOICES.includes(request.choice) ||
    typeof request.notes !== "string" ||
    request.notes.length > 320 ||
    !Number.isSafeInteger(request.targetSequence) ||
    !target ||
    target.entryHash !== request.targetEntryHash ||
    target.kind !== request.targetKind ||
    target.sourceDigest !== request.targetSourceDigest ||
    target.expiresAt !== request.targetExpiresAt ||
    request.reviewedLedgerHead !== audit.headHash ||
    request.productionApprovalGranted !== false ||
    request.commsTestAuthorized !== false ||
    utc(request.createdAt) > now + 60_000 ||
    utc(request.expiresAt) <= now ||
    utc(request.expiresAt) - utc(request.createdAt) > 30 * DAY
  )
    throw new Error("OWNER_RENEWAL_SCOPE_OR_LEDGER_DRIFT");
  return request;
}

export function signOwnerRenewal(
  request,
  ledger,
  privateKeyPem,
  now = Date.now(),
) {
  validateOwnerRenewalRequest(request, ledger, now);
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("RENEWAL_SIGNER_NOT_ED25519");
  return {
    schema: RECEIPT,
    algorithm: "Ed25519",
    request,
    signerKeyFingerprint: publicKeyFingerprint(key),
    signatureBase64: sign(
      null,
      Buffer.from(canonicalJson({ schema: RECEIPT, request })),
      key,
    ).toString("base64"),
  };
}

export function verifyOwnerRenewal(
  receipt,
  ledger,
  pins,
  { now = Date.now(), consumedNonces = new Set() } = {},
) {
  if (
    receipt?.schema !== RECEIPT ||
    receipt.algorithm !== "Ed25519" ||
    !HASH.test(receipt.signerKeyFingerprint ?? "") ||
    typeof receipt.signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64) ||
    pins?.schema !== PINS ||
    !Array.isArray(pins.signers)
  )
    throw new Error("INVALID_OWNER_RENEWAL_RECEIPT");
  validateOwnerRenewalRequest(receipt.request, ledger, now);
  if (consumedNonces.has(receipt.request.nonce))
    throw new Error("REPLAYED_OWNER_RENEWAL_NONCE");
  const matches = pins.signers.filter(
    (row) => row.keyId === receipt.request.keyId,
  );
  if (matches.length !== 1)
    throw new Error("OWNER_RENEWAL_PIN_MISSING_OR_DUPLICATE");
  const pin = matches[0];
  if (
    pin.enabled !== true ||
    pin.role !== "ICAMP_CUSTODY_RENEWAL_OWNER" ||
    !HASH.test(pin.fingerprint ?? "") ||
    publicKeyFingerprint(pin.publicKeyPem) !== pin.fingerprint ||
    pin.fingerprint !== receipt.signerKeyFingerprint
  )
    throw new Error("UNTRUSTED_OWNER_RENEWAL_PIN");
  const bytes = Buffer.from(receipt.signatureBase64, "base64");
  if (
    bytes.length !== 64 ||
    !verifySignature(
      null,
      Buffer.from(canonicalJson({ schema: RECEIPT, request: receipt.request })),
      createPublicKey(pin.publicKeyPem),
      bytes,
    )
  )
    throw new Error("INVALID_OWNER_RENEWAL_SIGNATURE");
  consumedNonces.add(receipt.request.nonce);
  return {
    schema: "icamp.build216.verified-owner-renewal-review.v1",
    state: "SIGNED_OWNER_RENEWAL_CHOICE_REVIEW_ONLY",
    choice: receipt.request.choice,
    targetSequence: receipt.request.targetSequence,
    targetEntryHash: receipt.request.targetEntryHash,
    signedByPinnedKey: true,
    physicalSourceRenewed: false,
    existingDecisionSuperseded: false,
    independentHumanIdentityEstablishedByTool: false,
    releaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

function dueState(expiresAt, now, windowDays) {
  if (!expiresAt) return "SOURCE_EXPIRY_UNAVAILABLE";
  const time = utc(expiresAt);
  return time <= now
    ? "EXPIRED_OWNER_REVIEW"
    : time <= now + windowDays * DAY
      ? "EXPIRING_OWNER_REVIEW"
      : "CURRENT_MONITOR_ONLY";
}

export function buildExpiryTimeline({
  ledger,
  ciEvidence,
  rotations = [],
  now = Date.now(),
}) {
  verifyRegistrationLedger(ledger, { now });
  const sources = ciEvidence?.build211?.artifactReview;
  const sourceValid =
    sources?.schema === "icamp.build211.artifact-expiry-renewal.v1" &&
    Array.isArray(sources.sources);
  const byId = new Map();
  if (sourceValid) {
    for (const row of sources.sources) {
      if (!Number.isSafeInteger(row.artifactId) || byId.has(row.artifactId))
        throw new Error("CONFLICTING_OR_DUPLICATE_ORIGINAL_ARTIFACT_SOURCE");
      byId.set(row.artifactId, row);
    }
  }
  const events = [];
  if (sourceValid) {
    for (const row of byId.values()) {
      events.push({
        kind: "GITHUB_ORIGINAL_ARTIFACT",
        artifactId: row.artifactId,
        runId: row.runId,
        evidenceDigest: row.pinnedOriginalDigest,
        expiresAt: row.expiresAt ?? null,
        state:
          row.status === "ORIGINAL_ARTIFACT_AVAILABLE"
            ? dueState(row.expiresAt, now, 7)
            : `SOURCE_${row.status}_REVIEW_REQUIRED`,
        provenance:
          "BUILD211_READ_ONLY_GITHUB_METADATA_SNAPSHOT_NOT_FRESH_REMOTE_PROOF",
      });
    }
  }
  for (const row of ledger) {
    const original =
      row.kind === "VERIFIED_ARCHIVE_COPY"
        ? byId.get(row.sourceIdentity.artifactId)
        : null;
    const sourceMatch = !sourceValid
      ? null
      : row.kind === "VERIFIED_ARCHIVE_COPY"
        ? original?.pinnedOriginalDigest === row.sourceDigest &&
          original.runId === row.sourceIdentity.runId &&
          original.jobId === row.sourceIdentity.jobId
        : null;
    events.push({
      kind: row.kind,
      registrationSequence: row.sequence,
      entryHash: row.entryHash,
      artifactId: row.sourceIdentity.artifactId ?? null,
      evidenceDigest: row.sourceDigest,
      expiresAt: row.expiresAt,
      sourceMatch,
      state:
        sourceMatch === false
          ? "SOURCE_IDENTITY_CONFLICT_QUARANTINED"
          : dueState(row.expiresAt, now, 14),
      provenance:
        "LOCAL_HASHED_REGISTRY_ATTESTATION_NOT_INDEPENDENT_SOURCE_VERIFICATION",
    });
  }
  for (const row of rotations) {
    if (row?.schema !== ROTATION || !row.claims)
      throw new Error("INVALID_ROTATION_FOR_EXPIRY_TIMELINE");
    events.push({
      kind: "INDEPENDENT_ANCHOR_CHECKPOINT",
      checkpointIndex: row.index,
      evidenceDigest: row.claims.headHash,
      expiresAt: row.claims.expiresAt,
      state: dueState(row.claims.expiresAt, now, 7),
      provenance: "OFFLINE_ANCHOR_CLAIM_MUST_BE_SEPARATELY_SIGNATURE_VERIFIED",
    });
  }
  events.sort((a, b) => {
    const aa = a.expiresAt ? utc(a.expiresAt) : -Infinity;
    const bb = b.expiresAt ? utc(b.expiresAt) : -Infinity;
    return aa - bb || a.kind.localeCompare(b.kind);
  });
  const reviewRequired = events.filter(
    (event) => event.state !== "CURRENT_MONITOR_ONLY",
  ).length;
  return {
    schema: "icamp.build216.source-linked-expiry-timeline.v1",
    state: !sourceValid
      ? "ORIGINAL_SOURCE_SNAPSHOT_UNAVAILABLE_HOLD"
      : reviewRequired
        ? "SOURCE_OR_EXPIRY_OWNER_ACTION_REQUIRED"
        : "SOURCE_SNAPSHOT_CURRENT_MONITORING_NOT_APPROVAL",
    events,
    ownerActionCount: reviewRequired,
    historicalSourceSnapshotAvailable: sourceValid,
    liveOriginalSourceRecheckedByTool: false,
    unverifiedClaimsNeverRenewArtifacts: true,
    automaticOwnerDecision: false,
    commsTestAuthorized: false,
    releaseApprovalGranted: false,
  };
}

export function analyzeBuild216Ci(build215) {
  return {
    schema: "icamp.build216.checkpoint-owner-timeline-handoff.v1",
    state: "PRIVATE_HEAD_ROTATIONS_AND_OWNER_RECEIPTS_NOT_IN_CI",
    publicOriginalArtifactAlerts: build215?.originalArtifactAlerts ?? null,
    independentRotationVerifiedInCI: false,
    ownerRenewalSignedInCI: false,
    privateLedgerOrKeysImportedIntoCI: false,
    additionalProtectedChecks: 0,
    releaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

async function readRotations(path) {
  await externalPath(path);
  try {
    const raw = await readFile(path, "utf8");
    if (raw.length > 2_000_000 || (raw && !raw.endsWith("\n")))
      throw new Error("INCOMPLETE_OR_OVERSIZED_ROTATION_LEDGER");
    return raw.trim() ? raw.trimEnd().split("\n").map(JSON.parse) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function main(args) {
  const [command, ...v] = args;
  if (
    command === "rotate" &&
    v.length === 7 &&
    v[6] === "--confirm-independent-review"
  ) {
    const [
      ledgerPath,
      rotationPath,
      claimsPath,
      attestationPath,
      pinsPath,
      expectedTail,
    ] = v;
    await externalPath(rotationPath);
    const lock = await open(`${rotationPath}.lock`, "wx", 0o600);
    try {
      const [ledger, records, claims, attestation, pins] = await Promise.all([
        readExternalRegistrationLedger(ledgerPath),
        readRotations(rotationPath),
        json(claimsPath),
        json(attestationPath),
        json(pinsPath),
      ]);
      const record = appendRotationCheckpoint({
        ledger,
        records,
        claims,
        attestation,
        pins,
        expectedTail,
      });
      await appendFile(rotationPath, `${JSON.stringify(record)}\n`, {
        flag: "a",
        mode: 0o600,
      });
      console.log(
        JSON.stringify(
          verifyRotationHistory({
            ledger,
            records: [...records, record],
            pins,
          }),
        ),
      );
    } finally {
      await lock.close();
      await unlink(`${rotationPath}.lock`);
    }
    return;
  }
  if (command === "verify-rotations" && (v.length === 3 || v.length === 4)) {
    const [ledgerPath, rotationPath, pinsPath, expectedTail] = v;
    const [ledger, records, pins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      readRotations(rotationPath),
      json(pinsPath),
    ]);
    console.log(
      JSON.stringify(
        verifyRotationHistory({ ledger, records, pins, expectedTail }),
      ),
    );
    return;
  }
  if (command === "prepare-renewal" && v.length === 5) {
    const [ledgerPath, sequence, choice, keyId, outputPath] = v;
    await externalPath(outputPath);
    const ledger = await readExternalRegistrationLedger(ledgerPath);
    await writeFile(
      outputPath,
      `${JSON.stringify(prepareOwnerRenewal(ledger, { sequence: Number(sequence), choice, keyId }), null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Unsigned owner renewal review request saved outside the checkout.",
    );
    return;
  }
  if (
    command === "sign-renewal" &&
    v.length === 5 &&
    v[4] === "--confirm-owner-review"
  ) {
    const [ledgerPath, requestPath, privateKeyPath, outputPath] = v;
    await externalPath(outputPath);
    await externalPath(privateKeyPath);
    const [ledger, request, key] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(requestPath),
      readFile(privateKeyPath, "utf8"),
    ]);
    await writeFile(
      outputPath,
      `${JSON.stringify(signOwnerRenewal(request, ledger, key), null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Signed owner review receipt created locally; source custody was not renewed.",
    );
    return;
  }
  if (command === "verify-renewal" && v.length === 3) {
    const [ledgerPath, receiptPath, pinsPath] = v;
    const [ledger, receipt, pins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(receiptPath),
      json(pinsPath),
    ]);
    console.log(JSON.stringify(verifyOwnerRenewal(receipt, ledger, pins)));
    return;
  }
  if (command === "timeline" && (v.length === 2 || v.length === 4)) {
    const [ledgerPath, evidencePath, rotationPath, pinsPath] = v;
    const [ledger, ciEvidence] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(evidencePath),
    ]);
    const rotations = rotationPath ? await readRotations(rotationPath) : [];
    if (rotationPath)
      verifyRotationHistory({
        ledger,
        records: rotations,
        pins: await json(pinsPath),
      });
    console.log(
      JSON.stringify(buildExpiryTimeline({ ledger, ciEvidence, rotations })),
    );
    return;
  }
  throw new Error(
    "USAGE: rotate <ledger> <rotations.jsonl> <claims.json> <signature.json> <pins.json> <independently-pinned-previous-tailHash-or-GENESIS> --confirm-independent-review; verify-rotations <ledger> <rotations.jsonl> <pins.json> [previously-pinned-tailHash]; prepare-renewal <ledger> <sequence> <REQUEST_EVIDENCE_RENEWAL|DEFER_RENEWAL_REVIEW|REJECT_RENEWAL|ESCALATE_SOURCE_CONFLICT> <ownerKeyId> <request.json>; sign-renewal <ledger> <request.json> <owner-private.pem> <receipt.json> --confirm-owner-review; verify-renewal <ledger> <receipt.json> <pins.json>; timeline <ledger> <build205-evidence.json> [rotations.jsonl pins.json]",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD216_REVIEW_FAILED",
    );
    process.exitCode = 1;
  });
}
