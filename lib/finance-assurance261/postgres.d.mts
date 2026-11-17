import type {
  Assurance261,
  MigrationReadback261,
} from "./core.mjs";

export interface FinanceAssuranceSnapshot261 {
  revision: string | null;
  migration: MigrationReadback261;
  enrollmentStatus: string;
  enrollmentExpiresAt: string | null;
  assurance: Assurance261;
  independentDatabaseHostIdentityConfirmed: boolean;
  liveSettlementActivationStatus: string;
  ownerEvidenceDecisionStatus: string;
}

export function inspectFinancialAssurance261(
  env?: NodeJS.ProcessEnv,
): Promise<FinanceAssuranceSnapshot261>;
