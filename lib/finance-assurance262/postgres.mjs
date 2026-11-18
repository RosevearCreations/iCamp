import { inspectFinancialAssurance261 } from "../finance-assurance261/postgres.mjs";
import {
  createPaymentProviderAdapter,
  getPaymentProviderConfig,
} from "../payments/provider.mjs";
import {
  createRefundProviderAdapter,
  getRefundProviderConfig,
} from "../refunds/provider.mjs";
import {
  assessFinancialActivation262,
  verifyDbCustody262,
} from "./core.mjs";

function runtimeDatabaseHost(env) {
  try {
    return new URL(env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    return "";
  }
}
function adapterReadiness(env) {
  const paymentConfig = getPaymentProviderConfig(env);
  const refundConfig = getRefundProviderConfig(env);
  if (
    paymentConfig.provider === "mock" ||
    refundConfig.provider !== paymentConfig.provider
  ) return { paymentReady: false, refundReady: false };
  // Factories must reject unavailable real adapters. Never call a remote
  // provider or initiate capture/refund merely to calculate readiness.
  let paymentReady = false;
  let refundReady = false;
  try {
    const adapter = createPaymentProviderAdapter(paymentConfig);
    paymentReady =
      adapter.mode === "external" &&
      adapter.providerKey === paymentConfig.provider &&
      typeof adapter.createPayment === "function" &&
      typeof adapter.capturePayment === "function";
  } catch {
    paymentReady = false;
  }
  try {
    const adapter = createRefundProviderAdapter(refundConfig);
    refundReady =
      adapter.mode === "external" &&
      adapter.providerKey === refundConfig.provider &&
      typeof adapter.refundPayment === "function";
  } catch {
    refundReady = false;
  }
  return { paymentReady, refundReady };
}

/**
 * Fail closed and never export original database hostname, signed payloads,
 * payment credentials or the independent reviewer's public key.
 */
export async function inspectFinancialAssurance262(
  env = process.env,
  existing261 = null,
) {
  const previous = existing261 ?? (await inspectFinancialAssurance261(env));
  const production = env.VERCEL_ENV === "production";
  const actualHost = production ? runtimeDatabaseHost(env) : "";
  const expectedHost =
    env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST?.trim().toLowerCase() ?? "";
  let custody = null;
  let custodyError = null;
  try {
    custody = verifyDbCustody262({
      envelopeJson: env.ICAMP_DB_CUSTODY262_ENVELOPE_JSON ?? "",
      actualDatabaseHost: actualHost,
      expectedDatabaseHost: expectedHost,
      sourceRevision: previous.revision ?? "",
      custodianPublicKeyPem:
        env.ICAMP_DB_CUSTODY262_CUSTODIAN_PUBLIC_KEY_PEM?.replaceAll(
          "\\n",
          "\n",
        ) ?? "",
      reviewerPublicKeyPem:
        env.ICAMP_DB_CUSTODY262_REVIEWER_PUBLIC_KEY_PEM?.replaceAll(
          "\\n",
          "\n",
        ) ?? "",
      custodianIndependentlyEnrolled:
        env.ICAMP_DB_CUSTODY262_CUSTODIAN_ENROLLED === "true",
      reviewerIndependentlyEnrolled:
        env.ICAMP_DB_CUSTODY262_REVIEWER_ENROLLED === "true",
    });
  } catch (error) {
    custodyError =
      error instanceof Error ? error.message : "Independent custody unavailable.";
  }
  const adapter = adapterReadiness(env);
  const activation = assessFinancialActivation262({
    migration: previous.migration,
    providerEnrollment: previous.enrollmentStatus,
    dbCustody: custody,
    paymentAdapterReady: adapter.paymentReady,
    refundAdapterReady: adapter.refundReady,
    // A signed bank settlement receipt must be verified by a separate
    // provider/bank adapter; there is currently no such original adapter.
    independentBankReceiptPresent: false,
  });
  if (custodyError) activation.blockers.push(custodyError);
  return {
    sourceRevision: previous.revision,
    migrationStatus: previous.migration.status,
    providerEnrollmentStatus: previous.enrollmentStatus,
    custodyStatus: custody?.status ?? "HOLD_ORIGINAL_DB_CUSTODY_NOT_ENROLLED",
    custodyExpiresAt: custody?.expiresAt ?? null,
    paymentAdapterReady: adapter.paymentReady,
    refundAdapterReady: adapter.refundReady,
    activation,
    independentlyVerifiedBankSettlement: false,
    ownerDecisionEffect: "REVIEW_ONLY_NONPOSTING",
  };
}
