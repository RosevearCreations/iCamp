"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerTrendAnnotation,
  recordOwnerHandoffPlan,
} from "@/lib/permanent-unit-owner-planning/postgres.mjs";

const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function feedback(
  campgroundId: string,
  kind: "saved" | "error",
  message: string,
) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function ownerTrendAnnotationAction(form: FormData) {
  const session = await requireStaff(path);
  const campgroundId = field(form, "campgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Owner trend annotation recorded; no source case or finance state changed.";
  try {
    await recordOwnerTrendAnnotation({
      actorUserId: session.user.id,
      id: randomUUID(),
      campgroundId,
      weekStart: field(form, "weekStart"),
      metric: field(form, "metric"),
      disposition: field(form, "disposition"),
      evidenceReference: field(form, "evidenceReference"),
      note: field(form, "note"),
      nextReviewAt: field(form, "nextReviewAt"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted trend annotation failed.";
  }
  feedback(campgroundId, kind, message);
}
export async function ownerHandoffPlanAction(form: FormData) {
  const session = await requireStaff(path);
  const campgroundId = field(form, "sourceCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Owner handoff plan recorded; no task assignment, message, hold or applicant state changed.";
  try {
    await recordOwnerHandoffPlan({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: campgroundId,
      targetCampgroundId: field(form, "targetCampgroundId"),
      sourceAnnotationId: field(form, "sourceAnnotationId"),
      planningScope: field(form, "planningScope"),
      dueAt: field(form, "dueAt"),
      evidenceReference: field(form, "evidenceReference"),
      ownerNote: field(form, "ownerNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted handoff planning failed.";
  }
  feedback(campgroundId, kind, message);
}
