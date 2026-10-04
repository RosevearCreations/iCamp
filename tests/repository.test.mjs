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
    "BUILD_OPERATING_MODEL.md",
    "IT_ANALYSIS.md",
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

test("roadmap reset keeps the active sequence and old foundation separated", async () => {
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  const baseline = await readFile(
    "docs/PRE_IMPLEMENTATION_BASELINE.md",
    "utf8",
  );

  assert.match(
    queue,
    /Build 001 — Responsive PWA & Omnichannel Application Shell/,
  );
  assert.match(queue, /The active roadmap contains \*\*156 builds\*\*/);
  assert.match(baseline, /intentionally \*\*unnumbered\*\*/);
});

test("omnichannel source requires IVR DTMF and SMS channel parity", async () => {
  const omnichannel = await readFile("docs/OMNICHANNEL.md", "utf8");

  assert.match(omnichannel, /IVR\/DTMF/);
  assert.match(omnichannel, /SMS\/MMS/);
  assert.match(omnichannel, /same iCamp backend/i);
  assert.match(omnichannel, /caller ID/i);
});

test("Build 001 exposes all required workspace shells", async () => {
  const workspaces = await readFile("lib/workspaces.ts", "utf8");

  for (const slug of [
    "public",
    "guest",
    "front-desk",
    "maintenance",
    "security",
    "store",
    "staff",
    "foreman",
    "management",
    "finance",
  ]) {
    assert.match(workspaces, new RegExp(`slug: ["']${slug}["']`));
  }
});

test("Build 001 defines Web IVR and SMS channel capability contracts", async () => {
  const channels = await readFile("lib/channels.ts", "utf8");

  assert.match(channels, /web:/);
  assert.match(channels, /ivr:/);
  assert.match(channels, /sms:/);
  assert.match(channels, /secure-link/);
  assert.match(channels, /staff-transfer/);
});

test("Build 001 includes PWA and portable deployment baselines", async () => {
  const manifest = await readFile("app/manifest.ts", "utf8");
  const nextConfig = await readFile("next.config.ts", "utf8");
  const serviceWorker = await readFile("public/sw.js", "utf8");

  assert.match(manifest, /display: ["']standalone["']/);
  assert.match(manifest, /start_url: ["']\/["']/);
  assert.match(nextConfig, /output: ["']standalone["']/);
  assert.match(serviceWorker, /addEventListener\(["']fetch["']/);
});

test("Build 001 architecture codifies free-first evolution and migration", async () => {
  const architecture = await readFile("docs/ARCHITECTURE.md", "utf8");

  assert.match(architecture, /Free-First Development/);
  assert.match(architecture, /Scale-up migration/i);
  assert.match(architecture, /feature flags/i);
  assert.match(architecture, /provider adapters/i);
});

test("Build 001 responsive shell includes tablet and phone breakpoints", async () => {
  const css = await readFile("app/globals.css", "utf8");

  assert.match(css, /@media \(max-width: 60rem\)/);
  assert.match(css, /@media \(max-width: 46rem\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /skip-link/);
});

test("build operating model preserves autonomous free-first delivery", async () => {
  const operatingModel = await readFile(
    "docs/BUILD_OPERATING_MODEL.md",
    "utf8",
  );

  assert.match(operatingModel, /Autonomous development by default/);
  assert.match(operatingModel, /Free-first development/);
  assert.match(operatingModel, /verbose summary/i);
  assert.match(operatingModel, /exact numbered steps/i);
});


test("Build 002 defines typed environment and health contracts", async () => {
  const runtime = await readFile("lib/config/runtime.ts", "utf8");
  const envTemplate = await readFile(".env.example", "utf8");

  for (const environment of [
    "development",
    "test",
    "staging",
    "production",
  ]) {
    assert.match(runtime, new RegExp(`["']${environment}["']`));
  }

  assert.match(runtime, /NEXT_PUBLIC_APP_ENV and ICAMP_APP_ENV|ICAMP_APP_ENV and NEXT_PUBLIC_APP_ENV/);
  assert.match(envTemplate, /ICAMP_BUILD_SHA/);
  assert.match(envTemplate, /ICAMP_FEATURE_EXTERNAL_WATCHDOG/);
});

test("Build 002 exposes sanitized health readiness liveness and version routes", async () => {
  for (const path of [
    "app/api/health/route.ts",
    "app/api/health/live/route.ts",
    "app/api/health/ready/route.ts",
    "app/api/version/route.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /Cache-Control/);
    assert.match(source, /no-store/);
  }
});

test("Build 002 preserves correlation redaction and lockup watchdog contracts", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  const redaction = await readFile("lib/observability/redaction.ts", "utf8");
  const watchdog = await readFile("lib/observability/watchdog.ts", "utf8");

  assert.match(proxy, /x-icamp-request-id/);
  assert.match(proxy, /createRequestId/);
  assert.match(redaction, /REDACTED/);
  assert.match(redaction, /password/);
  assert.match(redaction, /token/);
  assert.match(redaction, /pin/i);
  assert.match(watchdog, /\/api\/health\/live/);
  assert.match(watchdog, /recommendedCheckSeconds: 60/);
  assert.match(watchdog, /recommendedFailureThreshold: 3/);
});

test("Build 002 includes IT analysis and client-safe status surfaces", async () => {
  const workspaces = await readFile("lib/workspaces.ts", "utf8");
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const statusPage = await readFile("app/status/page.tsx", "utf8");
  const banner = await readFile("components/environment-banner.tsx", "utf8");

  assert.match(workspaces, /slug: ["']it-analysis["']/);
  assert.match(itPage, /Sensitive diagnostics stay protected/);
  assert.match(statusPage, /public-safe|safe service information/i);
  assert.match(banner, /Non-production environment/);
});

test("Build 002 source of truth requires external lockup detection and diagnostic privacy", async () => {
  const itSource = await readFile("docs/IT_ANALYSIS.md", "utf8");
  const security = await readFile("docs/SECURITY.md", "utf8");

  assert.match(itSource, /external watchdog/i);
  assert.match(itSource, /frozen runtime/i);
  assert.match(security, /stack traces/i);
  assert.match(security, /I\.T\. Diagnostics and Observability Security/);
});
