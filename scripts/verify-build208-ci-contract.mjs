import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild207CacheContract } from "./verify-build207-cache-contract.mjs";

export function verifyBuild208CIContract(inputs) {
  verifyBuild207CacheContract(inputs);
  const ci = inputs.workflows["ci.yml"];
  const e2e = ci.split("  e2e:\n")[1]?.split("  database:\n")[0];
  assert.ok(e2e, "Retain independent browser job");
  assert.match(e2e, /runs-on: ubuntu-24\.04/);
  assert.match(
    e2e,
    /key: \$\{\{ runner\.os \}\}-ubuntu24\.04-icamp-chromium-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/,
  );
  assert.doesNotMatch(e2e, /restore-keys:/);
  assert.match(
    e2e,
    /name: Begin Build 208 Chromium install timing\n\s+run: node scripts\/build208-browser-runtime-diagnostics\.mjs --start/,
  );
  assert.match(
    e2e,
    /name: Install Chromium\n\s+id: chromium-install\n(?:\s+#.*\n)*\s+run: npx playwright install chromium/,
  );
  assert.match(
    e2e,
    /if: always\(\) && steps\.chromium-install\.outcome != 'skipped'/,
  );
  assert.match(
    e2e,
    /ICAMP_CHROMIUM_INSTALL_OUTCOME: \$\{\{ steps\.chromium-install\.outcome \}\}/,
  );
  assert.match(
    e2e,
    /run: node scripts\/build208-browser-runtime-diagnostics\.mjs --finish/,
  );
  assert.match(e2e, /name: Upload Build 208 Chromium install timing evidence/);
  assert.match(
    e2e,
    /name: Run browser end-to-end harness\n\s+run: npm run e2e:test/,
  );
  assert.match(ci, /run: npm run build208:ci-contract/);
  const positions = [
    "Begin Build 208 Chromium install timing",
    "name: Install Chromium",
    "Record Build 208 Chromium cold-runner timing",
    "name: Run browser end-to-end harness",
  ].map((fragment) => e2e.indexOf(fragment));
  assert.ok(
    positions.every(
      (position, index) =>
        position >= 0 && (!index || position > positions[index - 1]),
    ),
  );
  assert.doesNotMatch(e2e, /continue-on-error: true/);
  return {
    protectedRequiredJobs: 5,
    browserRunner: "ubuntu-24.04",
    cacheSeparatedByRunner: true,
    chromiumInstallerStillRequired: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = verifyBuild208CIContract(readBuild206Inputs());
  console.log(
    `Build 208: ${result.protectedRequiredJobs} protected checks preserved, ${result.browserRunner} browser runner and exact-OS cache, mandatory Chromium install and read-only timing evidence.`,
  );
}
