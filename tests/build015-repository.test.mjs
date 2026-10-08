import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 015 defines an explicit workflow parity registry and canonical adapters", async () => {
  const core = await readFile("lib/parity/core.mjs", "utf8");

  assert.match(core, /workflowParityMatrix/u);
  assert.match(core, /executeCanonicalCommand/u);
  assert.match(core, /createIvrWorkflowAdapter/u);
  assert.match(core, /createSmsWorkflowAdapter/u);
  assert.match(core, /createSecureLink/u);
  assert.match(core, /requestStaffTransfer/u);
  assert.match(core, /accidental_web_only_workflow/u);
});

test("Build 015 covers guest, staff, management and graphical-only workflow families", async () => {
  const core = await readFile("lib/parity/core.mjs", "utf8");

  assert.match(core, /reservation\.search/u);
  assert.match(core, /work-order\.status\.update/u);
  assert.match(core, /gate\.override/u);
  assert.match(core, /map\.polygon\.edit/u);
  assert.match(core, /visualOnly: true/u);
  assert.match(core, /Raw card data must never be collected/u);
});

test("Build 015 automated parity proof is wired into CI", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const packageJson = await readFile("package.json", "utf8");
  const proof = await readFile("scripts/verify-workflow-parity.mjs", "utf8");

  assert.match(workflow, /Verify telephone\/SMS workflow parity harness/u);
  assert.match(workflow, /npm run parity:verify/u);
  assert.match(packageJson, /"parity:verify"/u);
  assert.match(proof, /reservation\.search/u);
  assert.match(proof, /work-order\.status\.update/u);
  assert.match(proof, /map\.polygon\.edit/u);
});

test("Build 015 exposes only aggregate parity health in I.T. & Analysis", async () => {
  const page = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const core = await readFile("lib/parity/core.mjs", "utf8");

  assert.match(page, /getWorkflowParityHealth/u);
  assert.match(page, /Workflow parity harness/u);
  assert.match(page, /Canonical commands/u);
  assert.match(core, /callerOrSenderHintIsAuthentication: false/u);
});

test("Build 015 source of truth documents graphical exceptions and fallback rules", async () => {
  const source = await readFile("docs/WORKFLOW_PARITY.md", "utf8");
  const build = await readFile("docs/BUILD_015.md", "utf8");
  const omnichannel = await readFile("docs/OMNICHANNEL.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(source, /No channel owns business logic/u);
  assert.match(source, /polygon drawing/u);
  assert.match(source, /secure-link/u);
  assert.match(source, /staff transfer/u);
  assert.match(build, /Telephone\/SMS Workflow Parity Harness/u);
  assert.match(omnichannel, /Build 015 workflow parity implementation/u);
  assert.match(queue, /Build 015 — Telephone\/SMS Workflow Parity Harness/u);
});
