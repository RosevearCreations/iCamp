"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createFollowupTask,
  recordFollowupEvidence,
  recordFollowupReassessment,
  recordEscalationClosure,
} from "@/lib/permanent-unit-followup/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/followup";
const field = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
async function submit(
  form: FormData,
  action: (actor: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    camp,
    "permanent_unit.transfer",
    path,
  );
  let result = "saved",
    message = success;
  try {
    await action(session.user.id, camp);
  } catch (error) {
    result = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted follow-up operation failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${result}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function createTaskAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      createFollowupTask({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        escalationId: field(form, "escalationId"),
        ownerResponseId: field(form, "ownerResponseId"),
        assignedOwnerUserId: field(form, "assignedOwnerUserId"),
        taskReference: field(form, "taskReference"),
        actionPlan: field(form, "actionPlan"),
        dueAt: field(form, "dueAt"),
      }),
    "Owner follow-up task assigned internally; no notification sent.",
  );
}
export async function evidenceAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordFollowupEvidence({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        taskId: field(form, "taskId"),
        evidenceKind: field(form, "evidenceKind"),
        evidenceReference: field(form, "evidenceReference"),
        note: field(form, "note"),
      }),
    "Immutable owner follow-up evidence recorded.",
  );
}
export async function reassessmentAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordFollowupReassessment({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        taskId: field(form, "taskId"),
        evidenceId: field(form, "evidenceId"),
        reassessment: field(form, "reassessment"),
        evidenceReference: field(form, "evidenceReference"),
        note: field(form, "note"),
      }),
    "Independent reassessment recorded; no exception hold cleared.",
  );
}
export async function closureAction(form: FormData) {
  await submit(
    form,
    (actorUserId, campgroundId) =>
      recordEscalationClosure({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        taskId: field(form, "taskId"),
        reassessmentId: field(form, "reassessmentId"),
        outcome: field(form, "outcome"),
        evidenceReference: field(form, "evidenceReference"),
        note: field(form, "note"),
      }),
    "Administrative escalation closure recorded; finance and exception holds remain unchanged.",
  );
}
