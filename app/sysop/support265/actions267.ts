"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import { assignSupport267 } from "@/lib/campground-support267/postgres.mjs";

const path = "/sysop/support265";
export async function assignSupport267Action(form: FormData) {
  const { session } = await requireSysop(path);
  try {
    await assignSupport267({
      actorUserId: session.user.id,
      caseId: String(form.get("caseId") ?? ""),
      assigneeId: String(form.get("assigneeId") ?? ""),
      version: Number(form.get("version") ?? -1),
      escalate: form.get("escalate") === "yes",
    });
    revalidatePath(path);
  } catch {
    redirect(path + "?assignment=error");
  }
  redirect(path + "?assignment=saved");
}
