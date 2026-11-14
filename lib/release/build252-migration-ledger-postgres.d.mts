export function inspectBuild252MigrationLedger(): Promise<{
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
}>;
export function inspectBuild252ReleaseReadiness(): Promise<{
  previous: Awaited<
    ReturnType<
      typeof import("./build251-runtime-postgres.mjs").inspectBuild251Runtime
    >
  >;
  migrationHistory: Awaited<ReturnType<typeof inspectBuild252MigrationLedger>>;
  remediation: ReturnType<
    typeof import("./build252-migration-ledger-core.mjs").planBuild252Remediation
  >;
  operationalAcceptance: "HOLD";
  masterConnected: false;
}>;
