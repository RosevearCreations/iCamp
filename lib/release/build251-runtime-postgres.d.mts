export function inspectRuntimeDatabaseAdoption(): Promise<{
  status: string;
  runtimeTargetPinMatches: boolean;
  sourceRevision: string | null;
  checklist: Array<{
    name: string;
    present: boolean;
    rowLevelSecurity: boolean;
    forceRowLevelSecurity: boolean;
    ownerOnlyPolicies: boolean;
    appendOnly: boolean;
    hasGuardTrigger: boolean;
  }>;
  schemaVerified: boolean;
  independentlyApprovedProductionDatabase: false;
  masterConnected: false;
}>;
export function inspectProtectedOriginalSourceEnrollment(): {
  status: string;
  originalPinConfigured: boolean;
  independentReviewerAttested: boolean;
  receiptDigestSha256?: string;
  operationalSourceHealthy: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export function inspectBuild251Runtime(): Promise<{
  sourceRevision: string | null;
  database: Awaited<ReturnType<typeof inspectRuntimeDatabaseAdoption>>;
  signer: ReturnType<typeof inspectProtectedOriginalSourceEnrollment>;
  operationalApproval: "HOLD";
  masterConnected: false;
}>;
