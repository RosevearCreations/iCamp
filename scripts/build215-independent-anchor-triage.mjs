import {
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
import {
  canonicalJson,
  publicKeyFingerprint,
} from "./build212-owner-sla-receipt.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHA = /^sha256:[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const DAY = 86_400_000;
const ANCHOR_CLAIMS = "icamp.build215.independent-ledger-anchor-claims.v1";
const ANCHOR_PINS = "icamp.build215.independent-anchor-pins.v1";
const ANCHOR_SIGNATURE =
  "icamp.build215.independent-ledger-anchor-signature.v1";

function date(value) {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new Error("INVALID_SIGNED_EVIDENCE_TIMESTAMP");
  return time;
}

function insideSource(path) {
  return path === ROOT || path.startsWith(`${ROOT}${sep}`);
}

async function requireExternalOutput(path) {
  if (!isAbsolute(path) || insideSource(resolve(path)))
    throw new Error("INDEPENDENT_ANCHOR_OUTPUT_MUST_BE_EXTERNAL");
  if (insideSource(await realpath(dirname(resolve(path)))))
    throw new Error("INDEPENDENT_ANCHOR_OUTPUT_DIRECTORY_MUST_BE_EXTERNAL");
}

export function prepareAnchorClaims(
  ledger,
  { keyId, now = Date.now(), validDays = 7 } = {},
) {
  const audit = verifyRegistrationLedger(ledger, { now });
  if (
    !ledger.length ||
    !KEY.test(keyId ?? "") ||
    !Number.isSafeInteger(validDays) ||
    validDays < 1 ||
    validDays > 30
  )
    throw new Error("INVALID_INDEPENDENT_ANCHOR_REQUEST");
  return {
    schema: ANCHOR_CLAIMS,
    repository: "RosevearCreations/iCamp",
    scope: "LEDGER_HASH_CHAIN_PREFIX_ONLY",
    keyId,
    anchorId: randomUUID(),
    sequence: ledger.length,
    headHash: audit.headHash,
    anchoredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validDays * DAY).toISOString(),
    releaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function signAnchorClaims({
  ledger,
  claims,
  privateKeyPem,
  now = Date.now(),
}) {
  verifyRegistrationLedger(ledger, { now });
  if (
    claims?.schema !== ANCHOR_CLAIMS ||
    claims.repository !== "RosevearCreations/iCamp" ||
    claims.scope !== "LEDGER_HASH_CHAIN_PREFIX_ONLY" ||
    !KEY.test(claims.keyId ?? "") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      claims.anchorId ?? "",
    ) ||
    !Number.isSafeInteger(claims.sequence) ||
    claims.sequence < 1 ||
    claims.sequence > ledger.length ||
    ledger[claims.sequence - 1].entryHash !== claims.headHash ||
    ledger.some((entry) => entry.signerKeyId === claims.keyId) ||
    claims.releaseApprovalGranted !== false ||
    claims.commsTestAuthorized !== false ||
    date(claims.anchoredAt) > now + 60_000 ||
    date(claims.expiresAt) <= now ||
    date(claims.expiresAt) <= date(claims.anchoredAt) ||
    date(claims.expiresAt) - date(claims.anchoredAt) > 30 * DAY
  )
    throw new Error("INDEPENDENT_ANCHOR_SIGNING_SCOPE_INVALID");
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519")
    throw new Error("INDEPENDENT_ANCHOR_SIGNER_NOT_ED25519");
  return {
    schema: ANCHOR_SIGNATURE,
    algorithm: "Ed25519",
    signerKeyFingerprint: publicKeyFingerprint(privateKey),
    signatureBase64: sign(
      null,
      Buffer.from(canonicalJson({ schema: ANCHOR_SIGNATURE, claims })),
      privateKey,
    ).toString("base64"),
  };
}

export function verifyIndependentAnchor({
  ledger,
  claims,
  attestation,
  pins,
  now = Date.now(),
  consumedAnchorIds = new Set(),
}) {
  const audit = verifyRegistrationLedger(ledger, { now });
  if (
    claims?.schema !== ANCHOR_CLAIMS ||
    claims.repository !== "RosevearCreations/iCamp" ||
    claims.scope !== "LEDGER_HASH_CHAIN_PREFIX_ONLY" ||
    !KEY.test(claims.keyId ?? "") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      claims.anchorId ?? "",
    ) ||
    !Number.isSafeInteger(claims.sequence) ||
    claims.sequence < 1 ||
    claims.sequence > ledger.length ||
    !SHA.test(claims.headHash ?? "") ||
    claims.releaseApprovalGranted !== false ||
    claims.commsTestAuthorized !== false ||
    pins?.schema !== ANCHOR_PINS ||
    !Array.isArray(pins.signers) ||
    attestation?.schema !== ANCHOR_SIGNATURE ||
    attestation.algorithm !== "Ed25519" ||
    !SHA.test(attestation.signerKeyFingerprint ?? "") ||
    typeof attestation.signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(attestation.signatureBase64) ||
    consumedAnchorIds.has(claims.anchorId)
  )
    throw new Error("INVALID_OR_REPLAYED_INDEPENDENT_ANCHOR_PACKET");
  const anchoredAt = date(claims.anchoredAt);
  const expiresAt = date(claims.expiresAt);
  if (
    !Number.isFinite(now) ||
    anchoredAt > now + 60_000 ||
    expiresAt <= now ||
    expiresAt <= anchoredAt ||
    expiresAt - anchoredAt > 30 * DAY
  )
    throw new Error("INDEPENDENT_ANCHOR_EXPIRED_OR_INVALID_TIME");
  if (ledger[claims.sequence - 1]?.entryHash !== claims.headHash)
    throw new Error("SIGNED_ANCHOR_PREFIX_HEAD_MISMATCH");
  const matches = pins.signers.filter((pin) => pin.keyId === claims.keyId);
  if (matches.length !== 1)
    throw new Error("INDEPENDENT_ANCHOR_PIN_MISSING_OR_DUPLICATE");
  const pin = matches[0];
  if (
    pin.role !== "ICAMP_INDEPENDENT_LEDGER_ANCHOR_REVIEWER" ||
    pin.enabled !== true ||
    !SHA.test(pin.fingerprint ?? "") ||
    publicKeyFingerprint(pin.publicKeyPem) !== pin.fingerprint ||
    attestation.signerKeyFingerprint !== pin.fingerprint ||
    ledger.some((entry) => entry.signerKeyId === claims.keyId)
  )
    throw new Error("ANCHOR_REVIEWER_PIN_OR_ROLE_NOT_INDEPENDENT");
  const signature = Buffer.from(attestation.signatureBase64, "base64");
  if (
    signature.length !== 64 ||
    !verifySignature(
      null,
      Buffer.from(canonicalJson({ schema: ANCHOR_SIGNATURE, claims })),
      createPublicKey(pin.publicKeyPem),
      signature,
    )
  )
    throw new Error("INVALID_INDEPENDENT_ANCHOR_SIGNATURE");
  consumedAnchorIds.add(claims.anchorId);
  return {
    schema: "icamp.build215.verified-independent-anchor-readback.v1",
    state:
      claims.sequence === ledger.length
        ? "SIGNED_CURRENT_LEDGER_HEAD_VERIFIED_NOT_STORAGE_CERTIFIED"
        : "SIGNED_HISTORICAL_PREFIX_VERIFIED_NEW_ENTRIES_UNANCHORED",
    sequence: claims.sequence,
    verifiedHeadHash: claims.headHash,
    currentHeadHash: audit.headHash,
    unanchoredLaterEntries: ledger.length - claims.sequence,
    expiresAt: claims.expiresAt,
    reviewerKeyId: claims.keyId,
    signatureAndPinVerified: true,
    independentlyAuthenticatedHumanByTool: false,
    immutableStorageVerified: false,
    crossSessionReplayProtectionProvided: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function triageCustodianRenewals(ledger, now = Date.now()) {
  verifyRegistrationLedger(ledger, { now });
  const byArtifact = new Map();
  for (const entry of ledger.filter(
    (row) => row.kind === "VERIFIED_ARCHIVE_COPY",
  )) {
    const source = entry.sourceIdentity;
    if (
      !Number.isSafeInteger(source?.artifactId) ||
      !Number.isSafeInteger(source.runId) ||
      !Number.isSafeInteger(source.jobId) ||
      !COMMIT.test(source.commit ?? "") ||
      !/^(offline|vault):\/\/[A-Za-z0-9._/-]{6,200}$/.test(
        entry.storageReference ?? "",
      )
    )
      throw new Error("INVALID_ARCHIVE_CUSTODY_SOURCE_REFERENCE");
    const items = byArtifact.get(source.artifactId) ?? [];
    items.push(entry);
    byArtifact.set(source.artifactId, items);
  }
  const groups = [...byArtifact.entries()]
    .sort(([a], [b]) => a - b)
    .map(([artifactId, entries]) => {
      const sources = new Set(
        entries.map((entry) =>
          canonicalJson({
            ...entry.sourceIdentity,
            digest: entry.sourceDigest,
          }),
        ),
      );
      const active = entries.filter((entry) => date(entry.expiresAt) > now);
      const signers = new Set(active.map((entry) => entry.signerKeyId));
      const stores = new Set(active.map((entry) => entry.storageReference));
      const ownerReviewDue = entries.some(
        (entry) => date(entry.expiresAt) <= now + 14 * DAY,
      );
      const repeatedSigner = signers.size < active.length;
      const sharedStorage = stores.size < active.length;
      const state =
        sources.size > 1
          ? "CONFLICTING_ORIGINAL_IDENTITY_OR_DIGEST_QUARANTINED"
          : repeatedSigner
            ? "OVERLAPPING_CUSTODIAN_RENEWALS_MANUAL_REVIEW"
            : sharedStorage
              ? "SHARED_STORAGE_REFERENCE_INDEPENDENCE_REVIEW"
              : ownerReviewDue
                ? "CUSTODY_EXPIRY_OR_RENEWAL_ESCALATION"
                : signers.size < 2
                  ? "SECOND_CUSTODIAN_ATTESTATION_REQUIRED"
                  : "MULTI_CUSTODIAN_ATTESTATIONS_PRESENT_INDEPENDENCE_UNPROVEN";
      return {
        artifactId,
        originalSourceDigest: entries[0].sourceDigest,
        registrationSequences: entries.map((entry) => entry.sequence),
        currentAttestations: active.length,
        expiredAttestations: entries.length - active.length,
        distinctCurrentSignerKeys: signers.size,
        distinctCurrentStorageReferences: stores.size,
        ownerReviewDue,
        state,
        automaticallyResolved: false,
      };
    });
  return {
    schema: "icamp.build215.multi-custodian-renewal-triage.v1",
    groups,
    reviewRequired: groups.filter(
      (group) =>
        group.state !==
        "MULTI_CUSTODIAN_ATTESTATIONS_PRESENT_INDEPENDENCE_UNPROVEN",
    ).length,
    conflictsQuarantined: groups.filter((group) =>
      group.state.includes("CONFLICTING_"),
    ).length,
    actualIndependentStorageVerified: false,
    ownerRetentionDecisionGranted: false,
    automaticCustodyRenewal: false,
  };
}

export function triageOwnerSlaExpiry(ledger, now = Date.now()) {
  verifyRegistrationLedger(ledger, { now });
  const grouped = new Map();
  for (const entry of ledger.filter(
    (row) => row.kind === "VERIFIED_OWNER_SLA_DECISION",
  )) {
    if (
      !COMMIT.test(entry.sourceIdentity?.commit ?? "") ||
      !/^[0-9a-f-]{36}$/.test(entry.sourceIdentity?.nonce ?? "") ||
      ![
        "ACCEPT_MONITORING_SLA",
        "DEFER_MONITORING_SLA",
        "REJECT_MONITORING_SLA",
      ].includes(entry.decision)
    )
      throw new Error("INVALID_OWNER_SLA_SOURCE_REFERENCE");
    const key = `${entry.sourceIdentity.commit}:${entry.sourceDigest}`;
    const items = grouped.get(key) ?? [];
    items.push(entry);
    grouped.set(key, items);
  }
  const decisions = [...grouped.values()]
    .map((entries) => {
      const kinds = new Set(entries.map((entry) => entry.decision));
      const nonces = new Set(
        entries.map((entry) => entry.sourceIdentity.nonce),
      );
      const expired = entries.filter((entry) => date(entry.expiresAt) <= now);
      const due = entries.filter(
        (entry) =>
          date(entry.expiresAt) > now &&
          date(entry.expiresAt) <= now + 14 * DAY,
      );
      const state =
        kinds.size > 1 || nonces.size < entries.length
          ? "CONFLICTING_OR_REPLAYED_OWNER_DECISIONS_REVIEW_REQUIRED"
          : expired.length
            ? "OWNER_SIGNED_RECEIPT_EXPIRED_RENEWAL_REQUIRED"
            : due.length
              ? "OWNER_SLA_RECEIPT_EXPIRES_WITHIN_14_DAYS"
              : "SIGNED_DECISION_CURRENT_NOT_RELEASE_AUTHORITY";
      return {
        commit: entries[0].sourceIdentity.commit,
        evidenceDigest: entries[0].sourceDigest,
        registrationSequences: entries.map((entry) => entry.sequence),
        signedDecisions: [...kinds].sort(),
        expiredReceipts: expired.length,
        expiringReceipts: due.length,
        state,
        automaticSupersession: false,
      };
    })
    .sort((a, b) => a.commit.localeCompare(b.commit));
  return {
    schema: "icamp.build215.owner-sla-expiry-escalation.v1",
    decisions,
    ownerActionsDue: decisions.filter(
      (row) => row.state !== "SIGNED_DECISION_CURRENT_NOT_RELEASE_AUTHORITY",
    ).length,
    automaticSlaAcceptance: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function analyzeBuild215Ci(build214) {
  return {
    schema: "icamp.build215.private-custody-readback-handoff.v1",
    state: "PRIVATE_LEDGER_NOT_IMPORTED_IN_CI_EXTERNAL_ANCHOR_PENDING",
    originalArtifactAlerts: build214?.aging?.alerts?.length ?? null,
    ownerSignedAnchorVerifiedInCI: false,
    multiCustodianIndependentStorageVerifiedInCI: false,
    ownerSlaExpiryIndependentlyReviewedInCI: false,
    privateKeysOrLedgerImportedIntoCI: false,
    protectedGateChanges: false,
    releaseApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(args) {
  const [command, ...values] = args;
  if (
    command === "prepare-anchor" &&
    values.length === 4 &&
    values[3] === "--confirm-reviewed-head"
  ) {
    const [ledgerPath, keyId, outputPath] = values;
    const ledger = await readExternalRegistrationLedger(ledgerPath);
    await requireExternalOutput(outputPath);
    await writeFile(
      outputPath,
      `${JSON.stringify(prepareAnchorClaims(ledger, { keyId }), null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Unsigned independent anchor request saved. No signature or owner authority created.",
    );
    return;
  }
  if (command === "verify-anchor" && values.length === 4) {
    const [ledgerPath, claimsPath, attestationPath, pinsPath] = values;
    const [ledger, claims, attestation, pins] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(claimsPath),
      json(attestationPath),
      json(pinsPath),
    ]);
    console.log(
      JSON.stringify(
        verifyIndependentAnchor({ ledger, claims, attestation, pins }),
      ),
    );
    return;
  }
  if (
    command === "sign-anchor" &&
    values.length === 5 &&
    values[4] === "--confirm-independent-review"
  ) {
    const [ledgerPath, claimsPath, privateKeyPath, outputPath] = values;
    if (!isAbsolute(privateKeyPath) || insideSource(resolve(privateKeyPath)))
      throw new Error(
        "PRIVATE_ANCHOR_KEY_AND_RECEIPT_MUST_BE_OUTSIDE_REPOSITORY",
      );
    await requireExternalOutput(outputPath);
    const keyInfo = await lstat(privateKeyPath);
    if (!keyInfo.isFile())
      throw new Error("PRIVATE_ANCHOR_KEY_MUST_BE_REGULAR_FILE");
    if (insideSource(await realpath(privateKeyPath)))
      throw new Error("PRIVATE_ANCHOR_KEY_RESOLVES_INSIDE_REPOSITORY");
    const [ledger, claims, privateKeyPem] = await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      json(claimsPath),
      readFile(privateKeyPath, "utf8"),
    ]);
    await writeFile(
      outputPath,
      `${JSON.stringify(signAnchorClaims({ ledger, claims, privateKeyPem }), null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Signed anchor created outside repository; independent reviewer and public pin must still be verified.",
    );
    return;
  }
  if (command === "triage" && (values.length === 1 || values.length === 4)) {
    const [ledgerPath, claimsPath, attestationPath, pinsPath] = values;
    const ledger = await readExternalRegistrationLedger(ledgerPath);
    const anchor = claimsPath
      ? verifyIndependentAnchor({
          ledger,
          claims: await json(claimsPath),
          attestation: await json(attestationPath),
          pins: await json(pinsPath),
        })
      : { state: "NO_INDEPENDENTLY_SIGNED_ANCHOR_SUPPLIED" };
    console.log(
      JSON.stringify({
        schema: "icamp.build215.private-owner-review-report.v1",
        anchor,
        custody: triageCustodianRenewals(ledger),
        ownerSla: triageOwnerSlaExpiry(ledger),
        approvalGranted: false,
      }),
    );
    return;
  }
  throw new Error(
    "USAGE: prepare-anchor <absolute-private-ledger> <reviewer-key-id> <absolute-private-request.json> --confirm-reviewed-head; sign-anchor <ledger> <claims.json> <absolute-private-key.pem> <absolute-signature.json> --confirm-independent-review; verify-anchor <ledger> <claims.json> <signature.json> <reviewer-pins.json>; triage <ledger> [claims.json signature.json reviewer-pins.json]",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD215_REVIEW_FAILED",
    );
    process.exitCode = 1;
  });
}
