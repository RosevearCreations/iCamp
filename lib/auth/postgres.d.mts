export type AccountType = "guest" | "staff";
export type AssuranceLevel = "aal1" | "aal2";

export interface AuthenticatedUser {
  id: string;
  email: string;
  accountType: AccountType;
  emailVerifiedAt: string | Date | null;
  mfaRequired: boolean;
}

export interface ActiveSession {
  sessionId: string;
  assuranceLevel: AssuranceLevel;
  createdAt: string | Date;
  expiresAt: string | Date;
  user: AuthenticatedUser;
}

export function createGuestAccount(input: {
  email: string;
  password: string;
}): Promise<AuthenticatedUser>;

export function createStaffAccountForBootstrap(input: {
  email: string;
  password: string;
}): Promise<AuthenticatedUser>;

export function authenticatePassword(input: {
  email: string;
  password: string;
}): Promise<AuthenticatedUser | null>;

export function createSession(input: {
  userId: string;
  assuranceLevel?: AssuranceLevel;
  expiresInSeconds?: number;
}): Promise<{ token: string; sessionId: string; expiresAt: string | Date }>;

export function getSessionByToken(
  rawToken: string,
): Promise<ActiveSession | null>;

export function revokeSessionByToken(
  rawToken: string,
  reason?: string,
): Promise<boolean>;

export function issuePasswordRecovery(input: {
  email: string;
}): Promise<{ userId: string; email: string; token: string } | null>;

export function resetPasswordWithToken(input: {
  token: string;
  newPassword: string;
}): Promise<boolean>;

export function closeAuthPoolForTests(): Promise<void>;
