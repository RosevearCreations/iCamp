export const VERIFICATION_CODE_DIGITS: number;
export const STAFF_PIN_MIN_DIGITS: number;
export const STAFF_PIN_MAX_DIGITS: number;
export const VERIFICATION_MAX_ATTEMPTS: number;
export const VERIFICATION_CHALLENGE_SECONDS: number;
export const VERIFICATION_LOCK_SECONDS: number;
export const VERIFICATION_ISSUE_WINDOW_SECONDS: number;
export const VERIFICATION_ISSUE_LIMIT: number;

export type VerificationChannel = "voice" | "sms";
export type VerificationActorKind = "guest" | "staff";
export type VerificationPurpose =
  "guest_lookup" | "staff_access" | "staff_privileged";
export type VerificationSubjectKind = "site" | "reservation" | "pass" | "staff";

export function normalizeVerificationChannel(
  value: unknown,
): VerificationChannel;
export function normalizeVerificationActorKind(
  value: unknown,
): VerificationActorKind;
export function normalizeVerificationPurpose(
  value: unknown,
): VerificationPurpose;
export function normalizeVerificationSubjectKind(
  value: unknown,
): VerificationSubjectKind;
export function normalizeSubjectReference(value: unknown): string;
export function hashSubjectReference(
  subjectKind: VerificationSubjectKind,
  value: unknown,
): Promise<string>;
export function verifySubjectReference(
  subjectKind: VerificationSubjectKind,
  value: unknown,
  encodedHash: string,
): Promise<boolean>;
export function normalizeVerificationCode(value: unknown): string;
export function generateVerificationCode(): string;
export function hashVerificationCode(value: unknown): Promise<string>;
export function verifyVerificationCode(
  value: unknown,
  encodedHash: string,
): Promise<boolean>;
export function normalizeStaffPin(value: unknown): string;
export function hashStaffPin(value: unknown): Promise<string>;
export function verifyStaffPin(
  value: unknown,
  encodedHash: string,
): Promise<boolean>;
export function requiredVerificationFactors(input: {
  actorKind: VerificationActorKind;
  purpose: VerificationPurpose;
  riskLevel?: "standard" | "elevated" | "high";
}): readonly string[];
export function evaluateVerificationAvailability(input: {
  status: string;
  expiresAt: Date | string;
  lockedUntil?: Date | string | null;
  attemptCount?: number;
  maxAttempts?: number;
  now?: Date | string;
}): { usable: boolean; reason: string | null };
export function mergeFraudSignals(existing: unknown, signal: unknown): string[];
export function sanitizeVerificationChallenge(
  row: Record<string, unknown> | null,
): Record<string, unknown> | null;
