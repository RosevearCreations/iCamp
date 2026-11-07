import { createHash } from "node:crypto";
import {
  appendFile,
  lstat,
  open,
  readFile,
  realpath,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  reconcileOwnerSlaReceipt,
  verifyIndependentArchiveCustody,
} from "./build213-cohort-custody-reconciliation.mjs";
import { canonicalJson } from "./build212-owner-sla-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HASH = /^sha256:[a-f0-9]{64}$/;
const LEDGER_SCHEMA = "icamp.build214.external-registration.v1";
const DAY = 86_400_000;

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function instant(value) {
  const timestamp = Date.parse(value ?? "");
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  )
    throw new Error("INVALID_REGISTRATION_EXPIRY_OR_TIMESTAMP");
  return timestamp;
}

export function analyzeBuild214Aging(artifactReview, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error("INVALID_AGING_CLOCK");
  if (
    artifactReview?.schema !== "icamp.build211.artifact-expiry-renewal.v1" ||
    !Array.isArray(artifactReview.sources)
  ) {
    return {
      schema: "icamp.build214.ci-evidence-aging.v1",
      state: "ORIGINAL_ARTIFACT_SOURCE_UNAVAILABLE_REVIEW_REQUIRED",
      alerts: [],
      originalArtifactsReviewed: 0,
      independentRegistrationAvailableInCI: false,
      automatedApproval: false,
      releaseChecksChanged: false,
      commsTestAuthorized: false,
    };
  }
  const alerts = artifactReview.sources
    .filter((source) => source.status !== "ORIGINAL_ARTIFACT_AVAILABLE")
    .map((source) => ({
      artifactId: source.artifactId,
      runId: source.runId,
      status: source.status,
      expiresAt: source.expiresAt ?? null,
      daysRemaining: source.daysRemaining ?? null,
    }));
  return {
    schema: "icamp.build214.ci-evidence-aging.v1",
    state: alerts.length
      ? "SOURCE_AGING_OR_CONFLICT_OWNER_REVIEW_REQUIRED"
      : "SOURCE_METADATA_CURRENT_EXTERNAL_CUSTODY_UNVERIFIED",
    alerts,
    originalArtifactsReviewed: artifactReview.sources.length,
    warningWindowDays: 7,
    independentRegistrationAvailableInCI: false,
    independentlyRetainedOriginalsVerifiedInCI: 0,
    signedOwnerDecisionsInCI: 0,
    automatedApproval: false,
    releaseChecksChanged: false,
    commsTestAuthorized: false,
  };
}

export function makeArchiveRegistration({ claims, verification, attestation }) {
  if (
    verification?.schema !==
      "icamp.build213.verified-original-archive-custody.v1" ||
    verification.signatureCryptographicallyVerified !== true ||
    verification.copiedArchiveDigest !== claims?.sourceDigest ||
    typeof attestation?.signatureBase64 !== "string"
  )
    throw new Error("UNVERIFIED_ORIGINAL_ARCHIVE_CANNOT_REGISTER");
  return {
    kind: "VERIFIED_ARCHIVE_COPY",
    sourceIdentity: {
      artifactId: claims.sourceArtifactId,
      runId: claims.sourceRunId,
      jobId: claims.sourceJobId,
      commit: claims.sourceHeadSha,
    },
    sourceDigest: claims.sourceDigest,
    evidencePacketDigest: digest(canonicalJson({ claims, attestation })),
    signerKeyId: claims.custodianKeyId,
    storageReference: claims.storageReference,
    expiresAt: claims.expiresAt,
    cryptographicVerification: "PINNED_CUSTODIAN_SIGNATURE_AND_ORIGINAL_BYTES",
    immutableStorageVerified: false,
    independentHumanIdentityEstablishedByScript: false,
  };
}

export function makeOwnerRegistration({ receipt, verification }) {
  if (
    verification?.schema !== "icamp.build213.reconciled-sla-receipt.v1" ||
    verification.signedReceipt?.ownerSignatureCryptographicallyVerified !==
      true ||
    receipt?.request?.evidenceDigest !==
      verification.signedReceipt.evidenceDigest
  )
    throw new Error("UNVERIFIED_SIGNED_SLA_RECEIPT_CANNOT_REGISTER");
  return {
    kind: "VERIFIED_OWNER_SLA_DECISION",
    sourceIdentity: {
      commit: receipt.request.commit,
      nonce: receipt.request.nonce,
    },
    sourceDigest: receipt.request.evidenceDigest,
    evidencePacketDigest: digest(canonicalJson(receipt)),
    signerKeyId: receipt.request.keyId,
    decision: receipt.request.decision,
    expiresAt: receipt.request.expiresAt,
    cryptographicVerification: "PINNED_OWNER_SIGNATURE_FOR_EXACT_EVIDENCE",
    independentHumanIdentityEstablishedByScript: false,
    productionAuthorizationGranted: false,
    commsTestAuthorized: false,
  };
}

