"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSysop } from "@/lib/platform/access";
import {
  recordSourceEnrollment273,
  recordSignedIncidentClosure273,
} from "@/lib/build273/postgres.mjs";
const url = "/sysop/acceptance273";
export async function witnessSourceEnrollment273Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordSourceEnrollment273({
      reviewerId: session.user.id,
      sourcePairId: String(form.get("sourcePairId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(url);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(url + "?source=hold");
  }
  redirect(url + "?source=recorded");
}
export async function witnessIncidentClosure273Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordSignedIncidentClosure273({
      reviewerId: session.user.id,
      outboxId: String(form.get("outboxId") ?? ""),
      consumerAckId: String(form.get("consumerAckId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(url);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(url + "?incident=hold");
  }
  redirect(url + "?incident=recorded");
}
