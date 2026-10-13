import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 028 extends the Accommodation assembly with a visible gallery", async () => {
  const page = await readFile(
    "app/workspaces/management/campgrounds/accommodations/page.tsx",
    "utf8",
  );
  const panel = await readFile(
    "app/workspaces/management/campgrounds/accommodations/gallery-panel.tsx",
    "utf8",
  );
  const upload = await readFile(
    "app/workspaces/management/campgrounds/accommodations/gallery-upload-form.tsx",
    "utf8",
  );
  const styles = await readFile(
    "app/workspaces/management/campgrounds/accommodations/accommodation-admin.module.css",
    "utf8",
  );

  assert.match(page, /Build 024/u);
  assert.match(page, /Build 025/u);
  assert.match(page, /Build 026/u);
  assert.match(page, /Build 027/u);
  assert.match(page, /Build 028/u);
  assert.match(page, /GalleryPanel/u);
  assert.match(page, /listAccommodationGalleries/u);

  assert.match(panel, /Public site \/ cottage gallery/u);
  assert.match(panel, /10/u);
  assert.match(panel, /Hero/u);
  assert.match(panel, /alternative text/i);
  assert.match(panel, /Build 038/u);
  assert.match(panel, /internal maintenance/u);

  assert.match(upload, /createImageBitmap/u);
  assert.match(upload, /360/u);
  assert.match(upload, /1440/u);
  assert.match(upload, /image\/webp/u);

  assert.match(styles, /galleryPanel/u);
  assert.match(styles, /galleryHero/u);
  assert.match(styles, /galleryGrid/u);
  assert.match(styles, /galleryUpload/u);
});
