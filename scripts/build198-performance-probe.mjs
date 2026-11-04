import { performance } from "node:perf_hooks";

import {
  RESILIENCE_BUDGETS,
  summarizePerformance,
} from "../lib/resilience/core.mjs";

const baseUrl = process.env.ICAMP_PROBE_BASE_URL;
if (!baseUrl) {
  throw new Error(
    "Set ICAMP_PROBE_BASE_URL to an explicit HTTP(S) app origin.",
  );
}
const origin = new URL(baseUrl);
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
) {
  throw new Error(
    "Performance probe requires a plain HTTP(S) app origin, without credentials or paths.",
  );
}

const results = {};
for (const [key, route] of [
  ["health", "/api/health"],
  ["readiness", "/api/health/ready"],
]) {
  const samples = [];
  let failures = 0;
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(route, origin), {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      await response.arrayBuffer();
      if (!response.ok) failures += 1;
      samples.push(performance.now() - started);
    } catch {
      failures += 1;
      samples.push(performance.now() - started);
    }
  }
  results[key] = {
    ...summarizePerformance(samples, RESILIENCE_BUDGETS[key]),
    failures,
    // Synthetic read-only service checks; not a complete user journey SLO.
    route,
  };
  if (failures) results[key].status = "breach";
}
console.log(
  JSON.stringify(
    {
      kind: "build198_read_only_latency",
      recordedAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);
if (Object.values(results).some((value) => value.status !== "pass"))
  process.exitCode = 1;
