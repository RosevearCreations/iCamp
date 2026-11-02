import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import {
  canonicalQl246Payload,
  QL246_NEGATIVE_TESTS,
} from "./ql246-source-proof.mjs";

const repository = "RosevearCreations/iCamp";
const sha40 = /^[a-f0-9]{40}$/;
const ciPattern =
  /^https:\/\/github\.com\/RosevearCreations\/iCamp\/actions\/runs\/([0-9]{1,20})$/;
const proofPath = "docs/integration/ql246-source-proof.json";
const nonsecretId = /^np-[A-Za-z0-9._:-]{5,157}$/;
const hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function holdResult(fields = {}) {
  return {
    application_name: "iCamp",
    repository,
    source_sha_A: "NOT_AVAILABLE",
    source_ci_run_url: "NOT_AVAILABLE",
    proof_commit_sha_B: "NOT_AVAILABLE",
    immutable_public_proof_url: "NOT_AVAILABLE",
    exact_proof_bytes_sha256: "NOT_AVAILABLE",
    public_spki_sha256: "NOT_AVAILABLE",
    out_of_band_custody_receipt_id: "NOT_AVAILABLE",
    distinct_witness_receipt_id: "NOT_AVAILABLE",
    owner_test_decision: "NOT_GIVEN",
    owner_test_receipt_id: "NOT_AVAILABLE",
    actual_gateway_test: "NOT_RUN",
    connection_state: "DISCONNECTED",
    gate_state: "HOLD",
    status: "NOT_AVAILABLE",
    source_ci_independently_matched: false,
    proof_ancestor_verified: false,
    cryptographic_signature_valid: false,
    signer_trusted_out_of_band: false,
    seven_denials_independently_witnessed: false,
    ...fields,
  };
}

