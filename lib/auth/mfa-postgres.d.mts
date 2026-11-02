export function beginTotpEnrollment(input: {
  userId: string;
  sessionId: string;
  password: string;
  username: string;
}): Promise<{ setupUri: string; seed: string } | null>;

export function verifyTotpForSession(input: {
  userId: string;
  sessionId: string;
  code: string;
}): Promise<boolean>;
