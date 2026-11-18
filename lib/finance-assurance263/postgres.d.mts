export function inspectFinancialEvidence263(env?: NodeJS.ProcessEnv): Promise<{
  status: string;
  blockers: string[];
  signedEvidenceStatus: string;
  evidenceCurrency: string | null;
  evidenceStatementId: string | null;
  evidenceAmountCents: number | null;
  independentBankApiConfirmed: false;
  moneyMovementPerformed: false;
}>;
