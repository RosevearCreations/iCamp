import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0;
  let buffer = 0;
  let result = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) {
    result += ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(secret) {
  const value = String(secret).replace(/=+$/u, "").toUpperCase();
  if (!/^[A-Z2-7]{32}$/u.test(value)) {
    throw new Error("Invalid TOTP seed.");
  }
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const char of value) {
    buffer = (buffer << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 255);
    }
  }
  return Buffer.from(output);
}

export function generateTotpSeed() {
  return base32Encode(randomBytes(20));
}

export function totpAtStep(seed, step) {
  if (!Number.isSafeInteger(step) || step < 0) {
    throw new Error("Invalid TOTP step.");
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(seed)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(number).padStart(6, "0");
}

export function acceptedTotpStep(seed, code, lastStep = -1, now = Date.now()) {
  if (!/^\d{6}$/u.test(String(code)) || !Number.isFinite(now)) {
    return null;
  }
  const current = Math.floor(now / 30_000);
  for (const step of [current - 1, current, current + 1]) {
    if (step < 0 || step <= lastStep) {
      continue;
    }
    const expected = Buffer.from(totpAtStep(seed, step));
    if (timingSafeEqual(expected, Buffer.from(String(code)))) {
      return step;
    }
  }
  return null;
}

function getEncryptionKey(key = process.env.ICAMP_MFA_ENCRYPTION_KEY) {
  if (!key || !/^[A-Za-z0-9_-]{43,44}$/u.test(key)) {
    throw new Error("Server-only MFA encryption key is not configured.");
  }
  const bytes = Buffer.from(key, "base64url");
  if (bytes.length !== 32) {
    throw new Error("MFA encryption key must be 32 bytes.");
  }
  return bytes;
}

export function sealTotpSeed(seed, userId, key) {
  base32Decode(seed);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(key), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(seed, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function openTotpSeed(envelope, userId, key) {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(envelope).split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted TOTP envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(key), Buffer.from(ivRaw, "base64url"));
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const seed = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
  base32Decode(seed);
  return seed;
}

export function totpSetupUri(username, seed) {
  base32Decode(seed);
  return "otpauth://totp/" + encodeURIComponent("iCamp:" + String(username)) + "?secret=" + seed + "&issuer=iCamp&algorithm=SHA1&digits=6&period=30";
}