export function verifyRegistrationLedger(
  lines,
  { expectedHead = null, now = Date.now() } = {},
) {
  if (!Array.isArray(lines) || !Number.isFinite(now))
    throw new Error("INVALID_REGISTRATION_LEDGER");
  let previous = "GENESIS";
  const identities = new Set();
  const entries = [];
  for (const [index, entry] of lines.entries()) {
    if (
      entry?.schema !== LEDGER_SCHEMA ||
      entry.sequence !== index + 1 ||
      entry.previousHash !== previous ||
      !HASH.test(entry.entryHash ?? "") ||
      !["VERIFIED_ARCHIVE_COPY", "VERIFIED_OWNER_SLA_DECISION"].includes(
        entry.kind,
      ) ||
      !HASH.test(entry.sourceDigest ?? "") ||
      !HASH.test(entry.evidencePacketDigest ?? "") ||
      typeof entry.signerKeyId !== "string" ||
      entry.signerKeyId.length < 3 ||
      entry.independentHumanIdentityEstablishedByScript !== false ||
      (entry.kind === "VERIFIED_ARCHIVE_COPY" &&
        entry.immutableStorageVerified !== false) ||
      (entry.kind === "VERIFIED_OWNER_SLA_DECISION" &&
        (entry.productionAuthorizationGranted !== false ||
          entry.commsTestAuthorized !== false))
    )
      throw new Error("INVALID_OR_REORDERED_REGISTRATION_ENTRY");
    instant(entry.recordedAt);
    instant(entry.expiresAt);
    const { entryHash, ...payload } = entry;
    if (digest(canonicalJson(payload)) !== entryHash)
      throw new Error("REGISTRATION_HASH_CHAIN_MISMATCH");
    const identity = `${entry.kind}:${entry.evidencePacketDigest}`;
    if (identities.has(identity))
      throw new Error("DUPLICATE_EXTERNAL_REGISTRATION");
    identities.add(identity);
    previous = entry.entryHash;
    const daysRemaining = Math.ceil((instant(entry.expiresAt) - now) / DAY);
    entries.push({
      sequence: entry.sequence,
      kind: entry.kind,
      sourceIdentity: entry.sourceIdentity,
      sourceDigest: entry.sourceDigest,
      expiresAt: entry.expiresAt,
      daysRemaining,
      state:
        daysRemaining <= 0
          ? "REGISTRATION_ATTESTATION_EXPIRED_REVIEW_REQUIRED"
          : daysRemaining <= 14
            ? "REGISTRATION_RENEWAL_DUE_WITHIN_14_DAYS"
            : "SIGNED_EVIDENCE_CURRENT_NOT_PERMANENT_CUSTODY",
    });
  }
  if (expectedHead !== null && expectedHead !== previous)
    throw new Error("EXTERNALLY_PINNED_LEDGER_HEAD_MISMATCH");
  return {
    schema: "icamp.build214.registration-ledger-audit.v1",
    entries,
    headHash: previous,
    externallyPinnedHeadMatched: expectedHead !== null,
    state: entries.some(
      (entry) =>
        entry.state !== "SIGNED_EVIDENCE_CURRENT_NOT_PERMANENT_CUSTODY",
    )
      ? "OWNER_RENEWAL_REVIEW_REQUIRED"
      : entries.length
        ? "LOCAL_CHAIN_VERIFIED_EXTERNAL_HEAD_PIN_RECOMMENDED"
        : "NO_EXTERNAL_REGISTRATIONS_PRESENT",
    ledgerCannotProveIndependentStorageOrHumanAuthority: true,
    replacementOrTruncationRequiresExternalHeadPinToDetect: true,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function appendRegistrationEntry(
  lines,
  registration,
  { now = Date.now() } = {},
) {
  verifyRegistrationLedger(lines, { now });
  if (
    !registration ||
    !["VERIFIED_ARCHIVE_COPY", "VERIFIED_OWNER_SLA_DECISION"].includes(
      registration.kind,
    ) ||
    instant(registration.expiresAt) <= now ||
    !HASH.test(registration.sourceDigest ?? "") ||
    !HASH.test(registration.evidencePacketDigest ?? "")
  )
    throw new Error("INVALID_OR_EXPIRED_REGISTRATION");
  const payload = {
    ...registration,
    schema: LEDGER_SCHEMA,
    sequence: lines.length + 1,
    previousHash: lines.at(-1)?.entryHash ?? "GENESIS",
    recordedAt: new Date(now).toISOString(),
  };
  const entry = { ...payload, entryHash: digest(canonicalJson(payload)) };
  verifyRegistrationLedger([...lines, entry], { now });
  return entry;
}

async function readLedger(path) {
  try {
    const raw = await readFile(path, "utf8");
    if (raw.length > 2_000_000)
      throw new Error("REGISTRATION_LEDGER_TOO_LARGE");
    if (raw && !raw.endsWith("\n"))
      throw new Error("REGISTRATION_LEDGER_INCOMPLETE_LINE");
    return raw.trim() ? raw.trimEnd().split("\n").map(JSON.parse) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function requireExternalLedger(path) {
  if (!isAbsolute(path)) throw new Error("LEDGER_PATH_MUST_BE_ABSOLUTE");
  const actualParent = await realpath(dirname(resolve(path)));
  if (actualParent === root || actualParent.startsWith(`${root}${sep}`))
    throw new Error("PRIVATE_LEDGER_MUST_BE_OUTSIDE_REPOSITORY");
  try {
    const existing = await lstat(path);
    if (!existing.isFile())
      throw new Error("LEDGER_NOT_REGULAR_NON_SYMLINK_FILE");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function readExternalRegistrationLedger(
  path,
  { now = Date.now() } = {},
) {
  await requireExternalLedger(path);
  const lines = await readLedger(path);
  verifyRegistrationLedger(lines, { now });
  return lines;
}

export async function registerExternalEvidence(
  path,
  registration,
  { now = Date.now() } = {},
) {
  await requireExternalLedger(path);
  const lockPath = `${path}.lock`;
  const lock = await open(lockPath, "wx", 0o600);
  try {
    const entries = await readLedger(path);
    const entry = appendRegistrationEntry(entries, registration, { now });
    await appendFile(path, `${JSON.stringify(entry)}\n`, {
      flag: "a",
      mode: 0o600,
    });
    const verified = verifyRegistrationLedger(await readLedger(path), { now });
    return {
      entryHash: entry.entryHash,
      headHash: verified.headHash,
      sequence: entry.sequence,
    };
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(args) {
  const [command, ...values] = args;
  if (command === "audit" && [1, 2].includes(values.length)) {
    const [path, expectedHead] = values;
    await requireExternalLedger(path);
    console.log(
      JSON.stringify(
        verifyRegistrationLedger(await readLedger(path), { expectedHead }),
      ),
    );
    return;
  }
  if (
    command === "register-archive" &&
    values.length === 6 &&
    values.at(-1) === "--confirm-independent-review"
  ) {
    const [ledger, zip, claimsPath, attestationPath, pinsPath] = values;
    await requireExternalLedger(ledger);
    const size = await stat(zip);
    if (!size.isFile() || size.size > 50 * 1024 * 1024)
      throw new Error("ORIGINAL_ARCHIVE_SIZE_LIMIT");
    const [archive, claims, attestation, custodianPins, history] =
      await Promise.all([
        readFile(zip),
        json(claimsPath),
        json(attestationPath),
        json(pinsPath),
        json(resolve(root, "fixtures/build210-reviewed-chromium-history.json")),
      ]);
    const verification = verifyIndependentArchiveCustody({
      archive,
      claims,
      signatureBase64: attestation.signatureBase64,
      custodianPins,
      history,
    });
    console.log(
      JSON.stringify(
        await registerExternalEvidence(
          ledger,
          makeArchiveRegistration({ claims, attestation, verification }),
        ),
      ),
    );
    return;
  }
  if (
    command === "register-owner" &&
    values.length === 5 &&
    values.at(-1) === "--confirm-independent-review"
  ) {
    const [ledger, evidencePath, receiptPath, pinsPath] = values;
    await requireExternalLedger(ledger);
    const [evidence, receipt, ownerPins] = await Promise.all([
      json(evidencePath),
      json(receiptPath),
      json(pinsPath),
    ]);
    const verification = reconcileOwnerSlaReceipt({
      evidence,
      receipt,
      ownerPins,
    });
    console.log(
      JSON.stringify(
        await registerExternalEvidence(
          ledger,
          makeOwnerRegistration({ receipt, verification }),
        ),
      ),
    );
    return;
  }
  throw new Error(
    "USAGE: register-archive <absolute-external-ledger.jsonl> <original.zip> <claims.json> <attestation.json> <custodian-pins.json> --confirm-independent-review; register-owner <absolute-external-ledger.jsonl> <evidence.json> <receipt.json> <owner-pins.json> --confirm-independent-review; audit <absolute-external-ledger.jsonl> [independently-pinned-headHash]",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD214_REGISTRATION_ERROR",
    );
    process.exitCode = 1;
  });
}
