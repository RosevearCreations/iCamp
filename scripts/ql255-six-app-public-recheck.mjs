import { recheckQl255SixAppPublicOrigins } from "../lib/integration-v1/ql255-six-app-public-recheck.mjs";

if (!process.argv.slice(2).includes("--public-get")) {
  process.stdout.write(
    JSON.stringify(
      {
        status: "NOT_RUN",
        explanation:
          "Zero network requests by default. --public-get permits only hardcoded public GitHub URLs.",
        owner_test_decision: "NOT_GIVEN",
        actual_gateway_test: "NOT_RUN",
        connection_state: "DISCONNECTED",
        gate_state: "HOLD",
      },
      null,
      2,
    ) + "\n",
  );
} else if (process.argv.slice(2).some((x) => x !== "--public-get")) {
  throw new Error(
    "Only --public-get is supported; no gateways, private URLs or credentials.",
  );
} else {
  const report = await recheckQl255SixAppPublicOrigins();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
