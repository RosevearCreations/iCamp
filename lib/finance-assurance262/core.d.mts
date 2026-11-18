import type { MigrationReadback261 } from "../finance-assurance261/core.mjs";

export interface DatabaseCustody262 {
  status: string;
  expiresAt: string;
  sourceRevision: string;
  custodyDigestSha256: string;
  bankSettlementCertified: boolean;
  independentlyVerifiedLegalIdentity: boolean;
}

export function sha256Custody262(value: string): string;
export function verifyDbCustody262(input: {
  envelopeJson: string;
  actualDatabaseHost: string;
  expectedDatabaseHost: string;
  sourceRevision: string;
  custodianPublicKeyPem: string;
  reviewerPublicKeyPem: string;
  custodianIndependentlyEnrolled: boolean;
  reviewerIndependentlyEnrolled: boolean;
  now?: Date;
}): DatabaseCustody262;
export interface FinancialActivation262 {
  status: string;
  ownerEvidenceEligible: boolean;
  settlementActivationEligible: boolean;
  blockers: string[];
  actualPaymentCaptured: boolean;
  bankSettled: boolean;
  accountingClosed: boolean;
  hstFiled: boolean;
}
export function assessFinancialActivation262(input: {
  migration: MigrationReadback261;
  providerEnrollment: string;
  dbCustody: DatabaseCustody262 | null;
  paymentAdapterReady: boolean;
  refundAdapterReady: boolean;
  independentBankReceiptPresent?: boolean;
}): FinancialActivation262;
