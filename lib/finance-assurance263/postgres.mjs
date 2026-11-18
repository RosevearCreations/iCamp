import { inspectFinancialAssurance262 } from "../finance-assurance262/postgres.mjs";
import {
  financialCloseReadiness263,
  verifyIndependentFinancialEvidence263,
} from "./core.mjs";

/**
 * Observe original signed statements without creating any bank or payment
 * operations. No private keys or original financial documents are returned.
 */
export async function inspectFinancialEvidence263(env = process.env) {
  const prior = await inspectFinancialAssurance262(env);
  let evidence = null;
  let issue = null;
  try {
    evidence = verifyIndependentFinancialEvidence263({
      envelopeJson: env.ICAMP_FINANCIAL263_ENVELOPE_JSON ?? "",
      provider: env.ICAMP_SETTLEMENT260_PROVIDER ?? "",
      statementId: env.ICAMP_FINANCIAL263_STATEMENT_ID ?? "",
      statementDigestSha256: env.ICAMP_FINANCIAL263_STATEMENT_DIGEST_SHA256 ?? "",
      sourceRevision: prior.sourceRevision ?? "",
      issuerPublicKeyPem:
        env.ICAMP_FINANCIAL263_ISSUER_PUBLIC_KEY_PEM?.replaceAll(
          "\\n",
          "\n",
        ) ?? "",
      reviewerPublicKeyPem:
        env.ICAMP_FINANCIAL263_REVIEWER_PUBLIC_KEY_PEM?.replaceAll(
          "\\n",
          "\n",
        ) ?? "",
      issuerIndependentlyEnrolled:
        env.ICAMP_FINANCIAL263_ISSUER_ENROLLED === "true",
      reviewerIndependentlyEnrolled:
        env.ICAMP_FINANCIAL263_REVIEWER_ENROLLED === "true",
    });
  } catch (error) {
    issue = error instanceof Error ? error.message : "Financial evidence HOLD.";
  }
  const readiness = financialCloseReadiness263({
    originalMigrationMatched:
      prior.migrationStatus === "PINNED_RUNTIME_LEDGER_AND_SCHEMA_MATCH",
    originalDbCustody:
      prior.custodyStatus === "DUAL_SIGNED_ORIGINAL_DB_CUSTODY_OBSERVED",
    signedFinancialEvidence: Boolean(evidence),
    originalBankApiReadback: false,
  });
  if (issue) readiness.blockers.push(issue);
  return {
    status: readiness.status,
    blockers: readiness.blockers,
    signedEvidenceStatus: evidence?.status ?? "HOLD_NO_EXTERNAL_SIGNED_EVIDENCE",
    evidenceCurrency: evidence?.currencyCode ?? null,
    evidenceStatementId: evidence?.statementId ?? null,
    evidenceAmountCents: evidence?.netAmountCents ?? null,
    independentBankApiConfirmed: false,
    moneyMovementPerformed: false,
  };
}
