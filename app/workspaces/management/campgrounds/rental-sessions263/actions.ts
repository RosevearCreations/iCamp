"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  cancelSupervisedSession263,
  planSupervisedSession263,
} from "@/lib/rental-planner/sessions263-postgres.mjs";

const path = "/workspaces/management/campgrounds/rental-sessions263";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const outcomeUrl = (campgroundId: string, outcome: string) =>
  path + "?campground=" + encodeURIComponent(campgroundId) + "&" + outcome;

export async function planSupervisedSession263Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  try {
    await planSupervisedSession263({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      input: {
        offerId: field(form, "offerId"),
        plannedDay: field(form, "plannedDay"),
        start: field(form, "start"),
        end: field(form, "end"),
        participantLimit: field(form, "participantLimit"),
        activityKind: field(form, "activityKind"),
        safetyBrief: field(form, "safetyBrief"),
      },
    });
    revalidatePath(path);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(outcomeUrl(campgroundId, "error=plan"));
  }
  redirect(outcomeUrl(campgroundId, "saved=planned"));
}

export async function cancelSupervisedSession263Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  try {
    await cancelSupervisedSession263({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      sessionId: field(form, "sessionId"),
    });
    revalidatePath(path);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(outcomeUrl(campgroundId, "error=cancel"));
  }
  redirect(outcomeUrl(campgroundId, "saved=cancelled"));
}
