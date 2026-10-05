export const passwordPolicy: Readonly<{
  minLength: number;
  maxLength: number;
}>;

export function normalizeEmail(value: unknown): string;
export function validateEmail(value: unknown): boolean;
export function validatePassword(
  value: unknown,
): { ok: true; message: null } | { ok: false; message: string };
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean>;
export function generateOpaqueToken(): string;
export function hashOpaqueToken(token: string): Buffer;
