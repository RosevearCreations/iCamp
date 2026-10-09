const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const MAX_DIMENSION = 20000;
const MIN_DIMENSION = 256;
const MAX_PIXELS = 120_000_000;

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

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes, offset) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function assertDimensions(width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  ) {
    throw new Error(
      "Overhead image dimensions must be 256–20000 pixels per side and no more than 120 megapixels.",
    );
  }
  return Object.freeze({ width, height, pixels: width * height });
}

function pngDimensions(bytes) {
  if (
    bytes.length < 24 ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value) ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    throw new Error("PNG header is invalid.");
  }
  return assertDimensions(readUint32BE(bytes, 16), readUint32BE(bytes, 20));
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("JPEG header is invalid.");
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      continue;
    }
    if (offset + 1 >= bytes.length) {
      break;
    }

    const length = readUint16BE(bytes, offset);
    if (length < 2 || offset + length > bytes.length) {
      throw new Error("JPEG segment length is invalid.");
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) {
        throw new Error("JPEG frame header is invalid.");
      }
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      return assertDimensions(width, height);
    }
    offset += length;
  }

  throw new Error("JPEG dimensions could not be determined.");
}

function webpDimensions(bytes) {
  if (
    bytes.length < 30 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new Error("WebP header is invalid.");
  }

  const kind = ascii(bytes, 12, 4);
  const payload = 20;

  if (kind === "VP8X") {
    const flags = bytes[payload];
    if ((flags & 0x02) !== 0) {
      throw new Error("Animated WebP images are not allowed for overhead maps.");
    }
    return assertDimensions(
      readUint24LE(bytes, payload + 4) + 1,
      readUint24LE(bytes, payload + 7) + 1,
    );
  }

  if (kind === "VP8 ") {
    if (
      bytes[payload + 3] !== 0x9d ||
      bytes[payload + 4] !== 0x01 ||
      bytes[payload + 5] !== 0x2a
    ) {
      throw new Error("WebP VP8 frame header is invalid.");
    }
    const width = (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff;
    const height = (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff;
    return assertDimensions(width, height);
  }

  if (kind === "VP8L") {
    if (bytes[payload] !== 0x2f) {
      throw new Error("WebP VP8L frame header is invalid.");
    }
    const bits =
      bytes[payload + 1] |
      (bytes[payload + 2] << 8) |
      (bytes[payload + 3] << 16) |
      (bytes[payload + 4] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return assertDimensions(width, height);
  }

  throw new Error("Unsupported WebP encoding.");
}

function concat(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function sanitizeJpeg(bytes) {
  const parts = [bytes.slice(0, 2)];
  let offset = 2;

  while (offset < bytes.length) {
    const markerStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.length) {
      break;
    }
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xda) {
      parts.push(bytes.slice(markerStart));
      return concat(parts);
    }
    if (marker === 0xd9) {
      parts.push(bytes.slice(markerStart, offset));
      return concat(parts);
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      parts.push(bytes.slice(markerStart, offset));
      continue;
    }
    if (offset + 1 >= bytes.length) {
      throw new Error("JPEG segment is truncated.");
    }

    const length = readUint16BE(bytes, offset);
    if (length < 2 || offset + length > bytes.length) {
      throw new Error("JPEG segment length is invalid.");
    }
    const segmentEnd = offset + length;
    const removeMetadata =
      marker === 0xe1 || marker === 0xed || marker === 0xfe;

    if (!removeMetadata) {
      parts.push(bytes.slice(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  throw new Error("JPEG image data is incomplete.");
}

function sanitizePng(bytes) {
  if (
    bytes.length < 12 ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  ) {
    throw new Error("PNG header is invalid.");
  }

  const parts = [bytes.slice(0, 8)];
  const stripTypes = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);
  let offset = 8;
  let sawEnd = false;

  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) {
      throw new Error("PNG chunk is truncated.");
    }
    const type = ascii(bytes, offset + 4, 4);
    if (!stripTypes.has(type)) {
      parts.push(bytes.slice(offset, chunkEnd));
    }
    offset = chunkEnd;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }

  if (!sawEnd) {
    throw new Error("PNG image is missing IEND.");
  }
  return concat(parts);
}

function sanitizeWebp(bytes) {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new Error("WebP header is invalid.");
  }

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length =
      bytes[offset + 4] |
      (bytes[offset + 5] << 8) |
      (bytes[offset + 6] << 16) |
      (bytes[offset + 7] << 24);
    const padded = length + (length % 2);
    const end = offset + 8 + padded;
    if (length < 0 || end > bytes.length) {
      throw new Error("WebP chunk is truncated.");
    }
    if (type !== "EXIF" && type !== "XMP ") {
      chunks.push(bytes.slice(offset, end));
    }
    offset = end;
  }

  const body = concat(chunks);
  const output = new Uint8Array(12 + body.length);
  output.set([0x52, 0x49, 0x46, 0x46], 0);
  const riffSize = 4 + body.length;
  output[4] = riffSize & 0xff;
  output[5] = (riffSize >>> 8) & 0xff;
  output[6] = (riffSize >>> 16) & 0xff;
  output[7] = (riffSize >>> 24) & 0xff;
  output.set([0x57, 0x45, 0x42, 0x50], 8);
  output.set(body, 12);
  return output;
}

export function inspectOverheadImage(bytesValue, contentType) {
  const bytes = asBytes(bytesValue);
  const type = String(contentType ?? "").toLowerCase();

  if (type === "image/png") {
    return pngDimensions(bytes);
  }
  if (type === "image/jpeg") {
    return jpegDimensions(bytes);
  }
  if (type === "image/webp") {
    return webpDimensions(bytes);
  }
  throw new Error("Overhead maps support JPEG, PNG and WebP images only.");
}

export function sanitizeOverheadImage(bytesValue, contentType) {
  const bytes = asBytes(bytesValue);
  const type = String(contentType ?? "").toLowerCase();
  inspectOverheadImage(bytes, type);

  let sanitized;
  if (type === "image/png") {
    sanitized = sanitizePng(bytes);
  } else if (type === "image/jpeg") {
    sanitized = sanitizeJpeg(bytes);
  } else if (type === "image/webp") {
    sanitized = sanitizeWebp(bytes);
  } else {
    throw new Error("Overhead maps support JPEG, PNG and WebP images only.");
  }

  const dimensions = inspectOverheadImage(sanitized, type);
  return Object.freeze({
    bytes: sanitized,
    width: dimensions.width,
    height: dimensions.height,
    pixels: dimensions.pixels,
  });
}
