export interface Build253Row {
  version: string;
  name: string;
  checksum_sha256: string;
}
export interface Build253Reconciliation {
  status: string;
  rows: Array<{
    version: string;
    found: boolean;
    nameMatches: boolean;
    checksumMatches: boolean;
    canonicalSource: string;
  }>;
  sourceChecksumsMatch: boolean;
  independentDatabaseProvenance: false;
  realSchemaMigrationAdoptionApproved: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
}
export function sha256Text(value: string): string;
export function reconcileCanonicalMigrationChecksums(input: {
  sourceRevision: string | null;
  hostnameMatchesConfiguredPin: boolean;
  querySucceeded: boolean;
  ledgerExists: boolean;
  records: Build253Row[];
}): Build253Reconciliation;
export interface Build253SignerPin {
  keyId: string;
  publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export interface Build253Receipt {
  schema: string;
  sourceId: string;
  sourceRevision: string;
  reviewerKeyId: string;
  decision: string;
  databaseHostnameSha256: string;
  migrationManifestSha256: string;
  observedAt: string;
  nonce: string;
  signatureBase64: string;
}
export function databaseProvenanceReceiptMessage(
  receipt: Build253Receipt,
): string;
export function verifyIndependentDatabaseProvenance(input: {
  sourceRevision: string | null;
  databaseHostname: string | null;
  reconciled: Build253Reconciliation;
  reviewerEnrolled: boolean;
  reviewerPin: Build253SignerPin | null;
  originalSourceEnrolled: boolean;
  originalSourcePin: Build253SignerPin | null;
  receipt: Build253Receipt | null;
  asOf: string;
}): {
  status: string;
  signatureVerified: boolean;
  independentDatabaseProvenance: boolean;
  receiptDigestSha256: string | null;
  originalSourceHealthy: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export function superviseRemediationEvidence(input: {
  checksum: Build253Reconciliation;
  provenance: {
    independentDatabaseProvenance: boolean;
  };
  prior: {
    database: { schemaVerified: boolean };
  } | null;
}): {
  status: string;
  tasks: Array<{
    id: string;
    owner: string;
    status: string;
    action: string;
  }>;
  productionMigrationApproved: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