// Only immutable PUBLIC GitHub endpoints are fetched. This is never an
// authenticated GET to any application or AI gateway.
export async function inspectQl252PublicPublication(
  { sourceShaA, sourceCiRunUrl, proofCommitShaB },
  fetchPublic = fetch,
) {
  if (!sha40.test(sourceShaA ?? "") || !ciPattern.test(sourceCiRunUrl ?? ""))
    throw new Error(
      "Exact 40-character source A and iCamp GitHub Actions URL required.",
    );
  if (
    proofCommitShaB &&
    (!sha40.test(proofCommitShaB) || proofCommitShaB === sourceShaA)
  )
    throw new Error(
      "Proof B must be a separate full 40-character commit descendant of A.",
    );
  const runId = ciPattern.exec(sourceCiRunUrl)[1];
  const result = holdResult({
    source_sha_A: sourceShaA,
    source_ci_run_url: sourceCiRunUrl,
  });
  const load = async (url) => {
    const response = await fetchPublic(url, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (response.status === 404) return { status: 404 };
    if (!response.ok)
      throw new Error(`Public GitHub response ${response.status}.`);
    return response;
  };
  const sourceRun = await load(
    `https://api.github.com/repos/${repository}/actions/runs/${runId}`,
  );
  if (sourceRun.status === 404)
    return { ...result, status: "SOURCE_CI_NOT_AVAILABLE" };
  const ci = await sourceRun.json();
  if (ci.head_sha !== sourceShaA || ci.conclusion !== "success")
    return { ...result, status: "SOURCE_CI_UNVERIFIED" };
  result.source_ci_independently_matched = true;

  // If B is absent, inspect the immutable tested A only for honest 404
  // evidence, but NEVER mislabel A as the later proof commit.
  const inspectedSha = proofCommitShaB ?? sourceShaA;
  const rawUrl = `https://raw.githubusercontent.com/${repository}/${inspectedSha}/${proofPath}`;
  const raw = await load(rawUrl);
  result.observed_public_http_status = raw.status ?? 200;
  if (raw.status === 404) return { ...result, status: "PUBLIC_PROOF_404" };
  if (!proofCommitShaB) return { ...result, status: "PROOF_B_NOT_IDENTIFIED" };

  const bytes = Buffer.from(await raw.arrayBuffer());
  if (bytes.byteLength > 65536) throw new Error("Public proof exceeds 64 KiB.");
  result.proof_commit_sha_B = proofCommitShaB;
  result.immutable_public_proof_url = rawUrl;
  result.exact_proof_bytes_sha256 = hex(bytes);
  let envelope;
  try {
    envelope = JSON.parse(bytes.toString("utf8"));
    if (!same(Object.keys(envelope), ["publicKeyPem", "payload", "signature"]))
      throw new Error("QL-246 envelope keys incorrect.");
    const payload = envelope.payload;
    const canonical = canonicalQl246Payload(payload);
    if (
      payload.schema_version !== "rosevear.integration.v1" ||
      payload.repository !== repository ||
      payload.source_system !== "icamp" ||
      payload.business_id !== "icamp" ||
      !nonsecretId.test(payload.challenge_id ?? "") ||
      !nonsecretId.test(payload.tenant_id ?? "") ||
      !/^[a-f0-9]{64}$/.test(payload.challenge_sha256 ?? "") ||
      [
        "gateway_audit_receipt_id",
        "health_receipt_id",
        "capabilities_receipt_id",
        "registered_key_id",
      ].some(
        (field) =>
          payload[field] !== null && !nonsecretId.test(payload[field] ?? ""),
      ) ||
      payload.source_revision !== sourceShaA ||
      payload.ci_run_url !== sourceCiRunUrl ||
      payload.environment !== "nonproduction" ||
      !same(payload.allowed_methods, ["GET"]) ||
      !same(payload.allowed_paths, [
        "/api/integration/v1/health",
        "/api/integration/v1/capabilities",
      ]) ||
      !same(Object.keys(payload.negative_tests ?? {}), QL246_NEGATIVE_TESTS) ||
      QL246_NEGATIVE_TESTS.some(
        (key) => typeof payload.negative_tests[key] !== "boolean",
      ) ||
      payload.owner_authorization !== "NOT_GIVEN" ||
      payload.connection_state !== "DISCONNECTED" ||
      payload.external_gateway_get_verified !== false ||
      payload.durable_audit_verified !== false ||
      payload.owner_identity_verified !== false ||
      !Number.isSafeInteger(payload.issued_at) ||
      !Number.isSafeInteger(payload.expires_at) ||
      payload.expires_at <= payload.issued_at ||
      payload.expires_at > payload.issued_at + 3600000
    )
      throw new Error(
        "QL-246 signed source payload metadata mismatched or unsafe.",
      );
    const publicKey = createPublicKey(envelope.publicKeyPem);
    if (
      publicKey.asymmetricKeyType !== "ed25519" ||
      typeof envelope.signature !== "string" ||
      !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature) ||
      !verifySignature(
        null,
        canonical,
        publicKey,
        Buffer.from(envelope.signature, "base64url"),
      )
    )
      throw new Error("Ed25519 signature mismatch.");
    result.public_spki_sha256 = hex(
      publicKey.export({ type: "spki", format: "der" }),
    );
    result.cryptographic_signature_valid = true;
    result.challenge_expired_or_future =
      payload.issued_at > Date.now() || payload.expires_at <= Date.now();
  } catch {
    return { ...result, status: "PUBLIC_PROOF_INVALID_OR_UNVERIFIED" };
  }

  const comparison = await load(
    `https://api.github.com/repos/${repository}/compare/${sourceShaA}...${proofCommitShaB}`,
  );
  if (comparison.status !== 404) {
    const ancestry = await comparison.json();
    result.proof_ancestor_verified =
      ancestry.status === "ahead" &&
      ancestry.merge_base_commit?.sha === sourceShaA &&
      ancestry.ahead_by > 0;
  }
  result.status = result.challenge_expired_or_future
    ? "PUBLIC_PROOF_CHALLENGE_EXPIRED_OR_FUTURE_HOLD"
    : result.proof_ancestor_verified
      ? "PUBLIC_CRYPTO_VALID_CUSTODY_UNVERIFIED_HOLD"
      : "SOURCE_PROOF_ANCESTRY_UNVERIFIED_HOLD";
  return result;
}
