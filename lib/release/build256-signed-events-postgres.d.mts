export function admitProtectedSignedEvent(input: {
  actorUserId: string;
  actorSessionId: string | null;
  campgroundId: string;
}): Promise<{
  id: string;
  status: string;
  receiverConnected: false;
  ownerAcceptance: "HOLD";
}>;
export function recordIndependentSignedRevocation(input: {
  actorUserId: string;
  actorSessionId: string | null;
  campgroundId: string;
  revokedReceiptId: string;
  signedRevocationReceiptId: string;
  reasonCode: string;
}): Promise<{
  id: string;
  status: string;
  outboxCount: number;
  receiverConnected: false;
  ownerAcceptance: "HOLD";
}>;
export function listSignedEventCustody(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<{
  status: string;
  receipts: Array<{
    id: string;
    sourceApp: string;
    eventType: string;
    at: string;
    expiresAt: string;
    digest: string;
    revokesDigest: string | null;
  }>;
  revocations: Array<{
    id: string;
    receiptId: string;
    signedRevocationId: string;
    reasonCode: string;
    at: string;
  }>;
  outbox: Array<{
    id: string;
    revocationId: string;
    targetApp: string;
    status: string;
    at: string;
  }>;
}>;
