"use server";

import { requireStaff } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { getCampgroundReconciliation259 } from "@/lib/finance-reconciliation259/postgres.mjs";
import { evaluateClose260 } from "@/lib/finance-close260/core.mjs";
import { recordOwnerFinanceApproval260 } from "@/lib/finance-close260/postgres.mjs";
import { getPaymentProviderConfig } from "@/lib/payments/provider.mjs";

export type FinanceReviewState260 = {
  status: string;
  blockers: string[];
  invoiceCount: number;
  statementId: string | null;
  packageDigest: string | null;
  recordId: string | null;
};

export const initialFinanceReviewState260: FinanceReviewState260 = {
  status: "HOLD_NOT_REVIEWED",
  blockers: ["Provide independent provider, accounting and invoice/HST evidence."],
  invoiceCount: 0,
  statementId: null,
  packageDigest: null,
  recordId: null,
};

function field(data: FormData, name: string, max: number) {
  const value = data.get(name);
  if (typeof value !== "string" || value.length > max)
    throw new Error("Required " + name + " text is invalid or too large.");
  return value.trim();
}

export async function reviewFinanceClose260Action(
  _previous: FinanceReviewState260,
  form: FormData,
): Promise<FinanceReviewState260> {
  const path = "/workspaces/management/command/finance-close260";
  try {
    const session = await requireStaff(path);
    const campgroundId = field(form, "campgroundId", 80);
    const day = field(form, "day", 12);
    const signedProviderJson = field(form, "signedProviderJson", 90_000);
    const taxInvoiceCsv = field(form, "taxInvoiceCsv", 50_000);
    const accountingCsv = field(form, "accountingCsv", 12_000);
    const decision = field(form, "decision", 12);
    const reason = field(form, "reason", 700);
    const auth = await getCampgroundAuthorization(session.user.id, campgroundId);
    if (
      !auth ||
      !auth.permissions.some((key) => ["finance.read", "finance.manage"].includes(key)) ||
      !auth.permissions.some((key) => ["reservation.read", "reservation.modify"].includes(key))
    ) throw new Error("Current campground finance and reservation-read access is required.");

    const paymentProvider = getPaymentProviderConfig();
    const signer = {
      provider: process.env.ICAMP_SETTLEMENT260_PROVIDER?.trim() || "",
      keyId: process.env.ICAMP_SETTLEMENT260_KEY_ID?.trim() || "",
      publicKeyPem: process.env.ICAMP_SETTLEMENT260_PUBLIC_KEY_PEM?.replaceAll("\\n", "\n") || "",
    };
    if (paymentProvider.provider !== signer.provider || paymentProvider.mode !== "external")
      throw new Error("HOLD: live independent external payment provider is not enabled.");
    const snapshot = await getCampgroundReconciliation259({
      userId: session.user.id,
      campgroundId,
      localDate: day || undefined,
    });
    const report = evaluateClose260({
      snapshot,
      signedProviderJson,
      taxInvoiceCsv,
      accountingCsv,
      signer,
    });
    const state: FinanceReviewState260 = {
      status: report.status,
      blockers: report.blockers,
      invoiceCount: report.invoiceCount,
      statementId: report.settlement?.statementId ?? null,
      packageDigest: report.closePackageDigest,
      recordId: null,
    };
    if (decision !== "approve") return state;
    if (report.status !== "READY_FOR_OWNER_NONPOSTING_DECISION")
      return { ...state, blockers: [...state.blockers, "Owner approval was refused while evidence is on HOLD."] };
    const receipt = await recordOwnerFinanceApproval260({
      actorUserId: session.user.id,
      campgroundId,
      report,
      source: snapshot.source,
      reason,
      decision,
    });
    return {
      ...state,
      status: "OWNER_APPROVED_EVIDENCE_PACKET_NONPOSTING",
      recordId: receipt.id,
      blockers: [
        "Owner decision is non-posting. Independent bank clearing, HST filing and final accounting close remain separate.",
      ],
    };
  } catch (error) {
    return {
      ...initialFinanceReviewState260,
      blockers: [
        error instanceof Error ? error.message : "Financial close review unavailable.",
      ],
    };
  }
}
