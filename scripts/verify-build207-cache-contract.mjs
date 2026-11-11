import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readBuild206Inputs,
  verifyBuild206CacheContract,
} from "./verify-build206-cache-contract.mjs";

export function verifyBuild207CacheContract(inputs) {
  verifyBuild206CacheContract(inputs);
  const ci = inputs.workflows["ci.yml"];
  const count = (fragment) => ci.split(fragment).length - 1;
  assert.equal(
    count("id: node-cache"),
    3,
    "Each lane needs a cache-hit witness",
  );
  assert.ok(
    count("ICAMP_NPM_CACHE_HIT: ${{ steps.node-cache.outputs.cache-hit }}") >=
      3,
    "Preserve three cache witnesses; later diagnostic steps may reuse the observed output",
  );
  assert.equal(count("run: node scripts/build207-cache-witness.mjs"), 3);
  assert.equal(
    count("id: browser-cache"),
    1,
    "Browser restore is isolated to browser lane",
  );
  assert.equal(count("uses: actions/cache@v4"), 1);
  const browser = ci.split("  e2e:\n")[1]?.split("  database:\n")[0];
  assert.ok(browser, "Browser job must remain present");
  assert.match(browser, /path: ~\/\.cache\/ms-playwright/);
  assert.match(
    browser,
    /key: \$\{\{ runner\.os \}\}-(?:ubuntu24\.04-)?icamp-chromium-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/,
  );
  assert.doesNotMatch(
    browser,
    /restore-keys:/,
    "Never fall back to another browser version cache",
  );
  assert.match(browser, /run: npx playwright install chromium/);
  assert.equal(count("run: npx playwright install chromium"), 1);
  assert.match(browser, /run: npm run e2e:test/);
  assert.match(
    browser,
    /ICAMP_BROWSER_CACHE_HIT: \$\{\{ steps\.browser-cache\.outputs\.cache-hit \}\}/,
  );
  assert.match(
    browser,
    /ICAMP_BROWSER_CACHE_RESTORE_COMPLETED: \$\{\{ steps\.browser-cache\.outcome == 'success' \}\}/,
  );
  assert.match(
    browser,
    /run: node scripts\/build207-cache-witness\.mjs --browser/,
  );
  assert.match(ci, /run: npm run build207:cache-contract/);
  assert.doesNotMatch(ci, /continue-on-error: true/);
  return { protectedJobs: 5, npmWitnessLanes: 3, isolatedBrowserCaches: 1 };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const proof = verifyBuild207CacheContract(readBuild206Inputs());
  console.log(
    `Build 207: ${proof.protectedJobs} required checks retained; ${proof.npmWitnessLanes} npm cache witnesses and one exact-lock Chromium cache; installation and browser tests always required.`,
  );
}
