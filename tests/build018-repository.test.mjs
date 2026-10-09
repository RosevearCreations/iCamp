import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  inspectOverheadImage,
  sanitizeOverheadImage,
} from "../lib/map-images/image-processing.mjs";

function syntheticPng() {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x03, 0x00,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x04, 0x74, 0x45, 0x58, 0x74, 0x47, 0x50, 0x53, 0x21, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00,
    0x00,
  ]);
}

test("Build 018 reads stable source dimensions and strips PNG text metadata", () => {
  const source = syntheticPng();
  assert.deepEqual(inspectOverheadImage(source, "image/png"), {
    width: 1024,
    height: 768,
    pixels: 786432,
  });

  const sanitized = sanitizeOverheadImage(source, "image/png");
  assert.equal(sanitized.width, 1024);
  assert.equal(sanitized.height, 768);
  assert.ok(sanitized.bytes.byteLength < source.byteLength);
  assert.equal(String.fromCharCode(...sanitized.bytes).includes("tEXt"), false);
});

test("Build 018 rejects unsupported overhead formats", () => {
  assert.throws(
    () => inspectOverheadImage(new Uint8Array([1, 2, 3]), "image/gif"),
    /JPEG, PNG and WebP/u,
  );
});

test("Build 018 migration enforces one active and one published map image", async () => {
  const migration = await readFile(
    "database/migrations/0021_overhead_image_library.sql",
    "utf8",
  );
  assert.match(migration, /campground_map_image_versions/u);
  assert.match(migration, /source_width integer/u);
  assert.match(migration, /source_checksum_sha256/u);
  assert.match(migration, /one_active_idx/u);
  assert.match(migration, /one_published_idx/u);
  assert.match(migration, /media_asset_id uuid not null/u);
  assert.match(migration, /touch_row/u);
  assert.match(migration, /\[\[:cntrl:\]\]/u);
  assert.match(migration, /strpos\(original_filename, chr\(92\)\)/u);
});

test("Build 018 map service is permission checked, audited and concurrency guarded", async () => {
  const domain = await readFile("lib/map-images/postgres.mjs", "utf8");
  assert.match(domain, /campground\.map/u);
  assert.match(domain, /media\.manage/u);
  assert.match(domain, /campground\.map\.publish/u);
  assert.match(domain, /appendAuditEvent/u);
  assert.match(domain, /pg_advisory_xact_lock/u);
  assert.match(domain, /row_version = \$3/u);
  assert.match(domain, /campground\.map\.image\.publish/u);
});

test("Build 018 upload sanitizes before storage and cleans orphan objects", async () => {
  const actions = await readFile(
    "app/workspaces/management/campgrounds/maps/actions.ts",
    "utf8",
  );
  const storage = await readFile("lib/media/storage.mjs", "utf8");

  assert.match(actions, /sanitizeOverheadImage/u);
  assert.match(actions, /createHash\("sha256"\)/u);
  assert.match(actions, /uploadValidatedObject/u);
  assert.match(actions, /deleteObject/u);
  assert.match(storage, /async deleteObject/u);
  assert.match(storage, /prefixes/u);
});

test("Build 018 UI exposes circular contextual help throughout", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/maps/page.tsx",
    "utf8",
  );
  const topics = await readFile("lib/help/topics.ts", "utf8");
  const help = await readFile("docs/HELP_SYSTEM.md", "utf8");

  assert.match(page, /helpTopic="campground\.map\.images"/u);
  assert.match(page, /helpTopic="admin\.refresh"/u);
  assert.match(topics, /"campground\.map\.images"/u);
  assert.match(help, /circular \*\*ⓘ\*\*/u);
});

test("Build 018 preserves the full campground SaaS roadmap", async () => {
  const roadmap = await readFile("docs/BUILD_ROADMAP.md", "utf8");
  const vision = await readFile("docs/MASTER_VISION.md", "utf8");
  const coverage = await readFile("docs/REQUIREMENTS_COVERAGE.md", "utf8");

  assert.match(vision, /hosted multi-tenant campground SaaS platform/u);
  assert.match(roadmap, /Operational Asset & Equipment\/Fleet Model/u);
  assert.match(roadmap, /Occupational Safety Compliance Tracking/u);
  assert.match(roadmap, /OSHA-style \/ Canadian OHS/u);
  assert.match(roadmap, /Advanced Internal Financial Ledger/u);
  assert.match(roadmap, /maintenance\/service\/work-order[\s\S]*job costing/u);
  assert.match(roadmap, /tax-period worksheets/u);
  assert.match(roadmap, /monthly subscription status\/entitlement model/u);
  assert.match(coverage, /Platform-owner SaaS tenant administration/u);
});

test("Build 018 source of truth records production promotion and queue advance", async () => {
  const build = await readFile("docs/BUILD_018.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /9110825f84d38b11f1cfaa91ba723682b2adcce9/u);
  assert.match(build, /37871367539/u);
  assert.match(build, /No manual action was required to promote Build 018/u);
  assert.match(
    queue,
    /Build 018 — Overhead Image Library & Versioning[\s\S]*FULLY PROMOTED — `main` GREEN/u,
  );
  assert.match(
    queue,
    /Build 019 — Zoom\/Pan Coordinate Engine[\s\S]*FULLY PROMOTED — `main` GREEN/u,
  );
  assert.match(
    queue,
    /Next active build[\s\S]*Build 020 — Polygon Plotter Core[\s\S]*QUEUED — NOT STARTED/u,
  );
});
