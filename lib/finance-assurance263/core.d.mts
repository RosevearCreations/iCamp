export interface VerifiedFinancialEvidence263 {
  status: string;
  sourceRevision: string;
  statementId: string;
  netAmountCents: number;
  currencyCode: string;
  evidenceDigestSha256: string;
  externallyConfirmedBankDeposit: false;
  legalProviderIdentityVerified: false;
  liveSettlementAuthority: false;
}
export function verifyIndependentFinancialEvidence263(input: {
  envelopeJson: string;
  provider: string;
  statementId: string;
  statementDigestSha256: string;
  sourceRevision: string;
  issuerPublicKeyPem: string;
  reviewerPublicKeyPem: string;
  issuerIndependentlyEnrolled: boolean;
  reviewerIndependentlyEnrolled: boolean;
  now?: Date;
}): VerifiedFinancialEvidence263;
export function financialCloseReadiness263(input: {
  originalMigrationMatched: boolean;
  originalDbCustody: boolean;
  signedFinancialEvidence: boolean;
  originalBankApiReadback: boolean;
}): {
  status: string;
  blockers: string[];
  evidencePacketReadyForManualReview: boolean;
  actualBankSettlementConfirmed: false;
  livePaymentActivation: false;
  statutoryClose: false;
};
