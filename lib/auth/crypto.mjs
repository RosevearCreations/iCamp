import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

export const passwordPolicy = Object.freeze({
  minLength: 12,
  maxLength: 128,
});

export function normalizeEmail(value) {
  return String(value).trim().normalize("NFKC").toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);

  if (email.length < 3 || email.length > 320) {
    return false;
  }

  const at = email.indexOf("@");
  const lastAt = email.lastIndexOf("@");

  return at > 0 && at === lastAt && at < email.length - 1;
}

export function validatePassword(value) {
  const password = String(value);

  if (
    password.length < passwordPolicy.minLength ||
    password.length > passwordPolicy.maxLength
  ) {
    return {
      ok: false,
      message: `Password must be between ${passwordPolicy.minLength} and ${passwordPolicy.maxLength} characters.`,
    };
  }

  return { ok: true, message: null };
}

export async function hashPassword(password) {
  const validation = validatePassword(password);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, encoded) {
  const parts = String(encoded).split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (
    n !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P ||
    !saltRaw ||
    !hashRaw
  ) {
    return false;
  }

  let salt;
  let expected;

  try {
    salt = Buffer.from(saltRaw, "base64url");
    expected = Buffer.from(hashRaw, "base64url");
  } catch {
    return false;
  }

  if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) {
    return false;
  }

  const actual = Buffer.from(
    await scrypt(String(password), salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    }),
  );

  return timingSafeEqual(actual, expected);
}

export function generateOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token) {
  return createHash("sha256").update(String(token), "utf8").digest();
}
