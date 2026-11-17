export const BUILD261_MIGRATION: Readonly<{
  version: string;
  name: string;
  checksumSha256: string;
}>;
export function sha256Text261(value: string): string;
export interface ProviderEnrollment261 {
  status: string;
  provider: string;
  keyId: string;
  sourceRevision: string;
  expiresAt: string;
  enrollmentDigestSha256: string;
  independentlyVerifiedInstitutionalIdentity: boolean;
}
export function verifyProviderEnrollment261(input: {
  envelopeJson: string;
  provider: string;
  keyId: string;
  providerPublicKeyPem: string;
  reviewerPublicKeyPem: string;
  reviewerIndependentlyEnrolled: boolean;
  sourceRevision: string;
  now?: Date;
}): ProviderEnrollment261;
export interface MigrationReadback261 {
  status: string;
  blockers: string[];
  expectedMigrationVersion: string;
  expectedMigrationChecksumSha256: string;
  verifiedOnProductionDatabase: boolean;
  independentlySignedDatabaseCustody: boolean;
}
export function assessMigrationReadback261(input: {
  runtimeProduction: boolean;
  revision: string | null;
  targetPinned: boolean;
  ledgerExists: boolean;
  ledgerReadSucceeded: boolean;
  record: { version: string; name: string; checksum_sha256: string } | null;
  schema: {
    forceRls: boolean;
    guardPresent: boolean;
    scopedPolicyCount: number;
    mutableGrantPresent: boolean;
  } | null;
}): MigrationReadback261;
export interface Assurance261 {
  approvalEligible: boolean;
  status: string;
  blockers: string[];
  livePaymentsEnabled: boolean;
  bankSettlementCertified: boolean;
  statutoryTaxCloseCertified: boolean;
  externalProviderAdapterInstalled: boolean;
}
export function evaluateAssurance261(input: {
  migration: MigrationReadback261;
  enrollment: ProviderEnrollment261 | null;
  configuredProvider: string;
  expectedProvider: string;
  revision: string | null;
}): Assurance261;
