"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  moderateGuestFeedback,
  recordGuestFeedbackRecovery,
} from "@/lib/guest-feedback/postgres.mjs";

const path = "/workspaces/management/campgrounds/feedback";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const back = (campgroundId: string, result: string) =>
  `${path}?campground=${encodeURIComponent(campgroundId)}&${result}`;

function refresh() {
  revalidatePath(path);
  revalidatePath("/guest/feedback");
  revalidatePath("/reviews");
}

export async function moderateGuestFeedbackAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "guest.manage",
    path,
  );
  try {
    await moderateGuestFeedback({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      feedbackId: field(form, "feedbackId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        decision: field(form, "decision"),
        reason: field(form, "reason"),
      },
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=moderation"));
  }
  redirect(back(campgroundId, "saved=moderation"));
}

export async function recordFeedbackRecoveryAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "guest.manage",
    path,
  );
  try {
    await recordGuestFeedbackRecovery({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      feedbackId: field(form, "feedbackId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        stage: field(form, "stage"),
        dueDate: field(form, "dueDate"),
        internalNote: field(form, "internalNote"),
      },
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=recovery"));
  }
  redirect(back(campgroundId, "saved=recovery"));
}
