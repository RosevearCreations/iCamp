import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_SCHEMA = "icamp.build211.runner-artifact-sla.v1";
const REQUEST_SCHEMA = "icamp.build212.sla-owner-request.v1";
const RECEIPT_SCHEMA = "icamp.build212.sla-owner-receipt.v1";
const PINS_SCHEMA = "icamp.build212.sla-owner-pins.v1";
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const keyIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const noncePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RECEIPT_MAX_AGE_MS = 30 * 86_400_000;

export function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("INVALID_CANONICAL_RECEIPT_VALUE");
}

export function evidenceFingerprint(evidence) {
  if (
    evidence?.build211?.schema !== SOURCE_SCHEMA ||
    evidence.build211.ownerSla?.schema !==
      "icamp.build211.owner-sla-acceptance.v1" ||
    !sha.test(evidence.context?.commit ?? "")
  )
    throw new Error("UNTRUSTED_OR_INCOMPLETE_BUILD211_EVIDENCE");
  const important = {
    commit: evidence.context.commit,
    build211: evidence.build211,
    build210: evidence.build210?.latencyExceptions ?? null,
  };
  return `sha256:${createHash("sha256").update(canonicalJson(important)).digest("hex")}`;
}

export function slaAcceptable(evidence) {
  const ownerSla = evidence?.build211?.ownerSla;
  if (!ownerSla || ownerSla.state !== "READY_FOR_OWNER_REVIEW_NOT_APPROVED")
    return false;
  return ["PR", "MAIN"].every((stage) => {
    const row = ownerSla.stages?.[stage];
    return (
      row?.state === "REVIEWABLE_MONITORING_SAMPLES" &&
      row.completeFiveGateCohorts >= 3 &&
      row.p90Seconds <= row.monitoringBudgetSeconds
    );
  });
}

function isoTime(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) && new Date(time).toISOString() === value
    ? time
    : null;
}

export function validateOwnerRequest(request, evidence, now = Date.now()) {
  const start = isoTime(request?.createdAt);
  const expires = isoTime(request?.expiresAt);
  if (
    request?.schema !== REQUEST_SCHEMA ||
    request.repository !== "RosevearCreations/iCamp" ||
    request.purpose !== "CI_MONITORING_SLA_ONLY" ||
    ![
      "ACCEPT_MONITORING_SLA",
      "REJECT_MONITORING_SLA",
      "DEFER_MONITORING_SLA",
    ].includes(request.decision) ||
    request.stage !== "BOTH" ||
    !keyIdPattern.test(request.keyId ?? "") ||
    !noncePattern.test(request.nonce ?? "") ||
    !sha.test(request.commit ?? "") ||
    !digest.test(request.evidenceDigest ?? "") ||
    start === null ||
    expires === null ||
    expires <= start ||
    expires - start > RECEIPT_MAX_AGE_MS ||
    !Number.isFinite(now) ||
    now < start - 60_000 ||
    now >= expires ||
    request.commit !== evidence?.context?.commit ||
    request.evidenceDigest !== evidenceFingerprint(evidence) ||
    typeof request.ownerReviewNotes !== "string" ||
    request.ownerReviewNotes.length > 400 ||
    request.replacesReleaseSecurityChecks !== false ||
    request.authorizesCommsTest !== false
  ) {
    throw new Error("OWNER_REQUEST_SCOPE_OR_EVIDENCE_MISMATCH");
  }
  if (
    request.decision === "ACCEPT_MONITORING_SLA" &&
    !slaAcceptable(evidence)
  ) {
    throw new Error("INSUFFICIENT_EVIDENCE_FOR_SLA_ACCEPTANCE");
  }
  return request;
}

export function prepareOwnerRequest(
  evidence,
  {
    decision = "DEFER_MONITORING_SLA",
    keyId,
    ownerReviewNotes = "",
    now = Date.now(),
    validForDays = 7,
  } = {},
) {
  if (
    !Number.isFinite(now) ||
    !Number.isSafeInteger(validForDays) ||
    validForDays < 1 ||
    validForDays > 30
  ) {
    throw new Error("INVALID_OWNER_REQUEST_VALIDITY");
  }
  const request = {
    schema: REQUEST_SCHEMA,
    repository: "RosevearCreations/iCamp",
    purpose: "CI_MONITORING_SLA_ONLY",
    stage: "BOTH",
    decision,
    keyId,
    nonce: randomUUID(),
    commit: evidence?.context?.commit,
    evidenceDigest: evidenceFingerprint(evidence),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + validForDays * 86_400_000).toISOString(),
    ownerReviewNotes,
    replacesReleaseSecurityChecks: false,
    authorizesCommsTest: false,
  };
  return validateOwnerRequest(request, evidence, now);
}

export function publicKeyFingerprint(publicKey) {
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("OWNER_PIN_NOT_ED25519");
  return `sha256:${createHash("sha256")
    .update(key.export({ type: "spki", format: "der" }))
    .digest("hex")}`;
}

export function signOwnerRequest(
  request,
  evidence,
  privateKeyPem,
  { now = Date.now() } = {},
) {
  validateOwnerRequest(request, evidence, now);
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519")
    throw new Error("OWNER_SIGNER_NOT_ED25519");
  const message = canonicalJson({ schema: RECEIPT_SCHEMA, request });
  return {
    schema: RECEIPT_SCHEMA,
    request,
    algorithm: "Ed25519",
    signerKeyFingerprint: publicKeyFingerprint(privateKey),
    signatureBase64: sign(null, Buffer.from(message), privateKey).toString(
      "base64",
    ),
  };
}

