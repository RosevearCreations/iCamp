import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("package remains private and requires the supported Node LTS line", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(pkg.private, true);
  assert.equal(pkg.engines.node, ">=24 <25");
});

test("real environment files are ignored while the template remains tracked", async () => {
  const gitignore = await readFile(".gitignore", "utf8");

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("source-of-truth documents remain present in README", async () => {
  const readme = await readFile("README.md", "utf8");

  for (const required of [
    "MASTER_VISION.md",
    "ARCHITECTURE.md",
    "BUILD_ROADMAP.md",
    "REQUIREMENTS_COVERAGE.md",
    "OMNICHANNEL.md",
    "SECURITY.md",
    "BUILD_QUEUE.md",
    "PRE_IMPLEMENTATION_BASELINE.md",
  ]) {
    assert.ok(readme.includes(required), `README must link ${required}`);
  }
});

test("active roadmap contains exactly Builds 001 through 156", async () => {
  const roadmap = await readFile("docs/BUILD_ROADMAP.md", "utf8");
  const matches = [...roadmap.matchAll(/^## Build (\d{3}) —/gm)].map((match) =>
    Number(match[1]),
  );

  assert.equal(matches.length, 156);
  assert.deepEqual(
    matches,
    Array.from({ length: 156 }, (_, index) => index + 1),
  );
});

test("roadmap reset keeps Build 001 queued and the old foundation unnumbered", async () => {
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  const baseline = await readFile(
    "docs/PRE_IMPLEMENTATION_BASELINE.md",
    "utf8",
  );

  assert.match(
    queue,
    /Build 001 — Responsive PWA & Omnichannel Application Shell/,
  );
  assert.match(queue, /QUEUED — NOT STARTED/);
  assert.match(baseline, /intentionally \*\*unnumbered\*\*/);
});

test("omnichannel source requires IVR DTMF and SMS channel parity", async () => {
  const omnichannel = await readFile("docs/OMNICHANNEL.md", "utf8");

  assert.match(omnichannel, /IVR\/DTMF/);
  assert.match(omnichannel, /SMS\/MMS/);
  assert.match(omnichannel, /same iCamp backend/i);
  assert.match(omnichannel, /caller ID/i);
});
