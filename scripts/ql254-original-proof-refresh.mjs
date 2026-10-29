import { refreshQl254OriginalSourceEvidence } from "../lib/integration-v1/ql254-original-proof-refresh.mjs";

const options = new Map();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--public-get") options.set("--public-get", true);
  else if (
    ["--source-sha-A", "--source-ci-run-url", "--proof-commit-sha-B"].includes(
      args[i],
    )
  ) {
    if (!args[i + 1]) throw new Error(`Missing ${args[i]} value.`);
    options.set(args[i++], args[i]);
  } else throw new Error(`Unknown QL-254 argument: ${args[i]}`);
}
if (!options.get("--public-get")) {
  process.stdout.write(
    JSON.stringify(
      {
        status: "NOT_AVAILABLE",
        instruction:
          "No network without --public-get; only public GitHub endpoints are allowed.",
        owner_test_decision: "NOT_GIVEN",
        real_health_and_capabilities_get_receipts: "NOT_RUN",
        connection_state: "DISCONNECTED",
        gate_state: "HOLD",
        relay_running: false,
      },
      null,
      2,
    ) + "\n",
  );
} else {
  try {
    const result = await refreshQl254OriginalSourceEvidence({
      sourceShaA: options.get("--source-sha-A"),
      sourceCiRunUrl: options.get("--source-ci-run-url"),
      proofCommitShaB: options.get("--proof-commit-sha-B"),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    process.stdout.write(
      JSON.stringify(
        {
          status: "PUBLIC_GITHUB_RETEST_UNAVAILABLE_HOLD",
          reason:
            error instanceof Error
              ? error.message
              : "Public source unavailable",
          proof_commit_sha_B: "NOT_AVAILABLE",
          owner_test_decision: "NOT_GIVEN",
          real_health_and_capabilities_get_receipts: "NOT_RUN",
          connection_state: "DISCONNECTED",
          gate_state: "HOLD",
          relay_running: false,
        },
        null,
        2,
      ) + "\n",
    );
    process.exitCode = 1;
  }
}
