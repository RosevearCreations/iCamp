export function listOriginalDeviceWitnessAdmissions(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  witnesses: Array<{
    id: string;
    dispatchId: string;
    signatureVerificationId: string;
    originalReviewId: string;
    sourceRevision: string;
    decision: string;
    admittedAt: string;
  }>;
  truncated: boolean;
  originalDeviceIndependentAcceptance: "HOLD";
  ownerAcceptance: "HOLD";
  masterConnected: false;
}>;
export function admitOriginalDeviceWitness(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  verificationId: string;
  decision: string;
  explanation: string;
}): Promise<{
  id: string;
  decision: string;
  originalDeviceAcceptance: "HOLD";
}>;
export function readCrossMasterProtectedEvidence(input: {
  sourceRevision: string | null;
  asOf: string;
}): {
  schema: string;
  sourceId: "icamp";
  sourceRevision: string | null;
  evidence: Array<{ plane: string; status: string }>;
  allIndependentlySigned: boolean;
  sourceSignerAccepted: false;
  connected: false;
  ownerAccepted: false;
  decision: string;
};
