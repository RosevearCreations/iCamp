import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { CONTRACT, PATHS, verifyICampShellGet } from "./ql335-shell.mjs";

const canonical = (value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    : JSON.stringify(value);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sampleDigest = sha("build202:synthetic-fixture-only");

/** This is *only* local ephemeral cryptographic fixture code. It has no
 * hosted registry read, source-owned KMS, owner approval, or HTTP request. */
export async function runBuild202ScopedTestWitness() {
  const broker = generateKeyPairSync("ed25519");
  const source = generateKeyPairSync("ed25519");
  const seen = new Set();
  const now = Date.now();
  const trust = {
    originalSourceOwnerTest: true,
    originalMasterOwnerTest: true,
    verifiedWorkload: true,
    verifiedIssuer: true,
    manifestVerified: true,
    keyHandleActive: true,
    pinnedOriginVerified: true,
    manifestSha256: sampleDigest,
    ownerReceiptSha256: sampleDigest,
    sourceOwnerReceiptSha256: sampleDigest,
    workloadId: "12345678-1234-4234-8234-123456789abc",
    brokerKeyId: "synthetic-broker-key-2026",
    pinnedBrokerPublicKeyPem: broker.publicKey.export({
      type: "spki",
      format: "pem",
    }),
  };
  const claimNonce = async ({ nonceSha256 }) => {
    if (seen.has(nonceSha256)) return false;
    seen.add(nonceSha256);
    return true;
  };
  const signWithSourceKms = async (data) => ({
    attested: true,
    keyId: "synthetic-source-key-2026",
    signature: sign(null, data, source.privateKey).toString("base64url"),
  });
  function fixture(path = PATHS[0], overrides = {}) {
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
      nonce: randomBytes(32).toString("base64url"),
      issued_at: now,
      expires_at: now + 60_000,
      manifest_sha256: sampleDigest,
      owner_receipt_sha256: sampleDigest,
      source_owner_receipt_sha256: sampleDigest,
      workload_id: trust.workloadId,
      ...overrides,
    };
    const envelope = {
      challenge,
      keyId: trust.brokerKeyId,
      signature: sign(
        null,
        Buffer.from(canonical(challenge)),
        broker.privateKey,
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
      claimNonce,
      signWithSourceKms,
    };
  }
  const health = fixture(PATHS[0]);
  const capability = fixture(PATHS[1]);
  const approvedHealth = await verifyICampShellGet(health);
  const approvedCapability = await verifyICampShellGet(capability);
  const repeated = await verifyICampShellGet(health);
  const deniedIssuer = await verifyICampShellGet(
    fixture(PATHS[0], { issuer: "rosevear-comms-hub" }),
  );
  const deniedQuery = await verifyICampShellGet({
    ...fixture(),
    query: { campground: "sample" },
  });
  const deniedProduction = await verifyICampShellGet({
    ...fixture(),
    runtime: "production",
  });
  const deniedNoAuthority = await verifyICampShellGet({
    ...fixture(),
    trust: undefined,
  });
  const deniedNoKms = await verifyICampShellGet({
    ...fixture(),
    signWithSourceKms: undefined,
  });
  return Object.freeze({
    schema: "icamp.build202.synthetic-test-witness.v1",
    evidence_class: "EPHEMERAL_LOCAL_FIXTURE_NOT_EXTERNAL_AUTHORITY",
    contract: CONTRACT,
    signed_health_fixture:
      approvedHealth.authenticated && !approvedHealth.connected
        ? "PASS"
        : "FAIL",
    signed_capabilities_fixture:
      approvedCapability.authenticated && !approvedCapability.connected
        ? "PASS"
        : "FAIL",
    nonce_replay_denied: repeated.httpStatus === 409 ? "PASS" : "FAIL",
    wrong_issuer_denied: deniedIssuer.authenticated === false ? "PASS" : "FAIL",
    tenant_query_denied: deniedQuery.authenticated === false ? "PASS" : "FAIL",
    production_denied:
      deniedProduction.authenticated === false ? "PASS" : "FAIL",
    missing_authority_denied:
      deniedNoAuthority.authenticated === false ? "PASS" : "FAIL",
    missing_kms_denied: deniedNoKms.authenticated === false ? "PASS" : "FAIL",
    external_source_signer_verified: false,
    original_owner_approval_verified: false,
    hosted_nonce_replay_database_tested: false,
    live_handshake_attempted: false,
    external_requests_or_writes: false,
    private_connection_active: false,
    connection_state: "DISCONNECTED / HOLD",
    go_live_decision: "NO_GO_PENDING_EVIDENCE",
    fixture_receipt_sha256: sha(
      canonical(approvedHealth.envelope?.receipt ?? {}),
    ),
  });
}
