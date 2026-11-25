"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSysop } from "@/lib/platform/access";
import {
  proposeExternalProviderKey280,
  reviewExternalProviderKey280,
  recordProviderSignedClosure280,
  witnessOwnerRecovery280,
  recordIsolatedAcceptanceCertificate280,
} from "@/lib/build280/postgres.mjs";

const route = "/sysop/acceptance280";
export async function proposeExternalProviderKey280Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await proposeExternalProviderKey280({
      actorId: session.user.id,
      providerId: String(form.get("providerId") ?? ""),
      keyId: String(form.get("keyId") ?? ""),
      publicKeyPem: String(form.get("publicKeyPem") ?? ""),
      fingerprint: String(form.get("fingerprint") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?key=hold");
  }
  redirect(route + "?key=proposed");
}
export async function reviewExternalProviderKey280Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await reviewExternalProviderKey280({
      reviewerId: session.user.id,
      proposalId: String(form.get("proposalId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?pin=hold");
  }
  redirect(route + "?pin=reviewed");
}
export async function recordProviderSignedClosure280Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordProviderSignedClosure280({
      reviewerId: session.user.id,
      keyReviewId: String(form.get("keyReviewId") ?? ""),
      isolatedEvidenceId: String(form.get("isolatedEvidenceId") ?? ""),
      body: String(form.get("body") ?? ""),
      signature: String(form.get("signature") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?signed=hold");
  }
  redirect(route + "?signed=verified");
}
export async function witnessOwnerRecovery280Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await witnessOwnerRecovery280({
      reviewerId: session.user.id,
      ownerAuditId: String(form.get("ownerAuditId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?owner=hold");
  }
  redirect(route + "?owner=recorded");
}
export async function recordIsolatedCertificate280Action(form: FormData) {
  const { session } = await requireSysop("/sysop");
  try {
    await recordIsolatedAcceptanceCertificate280({
      reviewerId: session.user.id,
      providerClosureId: String(form.get("providerClosureId") ?? ""),
      ownerWitnessId: String(form.get("ownerWitnessId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch {
    redirect(route + "?certificate=hold");
  }
  redirect(route + "?certificate=recorded");
}
