"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { recordRecurrenceReview } from "@/lib/permanent-unit-portfolio/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/portfolio";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
export async function recurrenceReviewAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "permanent_unit.transfer",
    path,
  );
  let kind = "saved",
    message =
      "Source-linked independent recurrence review saved; no finance or hold state changed.";
  try {
    await recordRecurrenceReview({
      actorUserId: session.user.id,
      campgroundId,
      id: randomUUID(),
      consentId: field(form, "consentId"),
      latestExceptionEventId: field(form, "latestExceptionEventId"),
      reasonCode: field(form, "reasonCode"),
      observedReasonHoldCount: field(form, "observedReasonHoldCount"),
      observedEscalationCount: field(form, "observedEscalationCount"),
      reviewDisposition: field(form, "reviewDisposition"),
      nextReviewAt: field(form, "nextReviewAt"),
      evidenceReference: field(form, "evidenceReference"),
      note: field(form, "note"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted recurrence review failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
