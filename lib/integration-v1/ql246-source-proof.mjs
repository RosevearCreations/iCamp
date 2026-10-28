import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

// QL-246 is a strict, offline documentary gate. It does not enable a gateway.
export const QL246_FIELDS = Object.freeze([
  "schema_version",
  "source_system",
  "repository",
  "source_revision",
  "challenge_id",
  "challenge_sha256",
  "business_id",
  "tenant_id",
  "environment",
  "ci_run_url",
  "allowed_methods",
  "allowed_paths",
  "negative_tests",
  "gateway_audit_receipt_id",
  "health_receipt_id",
  "capabilities_receipt_id",
  "registered_key_id",
  "owner_authorization",
  "connection_state",
  "external_gateway_get_verified",
  "durable_audit_verified",
  "owner_identity_verified",
  "issued_at",
  "expires_at",
]);
export const QL246_NEGATIVE_TESTS = Object.freeze([
  "nonce_replay_denied",
  "stale_request_denied",
  "cross_business_denied",
  "cross_tenant_denied",
  "revoked_key_denied",
  "write_denied",
  "dispatch_denied",
]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const same = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

export function canonicalQl246Payload(payload) {
  if (
    !payload ||
    Object.keys(payload).length !== QL246_FIELDS.length ||
    !same(Object.keys(payload), QL246_FIELDS)
  )
    throw new Error(
      "QL-246 payload must use the exact 24 canonical ordered fields.",
    );
  return Buffer.from(
    QL246_FIELDS.map((field) => JSON.stringify([field, payload[field]])).join(
      "\n",
    ),
    "utf8",
  );
}

export function assessQl246SourceProof(
  rawJsonBytes,
  trusted = {},
  now = Date.now(),
) {
  const issues = [];
  let packet;
  let payloadBytes;
  try {
    packet = JSON.parse(Buffer.from(rawJsonBytes).toString("utf8"));
    if (!same(Object.keys(packet), ["publicKeyPem", "payload", "signature"]))
      throw new Error("Exactly three ordered envelope keys are required.");
    payloadBytes = canonicalQl246Payload(packet.payload);
  } catch (error) {
    return {
      status: "PENDING_BLOCKED",
      issues: [error.message],
      rawSha256: sha256(rawJsonBytes),
    };
  }
  const p = packet.payload;
  if (
    p.schema_version !== "rosevear.integration.v1" ||
    p.source_system !== "icamp" ||
    p.repository !== "RosevearCreations/iCamp" ||
    p.business_id !== "icamp"
  )
    issues.push("iCamp source identity or version differs from QL-246.");
  if (
    !/^[a-f0-9]{40}$/.test(p.source_revision) ||
    !/^[a-f0-9]{40}$/.test(trusted.sourceRevision ?? "") ||
    p.source_revision !== trusted.sourceRevision
  )
    issues.push(
      "Source revision is not independently pinned to an immutable iCamp code commit.",
    );
  if (
    !/^np-[A-Za-z0-9._:-]{5,157}$/.test(p.tenant_id ?? "") ||
    p.tenant_id !== trusted.tenantId
  )
    issues.push("iCamp tenant identity has not been independently confirmed.");
  if (
    !/^np-[A-Za-z0-9._:-]{5,157}$/.test(p.challenge_id ?? "") ||
    p.challenge_id !== trusted.challengeId ||
    !/^[a-f0-9]{64}$/.test(p.challenge_sha256 ?? "") ||
    p.challenge_sha256 !== trusted.challengeSha256
  )
    issues.push(
      "Original operator challenge identity/digest is missing or mismatched.",
    );
  if (
    p.environment !== "nonproduction" ||
    !same(p.allowed_methods, ["GET"]) ||
    !same(p.allowed_paths, [
      "/api/integration/v1/health",
      "/api/integration/v1/capabilities",
    ])
  )
    issues.push(
      "Only two nonproduction read-only health/capabilities GET routes are permitted.",
    );
  if (
    !/^https:\/\/github\.com\/RosevearCreations\/iCamp\/actions\/runs\/[0-9]{1,20}$/.test(
      p.ci_run_url ?? "",
    ) ||
    p.ci_run_url !== trusted.ciRunUrl
  )
    issues.push(
      "A real independently verified GitHub Actions run is required.",
    );
  if (
    !p.negative_tests ||
    !same(Object.keys(p.negative_tests), QL246_NEGATIVE_TESTS) ||
    QL246_NEGATIVE_TESTS.some((key) => p.negative_tests[key] !== true) ||
    trusted.sevenDenialsIndependentlyWitnessed !== true
  )
    issues.push(
      "All seven negative denials require real independent observation, not a local test fixture.",
    );
  for (const key of [
    "gateway_audit_receipt_id",
    "health_receipt_id",
    "capabilities_receipt_id",
    "registered_key_id",
  ])
    if (p[key] !== null && !/^np-[A-Za-z0-9._:-]{5,157}$/.test(p[key] ?? ""))
      issues.push(`Invalid nonsecret ${key}.`);
  if (
    p.owner_authorization !== "NOT_GIVEN" ||
    p.connection_state !== "DISCONNECTED" ||
    p.external_gateway_get_verified !== false ||
    p.durable_audit_verified !== false ||
    p.owner_identity_verified !== false
  )
    issues.push(
      "QL-246 is DISCONNECTED with no owner authorization or gateway acceptance.",
    );
  if (
    !Number.isSafeInteger(p.issued_at) ||
    !Number.isSafeInteger(p.expires_at) ||
    p.expires_at <= p.issued_at ||
    p.expires_at > p.issued_at + 3600000 ||
    p.issued_at > now ||
    p.expires_at <= now
  )
    issues.push(
      "Source proof must be freshly issued and expire within one hour.",
    );
  try {
    const key = createPublicKey(packet.publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519")
      throw new Error("Not an Ed25519 key.");
    const fingerprint = sha256(key.export({ format: "der", type: "spki" }));
    if (
      !/^[a-f0-9]{64}$/.test(trusted.outOfBandPublicSpkiSha256 ?? "") ||
      fingerprint !== trusted.outOfBandPublicSpkiSha256
    )
      issues.push(
        "Public signing key is not pinned by a separate authenticated channel.",
      );
    const signature = packet.signature;
    if (
      typeof signature !== "string" ||
      !/^[A-Za-z0-9_-]{86}$/.test(signature) ||
      !verifySignature(
        null,
        payloadBytes,
        key,
        Buffer.from(signature, "base64url"),
      )
    )
      issues.push("Ed25519 detached signature is absent or invalid.");
  } catch {
    issues.push("Ed25519 public key or signature verification failed.");
  }
  return {
    status: issues.length
      ? "PENDING_BLOCKED"
      : "SOURCE_METADATA_MATCHED_GATEWAY_HOLD",
    issues,
    rawSha256: sha256(rawJsonBytes),
    connectionState: "DISCONNECTED",
    gateState: "HOLD",
    ownerAuthorization: "NOT_GIVEN",
  };
}
