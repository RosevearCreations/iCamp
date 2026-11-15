export function protectedThreeMasterFreshness(): ReturnType<
  typeof import("./build254-security-core.mjs").evaluateThreeMasterFreshness
>;
export function admitProtectedSourceReceipt(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  receiptType: string;
  masterPlane?: string | null;
}): Promise<{
  id: string;
  observedAt: string;
  status: string;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
}>;
export function recordIndependentRemediation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  sourceReceiptClaimId: string;
  decision: string;
  explanation: string;
}): Promise<{
  id: string;
  at: string;
  decision: string;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
}>;
export interface Build254Claims {
  status: string;
  claims: Array<{
    id: string;
    revision: string;
    receiptType: string;
    masterPlane: string | null;
    decision: string;
    claimedBy: string;
    at: string;
  }>;
  decisions: Array<{
    id: string;
    claimId: string;
    decision: string;
    reviewedBy: string;
    at: string;
  }>;
  truncated: boolean;
}
export function listSourceRemediationEvidence(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<Build254Claims>;
export function inspectBuild254Governance(): Promise<{
  sourceRevision: string | null;
  previous: Awaited<
    ReturnType<
      typeof import("./build253-provenance-postgres.mjs").inspectBuild253SupervisedReview
    >
  >;
  freshness: ReturnType<
    typeof import("./build254-security-core.mjs").evaluateThreeMasterFreshness
  >;
  security: ReturnType<
    typeof import("./build254-security-core.mjs").assessTieredSecurity
  >;
  sourceOnly: true;
  receiverConnected: false;
  ownerProductionAcceptance: "HOLD";
}>;
