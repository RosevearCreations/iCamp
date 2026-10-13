function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function asBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("Image bytes are required.");
}

export function inspectGalleryWebpVariant(bytesValue, variant) {
  const bytes = asBytes(bytesValue);

  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new Error("Gallery variant is not a valid WebP image.");
  }

  const kind = ascii(bytes, 12, 4);
  const payload = 20;
  let width;
  let height;

  if (kind === "VP8X") {
    const flags = bytes[payload];
    if ((flags & 0x02) !== 0) {
      throw new Error("Animated gallery variants are not allowed.");
    }
    width = readUint24LE(bytes, payload + 4) + 1;
    height = readUint24LE(bytes, payload + 7) + 1;
  } else if (kind === "VP8 ") {
    if (
      bytes[payload + 3] !== 0x9d ||
      bytes[payload + 4] !== 0x01 ||
      bytes[payload + 5] !== 0x2a
    ) {
      throw new Error("Gallery WebP frame header is invalid.");
    }
    width = (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff;
    height = (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff;
  } else if (kind === "VP8L") {
    if (bytes[payload] !== 0x2f) {
      throw new Error("Gallery WebP lossless header is invalid.");
    }
    const bits =
      bytes[payload + 1] |
      (bytes[payload + 2] << 8) |
      (bytes[payload + 3] << 16) |
      (bytes[payload + 4] << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  } else {
    throw new Error("Unsupported gallery WebP encoding.");
  }

  const max = variant === "thumbnail" ? 480 : 1800;

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > max ||
    height > max
  ) {
    throw new Error(
      variant === "thumbnail"
        ? "Gallery thumbnail must fit within 480 × 480 pixels."
        : "Gallery optimized image must fit within 1800 × 1800 pixels.",
    );
  }

  return Object.freeze({ width, height });
}

export function assertMatchingGalleryAspectRatio(source, variant) {
  const sourceRatio = source.width / source.height;
  const variantRatio = variant.width / variant.height;
  const drift = Math.abs(sourceRatio - variantRatio) / sourceRatio;

  if (!Number.isFinite(drift) || drift > 0.02) {
    throw new Error(
      "Gallery image variants must preserve the source aspect ratio.",
    );
  }
}
