"use server";

import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import { closeRecovery283 } from "@/lib/build283/postgres.mjs";

export async function closeRecovery283Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await closeRecovery283({
      actorId: session.user.id,
      id: String(form.get("id") ?? ""),
    });
  } catch {
    redirect("/sysop/acceptance283?result=hold");
  }
  redirect("/sysop/acceptance283?result=recorded");
}
