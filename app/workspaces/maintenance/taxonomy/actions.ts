"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createMaintenanceCategory,
  setMaintenanceCategoryActive,
  updateMaintenancePriorityPolicy,
} from "@/lib/maintenance-taxonomy/postgres.mjs";

const path = "/workspaces/maintenance/taxonomy";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string) {
  return Number(field(formData, key));
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/maintenance");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function createMaintenanceCategoryAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.assign",
    path,
  );

  await createMaintenanceCategory({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    code: field(formData, "code"),
    name: field(formData, "name"),
    description: field(formData, "description"),
  });

  finish(campgroundId, "Maintenance category created.");
}

export async function setMaintenanceCategoryActiveAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.assign",
    path,
  );

  await setMaintenanceCategoryActive({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    categoryId: field(formData, "categoryId"),
    isActive: field(formData, "isActive") === "true",
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Maintenance category status updated.");
}

export async function updateMaintenancePriorityPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.assign",
    path,
  );

  await updateMaintenancePriorityPolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    priorityKey: field(formData, "priorityKey"),
    targetResponseMinutes: numberField(formData, "targetResponseMinutes"),
    targetCompletionMinutes: numberField(formData, "targetCompletionMinutes"),
    instructions: field(formData, "instructions"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Maintenance priority target updated.");
}
