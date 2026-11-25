"use server";

import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import { openRecovery282, recordDelivery282 } from "@/lib/build282/postgres.mjs";

const route = "/sysop/acceptance282";

export async function openRecovery282Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await openRecovery282({
      actorId: session.user.id,
      ackId: String(form.get("ackId") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
  } catch {
    redirect(route + "?result=hold");
  }
  redirect(route + "?result=opened");
}

export async function recordDelivery282Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordDelivery282({
      actorId: session.user.id,
      id: String(form.get("id") ?? ""),
      body: String(form.get("body") ?? ""),
      signature: String(form.get("signature") ?? ""),
    });
  } catch {
    redirect(route + "?result=hold");
  }
  redirect(route + "?result=reviewed");
}
