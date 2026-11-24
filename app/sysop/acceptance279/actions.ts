"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import {
  recordProviderCorrelation279,
  recordOwnerRecoveryAudit279,
  recordIsolatedRestoreFinalization279,
} from "@/lib/build279/postgres.mjs";

const route = "/sysop/acceptance279";
export async function correlateProviderReceipt279Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordProviderCorrelation279({
      reviewerId: session.user.id,
      fieldReviewId: String(form.get("fieldReviewId") ?? ""),
      providerReceiptId: String(form.get("providerReceiptId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?correlation=hold");
  }
  redirect(route + "?correlation=recorded");
}
export async function originalRecoveryAudit279Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordOwnerRecoveryAudit279({
      auditorId: session.user.id,
      mfaReadbackId: String(form.get("mfaReadbackId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?owner=hold");
  }
  redirect(route + "?owner=recorded");
}
export async function isolatedRestoreFinalization279Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordIsolatedRestoreFinalization279({
      reviewerId: session.user.id,
      serviceReadbackId: String(form.get("serviceReadbackId") ?? ""),
      backupDigest: String(form.get("backupDigest") ?? ""),
      tenantDigest: String(form.get("tenantDigest") ?? ""),
      reservationDigest: String(form.get("reservationDigest") ?? ""),
      paymentDigest: String(form.get("paymentDigest") ?? ""),
      healthDigest: String(form.get("healthDigest") ?? ""),
      comparisonDigest: String(form.get("comparisonDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?restore=hold");
  }
  redirect(route + "?restore=recorded");
}
