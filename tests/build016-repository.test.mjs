import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertDemoSeedAllowed,
  demoCampgroundCatalogue,
  demoCampgroundSummary,
  validateDemoCampgroundCatalogue,
} from "../lib/demo/catalogue.mjs";

test("Build 016 demo catalogue is deterministic, synthetic, and prototype-safe", () => {
  const summary = validateDemoCampgroundCatalogue();

  assert.equal(demoCampgroundCatalogue.synthetic, true);
  assert.deepEqual(summary, demoCampgroundSummary);
  assert.equal(summary.sections, 5);
  assert.equal(summary.subsections, 7);
  assert.equal(summary.sites, 6);
  assert.equal(summary.cottages, 3);
  assert.equal(summary.assets, 6);

  const serialized = JSON.stringify(demoCampgroundCatalogue);
  assert.doesNotMatch(serialized, /@/u);
});

test("Build 016 seed guard refuses production and requires explicit opt-in", () => {
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        ICAMP_APP_ENV: "production",
        ICAMP_ALLOW_DEMO_SEED: "true",
      }),
    /forbidden in production/u,
  );

  assert.throws(
    () => assertDemoSeedAllowed({ ICAMP_APP_ENV: "test" }),
    /ICAMP_ALLOW_DEMO_SEED=true/u,
  );

  assert.equal(
    assertDemoSeedAllowed({
      ICAMP_APP_ENV: "test",
      ICAMP_ALLOW_DEMO_SEED: "true",
    }),
    "test",
  );
});

test("Build 016 seed persists only current canonical campground hierarchy", async () => {
  const seed = await readFile("scripts/seed-demo-campground.mjs", "utf8");

  assert.match(seed, /public\.organizations/u);
  assert.match(seed, /public\.campgrounds/u);
  assert.match(seed, /public\.campground_sections/u);
  assert.match(seed, /public\.campground_subsections/u);
  assert.doesNotMatch(seed, /insert into public\.accommodations/u);
  assert.doesNotMatch(seed, /insert into public\.operational_assets/u);
});

test("Build 016 browser framework is wired into CI", async () => {
  const packageJson = await readFile("package.json", "utf8");
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const config = await readFile("playwright.config.mjs", "utf8");
  const smoke = await readFile("e2e/smoke.spec.mjs", "utf8");

  assert.match(packageJson, /"@playwright\/test": "1\.64\.0"/u);
  assert.match(packageJson, /"e2e:test"/u);
  assert.match(workflow, /Browser end-to-end/u);
  assert.match(workflow, /playwright install --with-deps chromium/u);
  assert.match(workflow, /npm run e2e:test/u);
  assert.match(config, /Desktop Chrome/u);
  assert.match(smoke, /Pine Shore Demo Campground/u);
});

test("Build 016 production surface hides the demo route", async () => {
  const page = await readFile("app/demo/page.tsx", "utf8");
  const home = await readFile("app/page.tsx", "utf8");

  assert.match(page, /publicConfig\.environment === "production"/u);
  assert.match(page, /notFound\(\)/u);
  assert.match(home, /publicConfig\.environment !== "production"/u);
});

test("Build 016 source of truth records test-data privacy and roadmap boundary", async () => {
  const build = await readFile("docs/BUILD_016.md", "utf8");
  const source = await readFile("docs/DEMO_TEST_DATA.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /no production personal data/iu);
  assert.match(source, /Builds 024–030/u);
  assert.match(source, /ICAMP_ALLOW_DEMO_SEED=true/u);
  assert.match(queue, /Build 016 — Demo Campground, Test Data & End-to-End Harness/u);
});
