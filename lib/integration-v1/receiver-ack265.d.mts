export const ROSEVEAR_PEER_APPS265: readonly string[];
export interface VerifiedReceiverAck265 {
  appId: string;
  status: string;
  sourceSha: string;
  receiverSha: string;
  originalReceiptReference: string;
  expiresAt: string;
  remoteLiveTransportProven: false;
  permitsRemoteReboot: false;
  permitsSendingMessages: false;
  permitsPayments: false;
}
export function verifyOriginalReceiverAck265(input: {
  envelopeJson: string;
  appId: string;
  publicKeyPem: string;
  expectedSourceSha: string;
  expectedReceiverSha: string;
  independentlyEnrolled: boolean;
  now?: Date;
}): VerifiedReceiverAck265;
export function readReceiverMatrix265(
  env?: NodeJS.ProcessEnv,
  now?: Date,
): {
  status: string;
  records: Array<{
    appId: string;
    status: string;
    originalReceiptReference: string | null;
  }>;
  verifiedOriginalAckCount: number;
  independentlyConnected: false;
  rebootAcknowledged: false;
  automaticallyAuthorizedActions: false;
};
