"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import {
  adoptOwnerPeer277,
  recordExternalRestore277,
} from "@/lib/build277/postgres.mjs";

const route = "/sysop/acceptance277";

export async function ownerSourcePin277Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await adoptOwnerPeer277({
      proposalId: String(form.get("proposalId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
      session,
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?ownerPin=hold");
  }
  redirect(route + "?ownerPin=recorded");
}

export async function externalRestore277Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordExternalRestore277({
      reviewerId: session.user.id,
      closureReviewId: String(form.get("closureReviewId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
      sourceHostDigest: String(form.get("sourceHostDigest") ?? ""),
      isolatedHostDigest: String(form.get("isolatedHostDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?externalRestore=hold");
  }
  redirect(route + "?externalRestore=recorded");
}
