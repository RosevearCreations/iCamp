import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  verifyICampShellGet,
  PATHS,
  CONTRACT,
} from "../lib/integration-v1/ql335-shell.mjs";

const issuer = generateKeyPairSync("ed25519");
const source = generateKeyPairSync("ed25519");
const now = Date.now();
const hex = "a".repeat(64);
const workloadId = "12345678-1234-4234-8234-123456789abc";
const canonical = (value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    : JSON.stringify(value);
const trust = {
  originalSourceOwnerTest: true,
  originalMasterOwnerTest: true,
  verifiedWorkload: true,
  verifiedIssuer: true,
  manifestVerified: true,
  keyHandleActive: true,
  pinnedOriginVerified: true,
  manifestSha256: hex,
  ownerReceiptSha256: hex,
  sourceOwnerReceiptSha256: hex,
  workloadId,
  brokerKeyId: "broker-test-key-2026",
  pinnedBrokerPublicKeyPem: issuer.publicKey.export({
    type: "spki",
    format: "pem",
  }),
};
function options(path = PATHS[0]) {
  const challenge = {
    status: "SHELL_TEST_CHALLENGE",
    contract: CONTRACT,
    shell_id: "icamp",
    source_app_id: "icamp",
    environment: "nonproduction",
    method: "GET",
    path,
    issuer: "ai-data-platform",
    audience: "icamp",
    scope: path.endsWith("/health")
      ? "read_shell_health"
      : "read_shell_capabilities",
    nonce: "a".repeat(43),
    issued_at: now,
    expires_at: now + 90_000,
    manifest_sha256: hex,
    owner_receipt_sha256: hex,
    source_owner_receipt_sha256: hex,
    workload_id: workloadId,
  };
  const envelope = {
    challenge,
    keyId: "broker-test-key-2026",
    signature: sign(
      null,
      Buffer.from(canonical(challenge)),
      issuer.privateKey,
    ).toString("base64url"),
  };
  return {
    method: "GET",
    path,
    query: {},
    headers: {
      "x-rosevear-shell-envelope": Buffer.from(
        JSON.stringify(envelope),
      ).toString("base64url"),
    },
    runtime: "nonproduction",
    nowMs: now,
    trust,
    claimNonce: async () => true,
    signWithSourceKms: async (data) => ({
      attested: true,
      keyId: "source-test-key-2026",
      signature: sign(null, data, source.privateKey).toString("base64url"),
    }),
  };
}
test("iCamp shell signs both GET receipts without campground identifiers", async () => {
  for (const path of PATHS) {
    const result = await verifyICampShellGet(options(path));
    assert.equal(result.httpStatus, 200);
    assert.equal(result.envelope.receipt.source_app_id, "icamp");
    assert.equal(result.envelope.receipt.tenant_data_included, false);
    assert.equal(result.connected, false);
  }
});
test("iCamp shell fails closed for untrusted workload, campgrounds, replay and production", async () => {
  const base = options();
  assert.equal(
    (await verifyICampShellGet({ ...base, trust: undefined })).httpStatus,
    503,
  );
  assert.equal(
    (await verifyICampShellGet({ ...base, runtime: "production" }))
      .authenticated,
    false,
  );
  assert.equal(
    (await verifyICampShellGet({ ...base, query: { campground: "sample" } }))
      .authenticated,
    false,
  );
  assert.equal(
    (await verifyICampShellGet({ ...base, claimNonce: async () => false }))
      .httpStatus,
    409,
  );
  const changed = options();
  const envelope = JSON.parse(
    Buffer.from(changed.headers["x-rosevear-shell-envelope"], "base64url"),
  );
  envelope.challenge.tenant_id = workloadId;
  changed.headers["x-rosevear-shell-envelope"] = Buffer.from(
    JSON.stringify(envelope),
  ).toString("base64url");
  assert.equal((await verifyICampShellGet(changed)).authenticated, false);
});
