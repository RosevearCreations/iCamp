"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  recordManualReceipt,
  recordApplicantResponse,
  recordDeliveryException,
} from "@/lib/permanent-unit-receipts/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/receipts";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function submit(
  form: FormData,
  operation: (user: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    camp,
    "permanent_unit.transfer",
    path,
  );
  let kind = "saved",
    message = success;
  try {
    await operation(session.user.id, camp);
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Evidence recording failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function manualReceiptAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordManualReceipt({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        consentId: f(form, "consentId"),
        signoffId: f(form, "signoffId"),
        channel: f(form, "channel"),
        deliveredAt: f(form, "deliveredAt"),
        evidenceReference: f(form, "evidenceReference"),
        recipientVerificationReference: f(
          form,
          "recipientVerificationReference",
        ),
        note: f(form, "note"),
      }),
    "Manual delivery evidence logged; no legal receipt or acceptance inferred.",
  );
}
export async function applicantResponseAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordApplicantResponse({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        receiptId: f(form, "receiptId"),
        response: f(form, "response"),
        responseAt: f(form, "responseAt"),
        evidenceReference: f(form, "evidenceReference"),
        note: f(form, "note"),
      }),
    "Applicant response source recorded; no signature or agreement created.",
  );
}
export async function exceptionAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordDeliveryException({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        consentId: f(form, "consentId"),
        eventType: f(form, "eventType"),
        reasonCode: f(form, "reasonCode"),
        evidenceReference: f(form, "evidenceReference"),
        note: f(form, "note"),
      }),
    "Immutable exception event recorded; verify the current hold before proceeding.",
  );
}
