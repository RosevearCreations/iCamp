export type DatabasePin287 = "unconfigured" | "matches" | "mismatch";

export interface AccountEvidence287 {
  sessionVerified: boolean;
  querySucceeded: boolean;
  hostPin: DatabasePin287;
  ownerBindingTable: boolean;
  migrationLedger: boolean;
  mfaVerified: boolean;
  mfaRequired: boolean;
  grantActive: boolean;
  bindingVerified: boolean;
}

export function databasePin287(
  connectionString?: string,
  expectedHost?: string,
): DatabasePin287;

export function assessAccount287(evidence: AccountEvidence287): string;
