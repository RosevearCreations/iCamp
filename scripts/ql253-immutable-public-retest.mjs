import { retestQl253ImmutablePublication } from "../lib/integration-v1/ql253-immutable-public-retest.mjs";

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
  } else throw new Error(`Unknown QL-253 argument: ${args[i]}`);
}

if (!options.get("--public-get")) {
  process.stdout.write(
    JSON.stringify(
      {
        status: "NOT_AVAILABLE",
        reason:
          "Use explicit --public-get to read public GitHub origin only; no gateway network is authorized.",
        owner_test_decision: "NOT_GIVEN",
        actual_gateway_test: "NOT_RUN",
        connection_state: "DISCONNECTED",
        gate_state: "HOLD",
      },
      null,
      2,
    ) + "\n",
  );
} else {
  const report = await retestQl253ImmutablePublication({
    sourceShaA: options.get("--source-sha-A"),
    sourceCiRunUrl: options.get("--source-ci-run-url"),
    proofCommitShaB: options.get("--proof-commit-sha-B"),
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
