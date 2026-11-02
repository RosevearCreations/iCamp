import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_MAX_BYTES,
  IMAGE_MAX_BYTES,
  buildMediaObjectKey,
  mediaBucketForClassification,
  validateMediaUpload,
} from "../lib/media/validation.mjs";

test("Build 008 accepts validated image and PDF signatures", () => {
  const png = validateMediaUpload({
    classification: "public",
    filename: "camp-map.png",
    contentType: "image/png",
    byteSize: 1024,
    headerBytes: new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]),
  });

  assert.equal(png.ok, true);
  assert.equal(png.mediaKind, "image");
  assert.equal(png.bucketKey, "icamp-public-media");

  const pdf = validateMediaUpload({
    classification: "confidential",
    filename: "incident.pdf",
    contentType: "application/pdf; charset=binary",
    byteSize: 2048,
    headerBytes: new TextEncoder().encode("%PDF-"),
  });

  assert.equal(pdf.ok, true);
  assert.equal(pdf.mediaKind, "document");
  assert.equal(pdf.bucketKey, "icamp-confidential-media");
});

test("Build 008 rejects spoofed, oversized, unsafe and unsupported media", () => {
  const spoofed = validateMediaUpload({
    classification: "internal",
    filename: "photo.png",
    contentType: "image/png",
    byteSize: 500,
    headerBytes: new TextEncoder().encode("<html>"),
  });
  assert.equal(spoofed.ok, false);
  assert.equal(spoofed.code, "signature_mismatch");

  const oversizedImage = validateMediaUpload({
    classification: "internal",
    filename: "large.jpg",
    contentType: "image/jpeg",
    byteSize: IMAGE_MAX_BYTES + 1,
    headerBytes: new Uint8Array([0xff, 0xd8, 0xff]),
  });
  assert.equal(oversizedImage.ok, false);
  assert.equal(oversizedImage.code, "file_too_large");

  const oversizedDocument = validateMediaUpload({
    classification: "confidential",
    filename: "large.pdf",
    contentType: "application/pdf",
    byteSize: DOCUMENT_MAX_BYTES + 1,
    headerBytes: new TextEncoder().encode("%PDF-"),
  });
  assert.equal(oversizedDocument.ok, false);
  assert.equal(oversizedDocument.code, "file_too_large");

  const pathFilename = validateMediaUpload({
    classification: "public",
    filename: "../photo.jpg",
    contentType: "image/jpeg",
    byteSize: 100,
    headerBytes: new Uint8Array([0xff, 0xd8, 0xff]),
  });
  assert.equal(pathFilename.ok, false);
  assert.equal(pathFilename.code, "filename_invalid");

  const svg = validateMediaUpload({
    classification: "public",
    filename: "unsafe.svg",
    contentType: "image/svg+xml",
    byteSize: 100,
    headerBytes: new TextEncoder().encode("<svg"),
  });
  assert.equal(svg.ok, false);
  assert.equal(svg.code, "content_type_not_allowed");
});

test("Build 008 uses opaque canonical object keys and classification buckets", () => {
  const objectKey = buildMediaObjectKey({
    organizationId: "11111111-1111-4111-8111-111111111111",
    campgroundId: "22222222-2222-4222-8222-222222222222",
    assetId: "33333333-3333-4333-8333-333333333333",
    canonicalExtension: ".jpg",
  });

  assert.equal(
    objectKey,
    "11111111-1111-4111-8111-111111111111/" +
      "22222222-2222-4222-8222-222222222222/" +
      "33333333-3333-4333-8333-333333333333.jpg",
  );
  assert.equal(
    mediaBucketForClassification("internal"),
    "icamp-internal-media",
  );
  assert.equal(
    mediaBucketForClassification("confidential"),
    "icamp-confidential-media",
  );
});
