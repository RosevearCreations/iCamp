import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 028 enforces the public gallery data boundary", async () => {
  const migration = await readFile(
    "database/migrations/0032_accommodation_public_gallery.sql",
    "utf8",
  );

  assert.match(migration, /accommodation_public_gallery_images/u);
  assert.match(migration, /at most 10 active public gallery images/u);
  assert.match(migration, /classification = 'public'/u);
  assert.match(migration, /media_kind = 'image'/u);
  assert.match(migration, /thumbnail_media_asset_id/u);
  assert.match(migration, /optimized_media_asset_id/u);
  assert.match(migration, /accommodation_public_gallery_one_hero_idx/u);
  assert.match(migration, /force row level security/u);
  assert.match(
    migration,
    /revoke all on public\.accommodation_public_gallery_images from authenticated/u,
  );
});

test("Build 028 provides audited gallery services and real media variants", async () => {
  const service = await readFile("lib/gallery/postgres.mjs", "utf8");
  const imageProcessing = await readFile(
    "lib/gallery/image-processing.mjs",
    "utf8",
  );
  const actions = await readFile(
    "app/workspaces/management/campgrounds/accommodations/actions.ts",
    "utf8",
  );

  assert.match(service, /listAccommodationGalleries/u);
  assert.match(service, /registerAccommodationGalleryImage/u);
  assert.match(service, /updateAccommodationGalleryImage/u);
  assert.match(service, /archiveAccommodationGalleryImage/u);
  assert.match(service, /accommodation\.gallery\.image\.create/u);
  assert.match(service, /accommodation\.gallery\.image\.archive/u);
  assert.match(imageProcessing, /inspectGalleryWebpVariant/u);
  assert.match(imageProcessing, /assertMatchingGalleryAspectRatio/u);
  assert.match(actions, /uploadAccommodationGalleryImageAction/u);
  assert.match(actions, /icamp-public-media/u);
});

test("Build 028 is fully promoted and documents the Operations Workbench interface decision", async () => {
  const direction = await readFile("docs/INTERFACE_DIRECTION.md", "utf8");
  const shell = await readFile("components/app-shell.tsx", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");
  const build = await readFile("docs/BUILD_028.md", "utf8");

  assert.match(direction, /Operations Workbench/u);
  assert.match(direction, /Global workspace navigation/u);
  assert.match(direction, /Property context/u);
  assert.match(direction, /Object workbench/u);
  assert.doesNotMatch(shell, /Build 004 · Authentication & secure sessions/u);
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /20261013023850/u);
  assert.match(build, /38338123097/u);
  assert.match(
    queue,
    /Build 028 — Site\/Cottage Public Gallery: Up to 10 Images[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 029 — Operational Asset & Equipment\/Fleet Model[\s\S]*QUEUED — NOT STARTED/u,
  );
});
