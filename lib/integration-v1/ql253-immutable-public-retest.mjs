import { inspectQl252PublicPublication } from "./ql252-public-proof-audit.mjs";

const repository = "RosevearCreations/iCamp";
const proofPath = "docs/integration/ql246-source-proof.json";
const sha40 = /^[a-f0-9]{40}$/;

// Public-only GitHub metadata and raw immutable source reads. No gateway URLs,
// private custody witnesses, owner verification or Phase-B requests here.
export async function retestQl253ImmutablePublication(
  { sourceShaA, sourceCiRunUrl, proofCommitShaB },
  fetchPublic = fetch,
) {
  const prior = await inspectQl252PublicPublication(
    { sourceShaA, sourceCiRunUrl, proofCommitShaB },
    fetchPublic,
  );
  const branch = await fetchPublic(
    `https://api.github.com/repos/${repository}/branches/main`,
    {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/vnd.github+json" },
    },
  );
  if (!branch.ok)
    throw new Error(
      `Unable to independently read public main: HTTP ${branch.status}.`,
    );
  const ref = await branch.json();
  const mainSha = ref.commit?.sha;
  if (!sha40.test(mainSha ?? ""))
    throw new Error("Public main branch did not expose a full commit SHA.");
  const mainRawUrl = `https://raw.githubusercontent.com/${repository}/${mainSha}/${proofPath}`;
  const proof = await fetchPublic(mainRawUrl, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "application/octet-stream" },
  });
  if (proof.status !== 404 && !proof.ok)
    throw new Error(`Public immutable main proof fetch HTTP ${proof.status}.`);
  let bAncestorOfMain = false;
  if (proofCommitShaB && proofCommitShaB !== mainSha) {
    const comparison = await fetchPublic(
      `https://api.github.com/repos/${repository}/compare/${proofCommitShaB}...${mainSha}`,
      {
        method: "GET",
        redirect: "error",
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (comparison.ok) {
      const diff = await comparison.json();
      bAncestorOfMain =
        diff.status === "ahead" &&
        diff.merge_base_commit?.sha === proofCommitShaB &&
        diff.ahead_by > 0;
    } else if (comparison.status !== 404) {
      throw new Error(
        `Public proof-B ancestry response HTTP ${comparison.status}.`,
      );
    }
  } else if (proofCommitShaB === mainSha) {
    bAncestorOfMain = true;
  }
  const mainProofHttpStatus = proof.status;
  // Even a valid signed public proof is insufficient for custody/owner.
  return {
    ...prior,
    current_main_sha: mainSha,
    immutable_main_public_proof_url: mainRawUrl,
    immutable_main_public_proof_http_status: mainProofHttpStatus,
    proof_B_ancestor_of_current_main: bAncestorOfMain,
    independent_custody_nonce_witness: "NOT_AVAILABLE",
    separately_authenticated_owner_test_decision: "NOT_GIVEN",
    seven_denial_original_receipts: "NOT_AVAILABLE",
    gate_state: "HOLD",
    connection_state: "DISCONNECTED",
    actual_gateway_test: "NOT_RUN",
    ql253_status:
      mainProofHttpStatus === 404
        ? "IMMUTABLE_MAIN_PUBLIC_PROOF_404_HOLD"
        : !proofCommitShaB
          ? "PUBLIC_PROOF_B_NOT_IDENTIFIED_HOLD"
          : !bAncestorOfMain
            ? "B_NOT_ANCESTOR_OF_MAIN_HOLD"
            : `PUBLIC_CANDIDATE_${prior.status}_INDEPENDENT_OWNER_HOLD`,
  };
}
