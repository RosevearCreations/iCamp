import { createHash } from "node:crypto";

// Each URL is synthesized from this hardcoded public GitHub allowlist.
// This is an origin observation, not a signed-proof, key-custody or owner gate.
export const ql255Sources = Object.freeze([
  [
    "ai-data-platform",
    "ai-data-platform",
    "9e570d82707fd476b43458fa869776bac9ddc65f",
  ],
  ["devilndove", "devilndove-site", "ae145e67d526119a90612e8e4151dc84416d1446"],
  [
    "rosiedazzlers",
    "rosiedazzlers",
    "056de275482a3b4a00e17610f634b1b79f3490c0",
  ],
  ["yw", "yw", "37cac7dc25caa153088f0b58a76df98b23539730"],
  ["icamp", "iCamp", "19db62c90a12bf48da74e4e063fb16c3b6f6c1ce"],
  [
    "rosevear-ai-hub",
    "rosevear-ai-hub",
    "d2cab6dfa98be39c8dd2775a020fe8c644768ceb",
  ],
]);

const fullSha = /^[a-f0-9]{40}$/;
const proofPath = "docs/integration/ql246-source-proof.json";

export async function recheckQl255SixAppPublicOrigins(fetchPublic = fetch) {
  const observations = await Promise.all(
    ql255Sources.map(async ([sourceSystem, repo, handoffSha]) => {
      const repository = `RosevearCreations/${repo}`;
      const base = {
        source_system: sourceSystem,
        repository,
        ql254_handoff_main_sha: handoffSha,
        observed_main_sha: "NOT_AVAILABLE",
        immutable_proof_url: "NOT_AVAILABLE",
        proof_http_status: "NOT_AVAILABLE",
        exact_raw_proof_sha256: "NOT_AVAILABLE",
        source_drift: "NOT_CHECKED",
        source_proof_disposition: "PUBLIC_ORIGIN_UNAVAILABLE_HOLD",
        private_signer_custody_verified: false,
        independent_witness_verified: false,
        owner_test_authorized: false,
        actual_gateway_test: "NOT_RUN",
        connection_state: "DISCONNECTED",
      };
      try {
        const branch = await fetchPublic(
          `https://api.github.com/repos/${repository}/branches/main`,
          {
            method: "GET",
            redirect: "error",
            headers: { Accept: "application/vnd.github+json" },
          },
        );
        if (!branch.ok)
          return {
            ...base,
            source_proof_disposition: `MAIN_HTTP_${branch.status}_HOLD`,
          };
        const observedMainSha = (await branch.json()).commit?.sha;
        if (!fullSha.test(observedMainSha ?? ""))
          return { ...base, source_proof_disposition: "MAIN_SHA_INVALID_HOLD" };
        const immutableProofUrl = `https://raw.githubusercontent.com/${repository}/${observedMainSha}/${proofPath}`;
        const publicProof = await fetchPublic(immutableProofUrl, {
          method: "GET",
          redirect: "error",
          headers: { Accept: "application/octet-stream" },
        });
        const observed = {
          ...base,
          observed_main_sha: observedMainSha,
          immutable_proof_url: immutableProofUrl,
          source_drift:
            observedMainSha === handoffSha
              ? "UNCHANGED"
              : "MAIN_ADVANCED_RECHECK_REQUIRED",
        };
        if (publicProof.status === 404)
          return {
            ...observed,
            proof_http_status: "404",
            source_proof_disposition: "ORIGINAL_SIGNED_PROOF_404_HOLD",
          };
        if (publicProof.status !== 200)
          return {
            ...observed,
            proof_http_status: String(publicProof.status || "NOT_AVAILABLE"),
            source_proof_disposition: "PUBLIC_PROOF_FETCH_EXCEPTION_HOLD",
          };
        const rawBytes = Buffer.from(await publicProof.arrayBuffer());
        let parsed;
        try {
          parsed = JSON.parse(rawBytes.toString("utf8"));
        } catch {
          parsed = null;
        }
        return {
          ...observed,
          proof_http_status: "200",
          exact_raw_proof_sha256: createHash("sha256")
            .update(rawBytes)
            .digest("hex"),
          source_proof_disposition:
            parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? "PUBLIC_JSON_CANDIDATE_UNTRUSTED_HOLD"
              : "PUBLIC_PROOF_INVALID_JSON_HOLD",
        };
      } catch {
        // A failed external public fetch is not a witnessed 404.
        return base;
      }
    }),
  );
  return {
    snapshot_reference:
      "QL-254 2026-10-29T03:42:01Z; refreshed now with public origin only",
    applications: observations,
    observed_404_count: observations.filter(
      (x) => x.proof_http_status === "404",
    ).length,
    observed_unavailable_count: observations.filter(
      (x) => x.proof_http_status === "NOT_AVAILABLE",
    ).length,
    every_application_proven_connected: false,
    owner_test_decision: "NOT_GIVEN",
    original_seven_negative_denial_receipts: "NOT_VERIFIED",
    private_relay_state: "NOT_INSTALLED",
    actual_gateway_test: "NOT_RUN",
    connection_state: "DISCONNECTED",
    gate_state: "HOLD",
  };
}
