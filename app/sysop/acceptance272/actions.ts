"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSysop } from "@/lib/platform/access";
import {
  recordOwnerLogin272,
  recordCommsReview272,
  recordRestoreDryRun272,
} from "@/lib/build272/postgres.mjs";
const route = "/sysop/acceptance272";
export async function witnessOwnerLogin272Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordOwnerLogin272({
      reviewerId: session.user.id,
      sessionId: String(form.get("sessionId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(route + "?owner=hold");
  }
  redirect(route + "?owner=recorded");
}
export async function reviewCommsIncident272Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordCommsReview272({
      reviewerId: session.user.id,
      outboxId: String(form.get("outboxId") ?? ""),
      attemptId: String(form.get("attemptId") ?? ""),
      deliveredReceiptId: String(form.get("deliveredReceiptId") ?? ""),
      sourcePairId: String(form.get("sourcePairId") ?? ""),
      masterKind: String(form.get("masterKind") ?? ""),
      externalAckDigest: String(form.get("externalAckDigest") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(route + "?comms=hold");
  }
  redirect(route + "?comms=recorded");
}
export async function reviewRestoreDryRun272Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordRestoreDryRun272({
      reviewerId: session.user.id,
      backupDigest: String(form.get("backupDigest") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(route + "?restore=hold");
  }
  redirect(route + "?restore=recorded");
}
