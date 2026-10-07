export interface VerificationChallenge {
  id: string;
  organizationId: string;
  campgroundId: string;
  channel: "voice" | "sms";
  actorKind: "guest" | "staff";
  purpose: "guest_lookup" | "staff_access" | "staff_privileged";
  subjectKind: "site" | "reservation" | "pass" | "staff";
  status: "pending" | "satisfied" | "locked" | "expired" | "cancelled";
  attemptCount: number;
  maxAttempts: number;
  assuranceLevel: "aal1" | "aal2" | null;
  expiresAt: string | Date | null;
  satisfiedAt: string | Date | null;
  lockedUntil: string | Date | null;
  fraudSignals: string[];
  secretsExcluded: true;
  callerOrSenderHintIsAuthentication: false;
}

export function setStaffChannelPin(input: {
  userId: string;
  pin: string;
}): Promise<{ userId: string; changedAt: string | Date; rawPinExcluded: true }>;

export function issueGuestVerificationChallenge(input: {
  organizationId: string;
  campgroundId: string;
  remoteEndpointId: string;
  channel: "voice" | "sms";
  subjectKind: "site" | "reservation" | "pass";
  subjectReference: string;
  maxAttempts?: number;
  codeFactory?: () => string;
  deliverCode?:
    | ((input: {
        challengeId: string;
        organizationId: string;
        campgroundId: string;
        remoteEndpointId: string;
        channel: "voice" | "sms";
        code: string;
      }) => Promise<void> | void)
    | null;
}): Promise<VerificationChallenge>;

export function issueStaffVerificationChallenge(input: {
  organizationId: string;
  campgroundId: string;
  remoteEndpointId: string;
  channel: "voice" | "sms";
  userId: string;
  purpose?: "staff_access" | "staff_privileged";
  maxAttempts?: number;
  codeFactory?: () => string;
  deliverCode?:
    | ((input: {
        challengeId: string;
        organizationId: string;
        campgroundId: string;
        remoteEndpointId: string;
        channel: "voice" | "sms";
        code: string;
      }) => Promise<void> | void)
    | null;
}): Promise<VerificationChallenge>;

export function verifyGuestVerificationChallenge(input: {
  challengeId: string;
  subjectReference: string;
  verificationCode: string;
}): Promise<{ verified: boolean; challenge: VerificationChallenge }>;

export function verifyStaffChannelPin(input: {
  challengeId: string;
  userId: string;
  pin: string;
}): Promise<{
  verified: boolean;
  requiresSecondFactor?: boolean;
  challenge: VerificationChallenge;
}>;

export function verifyStaffOneTimeCode(input: {
  challengeId: string;
  userId: string;
  verificationCode: string;
}): Promise<{ verified: boolean; challenge: VerificationChallenge }>;

export function completeStaffChallengeWithRecentSession(input: {
  challengeId: string;
  userId: string;
  sessionId: string;
}): Promise<{ verified: boolean; challenge: VerificationChallenge }>;

export function assertChannelVerificationGrant(input: {
  challengeId: string;
  userId: string;
  campgroundId: string;
  permission: string;
  riskLevel?: "standard" | "elevated" | "high";
  reason?: string;
}): Promise<Record<string, unknown>>;

export function getChannelVerificationHealth(): Promise<{
  status: "operational" | "degraded";
  challenges: {
    pending: number;
    satisfied24h: number;
    locked24h: number;
    flagged24h: number;
  };
  attempts: { rejected24h: number };
  staffPins: { locked: number };
  privacy: {
    rawSecretsExcluded: true;
    callerOrSenderHintIsAuthentication: false;
  };
}>;

export function closeVerificationPoolForTests(): Promise<void>;
