export const BUILD252_MIGRATIONS: ReadonlyArray<{
  version: string;
  name: string;
  feature: string;
}>;
export interface Build252MigrationRecord {
  version: string;
  name: string;
  checksum_sha256: string;
}
export function assessBuild252MigrationHistory(input: {
  sourceRevision: string | null;
  targetIndependentlyPinned: boolean;
  querySucceeded: boolean;
  ledgerExists: boolean;
  records: Build252MigrationRecord[];
}): {
  status: string;
  details: Array<{
    version: string;
    feature: string;
    recordPresent: boolean;
    versionMatches: boolean;
    recordedChecksumWellFormed: boolean;
    sourceChecksumIndependentlyVerified: false;
  }>;
  ledgerEvidenceObserved: boolean;
  sourceChecksumIndependentlyVerified: false;
  productionMigrationApproved: false;
  ownerProductionAcceptance: "HOLD";
};
export function planBuild252Remediation(input: {
  database: {
    runtimeTargetPinMatches: boolean;
    schemaVerified: boolean;
    checklist: Array<{
      name: string;
      present: boolean;
      rowLevelSecurity: boolean;
      forceRowLevelSecurity: boolean;
      ownerOnlyPolicies: boolean;
      appendOnly: boolean;
      hasGuardTrigger: boolean;
    }>;
  } | null;
  signer: {
    independentReviewerAttested: boolean;
  } | null;
  migrationHistory: {
    ledgerEvidenceObserved: boolean;
  } | null;
}): {
  status: string;
  items: Array<{
    id: string;
    status: string;
    owner: string;
    action: string;
  }>;
  databaseMigrationMutationAttempted: false;
  signerProvisioned: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
