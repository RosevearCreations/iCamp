import { retestQl253ImmutablePublication } from "./ql253-immutable-public-retest.mjs";

// This is a public GitHub-only observation. Private registry, owner identity
// and 24/7 relay are separate unverified gates, never inferred from HTTP 200.
export async function refreshQl254OriginalSourceEvidence(
  { sourceShaA, sourceCiRunUrl, proofCommitShaB },
  fetchPublic = fetch,
) {
  const observed = await retestQl253ImmutablePublication(
    { sourceShaA, sourceCiRunUrl, proofCommitShaB },
    fetchPublic,
  );
  const validB =
    observed.cryptographic_signature_valid &&
    observed.proof_ancestor_verified &&
    observed.proof_B_ancestor_of_current_main;
  const published =
    observed.immutable_main_public_proof_http_status === 200 && validB;
  return {
    application_name: "iCamp",
    repository: "RosevearCreations/iCamp",
    current_main_sha: observed.current_main_sha,
    source_sha_A: observed.source_ci_independently_matched
      ? sourceShaA
      : "NOT_AVAILABLE",
    source_ci_run_url: observed.source_ci_independently_matched
      ? sourceCiRunUrl
      : "NOT_AVAILABLE",
    proof_commit_sha_B: published ? proofCommitShaB : "NOT_AVAILABLE",
    immutable_public_proof_url:
      observed.immutable_main_public_proof_http_status === 404
        ? "HTTP 404"
        : published
          ? observed.immutable_public_proof_url
          : "NOT_AVAILABLE",
    exact_proof_bytes_sha256: published
      ? observed.exact_proof_bytes_sha256
      : "NOT_AVAILABLE",
    public_spki_sha256: published
      ? `${observed.public_spki_sha256} / UNTRUSTED`
      : "NOT_AVAILABLE",
    out_of_band_registry_snapshot_sha256: "NOT_AVAILABLE",
    out_of_band_registry_receipt_id: "NOT_AVAILABLE",
    out_of_band_custody_receipt_id: "NOT_AVAILABLE",
    distinct_independent_witness_receipt_id: "NOT_AVAILABLE",
    owner_test_decision: "NOT_GIVEN",
    owner_test_receipt_id: "NOT_AVAILABLE",
    real_health_and_capabilities_get_receipts: "NOT_RUN",
    original_seven_negative_denial_receipts: "NOT_VERIFIED",
    connection_state: "DISCONNECTED",
    gate_state: "HOLD",
    relay_readiness: "NOT_CONFIGURED",
    relay_running: false,
    source_audit_status: observed.ql253_status,
    public_signature_candidate_valid: !!validB,
    private_registry_independently_verified: false,
    owner_test_authorized: false,
  };
}
