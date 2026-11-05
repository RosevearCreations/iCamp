import { runBuild202ScopedTestWitness } from "../lib/integration-v1/build202-scoped-test-witness.mjs";

const result = await runBuild202ScopedTestWitness();
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (
  Object.entries(result).some(
    ([key, value]) =>
      (key.endsWith("_fixture") && value === "FAIL") ||
      (key.endsWith("_denied") && value === "FAIL"),
  )
)
  process.exitCode = 1;
