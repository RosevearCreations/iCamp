export const MEDIA_CLASSIFICATIONS = Object.freeze([
  "public",
  "internal",
  "confidential",
]);

export const MEDIA_BUCKETS = Object.freeze({
  public: "icamp-public-media",
  internal: "icamp-internal-media",
  confidential: "icamp-confidential-media",
});

export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const rules = new Map([
  [
    "image/jpeg",
    {
      kind: "image",
      extensions: [".jpg", ".jpeg"],
      canonicalExtension: ".jpg",
      maxBytes: IMAGE_MAX_BYTES,
      signature: (bytes) =>
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff,
    },
  ],
  [
    "image/png",
    {
      kind: "image",
      extensions: [".png"],
      canonicalExtension: ".png",
      maxBytes: IMAGE_MAX_BYTES,
      signature: (bytes) =>
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a,
    },
  ],
  [
    "image/webp",
    {
      kind: "image",
      extensions: [".webp"],
      canonicalExtension: ".webp",
      maxBytes: IMAGE_MAX_BYTES,
      signature: (bytes) =>
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
    },
  ],
  [
    "image/gif",
    {
      kind: "image",
      extensions: [".gif"],
      canonicalExtension: ".gif",
      maxBytes: IMAGE_MAX_BYTES,
      signature: (bytes) => {
        if (bytes.length < 6) {
          return false;
        }

        const signature = String.fromCharCode(...bytes.slice(0, 6));
        return signature === "GIF87a" || signature === "GIF89a";
      },
    },
  ],
  [
    "application/pdf",
    {
      kind: "document",
      extensions: [".pdf"],
      canonicalExtension: ".pdf",
      maxBytes: DOCUMENT_MAX_BYTES,
      signature: (bytes) =>
        bytes.length >= 5 &&
        String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-",
    },
  ],
]);

function toBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  return new Uint8Array();
}

function normalizeContentType(value) {
  return String(value ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot).toLowerCase() : "";
}

function invalid(code, message) {
  return { ok: false, code, message };
}

export function mediaBucketForClassification(classification) {
  if (!MEDIA_CLASSIFICATIONS.includes(classification)) {
    throw new Error("Unknown media classification.");
  }

  return MEDIA_BUCKETS[classification];
}

export function validateMediaUpload({
  classification,
  filename,
  contentType,
  byteSize,
  headerBytes,
}) {
  if (!MEDIA_CLASSIFICATIONS.includes(classification)) {
    return invalid(
      "classification_invalid",
      "Media classification is invalid.",
    );
  }

  const normalizedFilename = String(filename ?? "").trim();

  if (
    normalizedFilename.length < 1 ||
    normalizedFilename.length > 240 ||
    /[\\/\u0000-\u001f\u007f]/u.test(normalizedFilename)
  ) {
    return invalid(
      "filename_invalid",
      "Filename must be a plain filename without path or control characters.",
    );
  }

  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    return invalid("size_invalid", "File size must be a positive integer.");
  }

  const normalizedType = normalizeContentType(contentType);
  const rule = rules.get(normalizedType);

  if (!rule) {
    return invalid(
      "content_type_not_allowed",
      "Only JPEG, PNG, WebP, GIF, and PDF files are accepted.",
    );
  }

  if (byteSize > rule.maxBytes) {
    return invalid(
      "file_too_large",
      rule.kind === "image"
        ? "Images must be 12 MiB or smaller."
        : "PDF documents must be 25 MiB or smaller.",
    );
  }

  const extension = extensionOf(normalizedFilename);

  if (!rule.extensions.includes(extension)) {
    return invalid(
      "extension_mismatch",
      "Filename extension does not match the declared content type.",
    );
  }

  const bytes = toBytes(headerBytes);

  if (!rule.signature(bytes)) {
    return invalid(
      "signature_mismatch",
      "File signature does not match the declared content type.",
    );
  }

  return {
    ok: true,
    classification,
    mediaKind: rule.kind,
    contentType: normalizedType,
    byteSize,
    canonicalExtension: rule.canonicalExtension,
    bucketKey: mediaBucketForClassification(classification),
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildMediaObjectKey({
  organizationId,
  campgroundId,
  assetId,
  canonicalExtension,
}) {
  for (const [label, value] of [
    ["organizationId", organizationId],
    ["campgroundId", campgroundId],
    ["assetId", assetId],
  ]) {
    if (!uuidPattern.test(String(value ?? ""))) {
      throw new Error(label + " must be a UUID.");
    }
  }

  if (![".jpg", ".png", ".webp", ".gif", ".pdf"].includes(canonicalExtension)) {
    throw new Error("Unsupported canonical media extension.");
  }

  return (
    String(organizationId).toLowerCase() +
    "/" +
    String(campgroundId).toLowerCase() +
    "/" +
    String(assetId).toLowerCase() +
    canonicalExtension
  );
}
