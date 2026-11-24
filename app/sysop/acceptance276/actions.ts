"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import {
  proposePeerSigner276,
  approvePeerSigner276,
  recordIndependentRestoreReview276,
} from "@/lib/build276/postgres.mjs";

const route = "/sysop/acceptance276";

export async function proposePeerSigner276Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await proposePeerSigner276({
      actorId: session.user.id,
      sourceId: String(form.get("sourceId") ?? ""),
      keyId: String(form.get("keyId") ?? ""),
      commitSha: String(form.get("commitSha") ?? ""),
      publicKeyPem: String(form.get("publicKeyPem") ?? ""),
      keyFingerprint: String(form.get("keyFingerprint") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?proposal=hold");
  }
  redirect(route + "?proposal=recorded");
}

export async function approvePeerSigner276Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await approvePeerSigner276({
      reviewerId: session.user.id,
      proposalId: String(form.get("proposalId") ?? ""),
      reviewDigest: String(form.get("reviewDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?approval=hold");
  }
  redirect(route + "?approval=recorded");
}

export async function independentRestore276Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordIndependentRestoreReview276({
      reviewerId: session.user.id,
      attestationId: String(form.get("attestationId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?restore=hold");
  }
  redirect(route + "?restore=recorded");
}
