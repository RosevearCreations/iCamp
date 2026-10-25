"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  openFinancingApplication,
  recordFinancingEvidence,
  triageFinancingApplication,
} from "@/lib/permanent-unit-financing/postgres.mjs";

const path = "/workspaces/management/campgrounds/permanent-units/financing";
const get = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
async function run(
  form: FormData,
  operation: (user: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = get(form, "campgroundId");
  const session = await requireCampgroundPermission(
    camp,
    "permanent_unit.transfer",
    path,
  );
  let key: "saved" | "error" = "saved",
    message = success;
  try {
    await operation(session.user.id, camp);
  } catch (error) {
    key = "error";
    message =
      error instanceof Error ? error.message : "Financing intake failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${key}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function openFinancingAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      openFinancingApplication({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        caseId: get(form, "caseId"),
        requestedAmount: get(form, "requestedAmount"),
        applicantContactReference: get(form, "contactReference"),
        consentReference: get(form, "consentReference"),
        purposeNote: get(form, "purposeNote"),
        consentAttested: form.get("consentAttested") === "on",
      }),
    "Private financing intake recorded; no credit decision or offer made.",
  );
}
export async function recordFinancingEvidenceAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordFinancingEvidence({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        applicationId: get(form, "applicationId"),
        documentType: get(form, "documentType"),
        outcome: get(form, "outcome"),
        sourceReference: get(form, "sourceReference"),
        note: get(form, "note"),
      }),
    "Secure document-reference status added to immutable intake history.",
  );
}
export async function triageFinancingAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      triageFinancingApplication({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        applicationId: get(form, "applicationId"),
        decision: get(form, "decision"),
        note: get(form, "note"),
      }),
    "Independent intake triage recorded; no lending approval granted.",
  );
}
