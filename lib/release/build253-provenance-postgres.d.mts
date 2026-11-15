export function inspectBuild253CanonicalReconciliation(): Promise<{
  checksum: ReturnType<
    typeof import("./build253-provenance-core.mjs").reconcileCanonicalMigrationChecksums
  >;
  host: string | null;
}>;
export function inspectBuild253SupervisedReview(): Promise<{
  sourceRevision: string | null;
  checksum: ReturnType<
    typeof import("./build253-provenance-core.mjs").reconcileCanonicalMigrationChecksums
  >;
  provenance: ReturnType<
    typeof import("./build253-provenance-core.mjs").verifyIndependentDatabaseProvenance
  >;
  supervised: ReturnType<
    typeof import("./build253-provenance-core.mjs").superviseRemediationEvidence
  >;
  previousDatabaseStatus: string;
  previousSourceCustodyStatus: string;
  formalOwnerAcceptance: "HOLD";
  receiverConnected: false;
}>;
