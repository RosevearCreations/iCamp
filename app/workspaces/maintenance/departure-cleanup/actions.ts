"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  clearCampsiteDepartureCleanupTask,
  configureCampsiteDepartureCleanupProgram,
  startCampsiteDepartureCleanupInspection,
} from "@/lib/campsite-departure-cleanup/postgres.mjs";

const path = "/workspaces/maintenance/departure-cleanup";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalField(formData: FormData, key: string) {
  return field(formData, key) || null;
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/maintenance");
  revalidatePath("/workspaces/maintenance/inspections");
  revalidatePath("/workspaces/maintenance/work-orders");
  revalidatePath("/workspaces/management/campgrounds/reservations/check-out");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function configureCampsiteDepartureCleanupProgramAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.schedule",
    path,
  );
  const rowVersion = field(formData, "rowVersion");

  await configureCampsiteDepartureCleanupProgram({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: rowVersion ? Number(rowVersion) : null,
    accommodationId: field(formData, "accommodationId"),
    campsiteType: field(formData, "campsiteType"),
    inspectionTemplateId: field(formData, "inspectionTemplateId"),
    blockRebookingUntilClear: formData.get("blockRebookingUntilClear") === "on",
    notes: optionalField(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  });

  finish(campgroundId, "Departure campsite cleanup program saved.");
}

export async function startCampsiteDepartureCleanupInspectionAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startCampsiteDepartureCleanupInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    taskId: field(formData, "taskId"),
  });

  finish(
    campgroundId,
    "Campsite cleanup inspection started. Complete the checklist in Inspections.",
  );
}

export async function clearCampsiteDepartureCleanupTaskAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireStaff(path);

  await clearCampsiteDepartureCleanupTask({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    taskId: field(formData, "taskId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(
    campgroundId,
    "Departure campsite cleanup cleared and availability reconciled.",
  );
}
