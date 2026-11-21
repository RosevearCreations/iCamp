"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSysop } from "@/lib/platform/access";
import { recordRestoreWitness269 } from "@/lib/campground-pilot269/postgres.mjs";

const path = "/sysop/pilot269";
export async function recordRestoreWitness269Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordRestoreWitness269({
      actorUserId: session.user.id,
      kind: String(form.get("kind") ?? ""),
      backupDigestSha256: String(form.get("backupDigestSha256") ?? ""),
      evidenceDigestSha256: String(form.get("evidenceDigestSha256") ?? ""),
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(path + "?error=witness");
  }
  redirect(path + "?saved=witness");
}
