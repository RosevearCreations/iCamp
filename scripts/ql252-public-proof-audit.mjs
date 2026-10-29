import { inspectQl252PublicPublication } from "../lib/integration-v1/ql252-public-proof-audit.mjs";

const options = new Map();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--public-get") options.set("public-get", true);
  else if (
    ["--source-sha-A", "--source-ci-run-url", "--proof-commit-sha-B"].includes(
      args[i],
    )
  ) {
    if (!args[i + 1]) throw new Error(`Missing ${args[i]} value.`);
    options.set(args[i++], args[i]);
  } else throw new Error(`Unknown QL-252 argument: ${args[i]}`);
}

// No network is permitted without the explicit --public-get flag.
if (!options.get("public-get")) {
  process.stdout.write(
    JSON.stringify(
      {
        status: "NOT_AVAILABLE",
        actual_gateway_test: "NOT_RUN",
        connection_state: "DISCONNECTED",
        instruction:
          "Explicit --public-get with immutable source A and original CI is required; no gateway traffic.",
      },
      null,
      2,
    ) + "\n",
  );
} else {
  const report = await inspectQl252PublicPublication({
    sourceShaA: options.get("--source-sha-A"),
    sourceCiRunUrl: options.get("--source-ci-run-url"),
    proofCommitShaB: options.get("--proof-commit-sha-B"),
  });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
