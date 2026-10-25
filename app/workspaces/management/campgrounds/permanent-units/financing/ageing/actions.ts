"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  recordExceptionReview,
  recordOwnerEscalation,
  recordOwnerResponse,
} from "@/lib/permanent-unit-ageing/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/ageing";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function run(
  form: FormData,
  work: (user: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = f(form, "campgroundId"),
    session = await requireCampgroundPermission(
      camp,
      "permanent_unit.transfer",
      path,
    );
  let kind = "saved",
    message = success;
  try {
    await work(session.user.id, camp);
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Private exception operation failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function exceptionReviewAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordExceptionReview({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        consentId: f(form, "consentId"),
        reconciliationId: f(form, "reconciliationId"),
        exceptionEventId: f(form, "exceptionEventId"),
        observationState: f(form, "observationState"),
        reviewDecision: f(form, "reviewDecision"),
        nextReviewAt: f(form, "nextReviewAt"),
        evidenceReference: f(form, "evidenceReference"),
        note: f(form, "note"),
      }),
    "Immutable exception re-review saved; no hold was cleared.",
  );
}
export async function ownerEscalationAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordOwnerEscalation({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        exceptionReviewId: f(form, "exceptionReviewId"),
        targetOwnerUserId: f(form, "targetOwnerUserId"),
        priority: f(form, "priority"),
        escalationReference: f(form, "escalationReference"),
        requestedAction: f(form, "requestedAction"),
        dueAt: f(form, "dueAt"),
      }),
    "Private owner escalation queued for manual owner follow-up; no message sent.",
  );
}
export async function ownerResponseAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordOwnerResponse({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        escalationId: f(form, "escalationId"),
        response: f(form, "response"),
        evidenceReference: f(form, "evidenceReference"),
        note: f(form, "note"),
      }),
    "Owner response recorded as internal follow-up; financing and holds remain unchanged.",
  );
}
