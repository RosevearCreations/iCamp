import type { FinancialActivation262 } from "./core.mjs";
import type { FinanceAssuranceSnapshot261 } from "../finance-assurance261/postgres.mjs";
export interface FinancialAssuranceSnapshot262 {
  sourceRevision: string | null;
  migrationStatus: string;
  providerEnrollmentStatus: string;
  custodyStatus: string;
  custodyExpiresAt: string | null;
  paymentAdapterReady: boolean;
  refundAdapterReady: boolean;
  activation: FinancialActivation262;
  independentlyVerifiedBankSettlement: boolean;
  ownerDecisionEffect: string;
}
export function inspectFinancialAssurance262(
  env?: NodeJS.ProcessEnv,
  existing261?: FinanceAssuranceSnapshot261 | null,
): Promise<FinancialAssuranceSnapshot262>;
