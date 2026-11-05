import assert from "node:assert/strict";
import test from "node:test";
import {
  readCIWorkflows,
  verifyBuild204CIContract,
} from "../scripts/verify-build204-ci-contract.mjs";

const baseline = readCIWorkflows();

test("Build 204 keeps all protected CI jobs and avoids duplicate dev push runs", () => {
  assert.doesNotThrow(() => verifyBuild204CIContract(baseline));
});

test("Build 204 rejects a reintroduced dev push trigger", () => {
  const changed = {
    ...baseline,
    "secrets.yml": baseline["secrets.yml"].replace(
      "branches: [main]",
      "branches: [dev, main]",
    ),
  };
  assert.throws(() => verifyBuild204CIContract(changed));
});

test("Build 204 rejects cancellation of main release evidence", () => {
  const changed = {
    ...baseline,
    "ci.yml": baseline["ci.yml"].replace(
      "cancel-in-progress: \${{ github.event_name == 'pull_request' }}",
      "cancel-in-progress: true",
    ),
  };
  assert.throws(() => verifyBuild204CIContract(changed));
});

test("Build 204 rejects removal of security and migration gates", () => {
  for (const [name, fragment] of [
    ["secrets.yml", "uses: gitleaks/gitleaks-action@v3"],
    ["codeql.yml", "uses: github/codeql-action/analyze@v4"],
    ["ci.yml", "run: npm run db:verify"],
  ]) {
    const changed = {
      ...baseline,
      [name]: baseline[name].replace(fragment, "removed"),
    };
    assert.throws(() => verifyBuild204CIContract(changed), name);
  }
});

test("Build 204 retains weekly CodeQL independent of PR traffic", () => {
  const changed = {
    ...baseline,
    "codeql.yml": baseline["codeql.yml"].replace(
      '    - cron: "23 5 * * 1"',
      "",
    ),
  };
  assert.throws(() => verifyBuild204CIContract(changed));
});