export function verifyOwnerReceipt(
  receipt,
  evidence,
  pins,
  { now = Date.now(), consumedNonces = new Set() } = {},
) {
  if (
    receipt?.schema !== RECEIPT_SCHEMA ||
    receipt.algorithm !== "Ed25519" ||
    typeof receipt.signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64) ||
    !digest.test(receipt.signerKeyFingerprint ?? "") ||
    pins?.schema !== PINS_SCHEMA ||
    !Array.isArray(pins.signers)
  ) {
    throw new Error("INVALID_OWNER_RECEIPT_ENVELOPE");
  }
  validateOwnerRequest(receipt.request, evidence, now);
  if (consumedNonces.has(receipt.request.nonce))
    throw new Error("REPLAYED_OWNER_RECEIPT_NONCE");
  const candidates = pins.signers.filter(
    (row) => row.keyId === receipt.request.keyId,
  );
  if (candidates.length !== 1)
    throw new Error("OWNER_PUBLIC_KEY_NOT_INDEPENDENTLY_PINNED");
  const pin = candidates[0];
  if (
    pin.enabled !== true ||
    pin.role !== "ICAMP_SLA_OWNER" ||
    !digest.test(pin.fingerprint ?? "") ||
    publicKeyFingerprint(pin.publicKeyPem) !== pin.fingerprint ||
    pin.fingerprint !== receipt.signerKeyFingerprint
  ) {
    throw new Error("OWNER_SIGNER_PIN_NOT_TRUSTED");
  }
  const signature = Buffer.from(receipt.signatureBase64, "base64");
  if (
    signature.length !== 64 ||
    !verify(
      null,
      Buffer.from(
        canonicalJson({ schema: RECEIPT_SCHEMA, request: receipt.request }),
      ),
      createPublicKey(pin.publicKeyPem),
      signature,
    )
  ) {
    throw new Error("INVALID_OWNER_SIGNATURE");
  }
  consumedNonces.add(receipt.request.nonce);
  return {
    schema: "icamp.build212.verified-owner-sla-decision.v1",
    state:
      receipt.request.decision === "ACCEPT_MONITORING_SLA"
        ? "SIGNED_MONITORING_SLA_ACCEPTED_FOR_EXACT_EVIDENCE"
        : "SIGNED_MONITORING_SLA_NON_ACCEPTANCE",
    decision: receipt.request.decision,
    evidenceCommit: receipt.request.commit,
    evidenceDigest: receipt.request.evidenceDigest,
    verifiedKeyId: receipt.request.keyId,
    verifiedPinFingerprint: receipt.signerKeyFingerprint,
    scope: receipt.request.purpose,
    ownerSignatureCryptographicallyVerified: true,
    acceptedByOwner: receipt.request.decision === "ACCEPT_MONITORING_SLA",
    releaseChecksBypassed: false,
    productionApprovalGranted: false,
    commsTestHandshakeAuthorized: false,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeNewJson(path, document) {
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}

async function main(args) {
  const [command, ...values] = args;
  if (command === "prepare" && values.length === 5) {
    const [evidencePath, decision, keyId, notes, outputPath] = values;
    const evidence = await readJson(evidencePath);
    await writeNewJson(
      outputPath,
      prepareOwnerRequest(evidence, {
        decision,
        keyId,
        ownerReviewNotes: notes,
      }),
    );
    console.log(
      "Unsigned SLA review request written. Owner signature is NOT present.",
    );
    return;
  }
  if (
    command === "sign" &&
    values.length === 5 &&
    values[4] === "--confirm-owner-review"
  ) {
    const [requestPath, evidencePath, privateKeyPath, outputPath] = values;
    if (
      !isAbsolute(privateKeyPath) ||
      resolve(privateKeyPath).startsWith(`${resolve(process.cwd())}${sep}`)
    ) {
      throw new Error("OWNER_PRIVATE_KEY_MUST_BE_OUTSIDE_REPOSITORY");
    }
    const request = await readJson(requestPath);
    const evidence = await readJson(evidencePath);
    const privateKeyPem = await readFile(privateKeyPath, "utf8");
    await writeNewJson(
      outputPath,
      signOwnerRequest(request, evidence, privateKeyPem),
    );
    console.log(
      "Signed SLA receipt created locally; no key was exported or uploaded.",
    );
    return;
  }
  if (command === "verify" && values.length === 3) {
    const [receiptPath, evidencePath, ownerPinsPath] = values;
    const result = verifyOwnerReceipt(
      await readJson(receiptPath),
      await readJson(evidencePath),
      await readJson(ownerPinsPath),
    );
    console.log(JSON.stringify(result));
    return;
  }
  throw new Error(
    "USAGE: prepare <evidence.json> <DEFER_MONITORING_SLA|REJECT_MONITORING_SLA|ACCEPT_MONITORING_SLA> <keyId> <notes> <request.json>; sign <request.json> <evidence.json> <absolute-outside-repo-private.pem> <receipt.json> --confirm-owner-review; verify <receipt.json> <evidence.json> <owner-pins.json>",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "OWNER_SLA_RECEIPT_ERROR",
    );
    process.exitCode = 1;
  });
}
