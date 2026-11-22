"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSysop } from "@/lib/platform/access";
import {
  recordOwnerCeremony271,
  recordRestoreReplay271,
} from "@/lib/build271/postgres.mjs";
const route = "/sysop/enrollment271";
export async function recordOwnerStage271Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordOwnerCeremony271({
      actorUserId: session.user.id,
      stage: String(form.get("stage") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(route + "?owner271=hold");
  }
  redirect(route + "?owner271=recorded");
}
export async function recordRestoreReplay271Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordRestoreReplay271({
      actorUserId: session.user.id,
      backupDigest: String(form.get("backupDigest") ?? ""),
      snapshot: String(form.get("snapshot") ?? ""),
      kind: String(form.get("kind") ?? ""),
      fingerprint: String(form.get("fingerprint") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(route + "?replay271=hold");
  }
  redirect(route + "?replay271=recorded");
}
