import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readCIWorkflows,
  verifyBuild204CIContract,
} from "./verify-build204-ci-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function readBuild206Inputs() {
  return {
    workflows: readCIWorkflows(),
    manifest: JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")),
    lock: JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8")),
  };
}

export function verifyBuild206CacheContract({ workflows, manifest, lock }) {
  verifyBuild204CIContract(workflows);
  const ci = workflows["ci.yml"];
  assert.equal(lock.lockfileVersion, 3, "Require npm lockfile v3");
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[""].devDependencies, manifest.devDependencies);

  let packages = 0;
  for (const [path, dependency] of Object.entries(lock.packages)) {
    if (!path) continue;
    packages++;
    assert.match(
      dependency.resolved ?? "",
      /^https:\/\/registry\.npmjs\.org\//,
      `${path}: only approved HTTPS npm registry tarballs`,
    );
    assert.match(
      dependency.integrity ?? "",
      /^sha512-[A-Za-z0-9+/=]+$/,
      `${path}: lockfile must contain SHA-512 package integrity`,
    );
  }
  assert.ok(packages > 200, "Expected complete transitive dependency closure");

  const count = (fragment) => ci.split(fragment).length - 1;
  assert.equal(count("uses: actions/setup-node@v7"), 3);
  assert.equal(
    count("cache: npm"),
    3,
    "Cache npm tarballs in all three CI jobs",
  );
  assert.equal(
    count("cache-dependency-path: package-lock.json"),
    3,
    "Every cache key must depend on the exact reviewed lockfile",
  );
  assert.equal(
    count("run: npm ci --ignore-scripts --prefer-offline --no-audit --no-fund"),
    3,
    "Each independent job must clean-install verified locked packages",
  );
  assert.equal(
    count("run: npm install --ignore-scripts"),
    0,
    "Do not restore unpinned dependency resolution",
  );
  assert.match(ci, /run: npm audit --omit=dev --audit-level=high/);
  assert.match(ci, /name: Upload full dependency audit/);
  assert.match(ci, /name: Run browser end-to-end harness/);
  assert.match(ci, /name: Apply migrations/);
  assert.match(
    ci,
    /run: npm run build205:ci-diagnostics|run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /run: npm run build206:cache-contract/);
  return { lockedPackages: packages, checkedJobs: 3, protectedGates: 5 };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = verifyBuild206CacheContract(readBuild206Inputs());
  console.log(
    `Build 206: ${result.lockedPackages} SHA-512 locked packages; ${result.checkedJobs} isolated clean installs with exact npm cache; ${result.protectedGates} protected jobs unchanged.`,
  );
}
