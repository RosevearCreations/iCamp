"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  prepareEvidenceReconciliation,
  reviewEvidenceClosure,
} from "@/lib/permanent-unit-reconciliation/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/reconciliation";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function perform(
  form: FormData,
  work: (actorUserId: string, campgroundId: string) => Promise<unknown>,
  success: string,
) {
  const camp = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    camp,
    "permanent_unit.transfer",
    path,
  );
  let key = "saved",
    message = success;
  try {
    await work(session.user.id, camp);
  } catch (error) {
    key = "error";
    message =
      error instanceof Error ? error.message : "Private reconciliation failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${key}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function reconcileEvidenceAction(form: FormData) {
  await perform(
    form,
    (actorUserId, campgroundId) =>
      prepareEvidenceReconciliation({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        consentId: f(form, "consentId"),
        receiptId: f(form, "receiptId"),
        acknowledgementId: f(form, "acknowledgementId"),
        disclosureVersionId: f(form, "disclosureVersionId"),
        disclosureSha256: f(form, "disclosureSha256"),
        lastExceptionEventId: f(form, "lastExceptionEventId"),
        completeness: f(form, "completeness"),
        reconciliationReference: f(form, "reconciliationReference"),
        note: f(form, "note"),
      }),
    "Immutable evidence reconciliation recorded for independent review.",
  );
}
export async function reviewClosureAction(form: FormData) {
  await perform(
    form,
    (actorUserId, campgroundId) =>
      reviewEvidenceClosure({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        reconciliationId: f(form, "reconciliationId"),
        decision: f(form, "decision"),
        reviewReference: f(form, "reviewReference"),
        note: f(form, "note"),
      }),
    "Independent operator closure decision saved; no contract or loan action performed.",
  );
}
