import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function readCIWorkflows() {
  return Object.fromEntries(
    ["ci.yml", "codeql.yml", "secrets.yml"].map((name) => [
      name,
      readFileSync(resolve(root, ".github/workflows", name), "utf8"),
    ]),
  );
}

export function verifyBuild204CIContract(files) {
  for (const name of ["ci.yml", "codeql.yml", "secrets.yml"]) {
    const contents = files[name];
    assert.equal(typeof contents, "string", name + " must exist");
    assert.match(
      contents,
      /^on:\n  push:\n    branches: \[main\]\n  pull_request:\n    branches: \[dev, main\]/m,
      name +
        ": require PR validation and main verification without dev push duplication",
    );
    assert.match(
      contents,
      /^concurrency:\n  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/m,
      name +
        ": superseded PR runs may be canceled, never main or schedule runs",
    );
    assert.match(
      contents,
      /^permissions:\n  contents: read/m,
      name + ": checkout is read-only",
    );
  }

  assert.match(files["ci.yml"], /^  verify:\n    name: Verify/m);
  assert.match(files["ci.yml"], /^  e2e:\n    name: Browser end-to-end/m);
  assert.match(files["ci.yml"], /^  database:\n    name: Database migrations/m);
  assert.match(files["ci.yml"], /run: npm run build203:runbook/);
  assert.match(files["ci.yml"], /run: npm run build204:ci-contract/);
  assert.match(files["ci.yml"], /run: npm audit --omit=dev --audit-level=high/);
  assert.match(files["ci.yml"], /name: Upload full dependency audit/);
  assert.match(files["ci.yml"], /name: Upload browser failure artifacts/);
  assert.match(files["ci.yml"], /run: npm run db:verify/);
  assert.match(files["ci.yml"], /run: npm run build201:handshake-drill/);

  assert.match(files["secrets.yml"], /^  gitleaks:\n    name: Gitleaks/m);
  assert.match(files["secrets.yml"], /uses: gitleaks\/gitleaks-action@v3/);
  assert.match(files["secrets.yml"], /^  pull-requests: read/m);

  assert.match(
    files["codeql.yml"],
    /^  analyze:\n    name: Analyze JavaScript and TypeScript/m,
  );
  assert.match(
    files["codeql.yml"],
    /^  schedule:\n    - cron: "23 5 \* \* 1"/m,
  );
  assert.match(files["codeql.yml"], /^  security-events: write/m);
  assert.match(files["codeql.yml"], /uses: github\/codeql-action\/analyze@v4/);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  verifyBuild204CIContract(readCIWorkflows());
  console.log(
    "Build 204: five protected jobs, PR/main events, CodeQL schedule, and evidence retention preserved; duplicate dev push runs removed.",
  );
}
