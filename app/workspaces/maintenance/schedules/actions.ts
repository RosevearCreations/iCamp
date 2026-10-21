"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createMaintenanceSchedule,
  setMaintenanceScheduleActive,
} from "@/lib/maintenance-scheduler/postgres.mjs";

const path = "/workspaces/maintenance/schedules";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalField(formData: FormData, key: string) {
  return field(formData, key) || null;
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

export async function createMaintenanceScheduleAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.schedule",
    path,
  );

  await createMaintenanceSchedule({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    title: field(formData, "title"),
    description: optionalField(formData, "description"),
    categoryId: field(formData, "categoryId"),
    priorityPolicyId: field(formData, "priorityPolicyId"),
    sectionId: optionalField(formData, "sectionId"),
    assetId: optionalField(formData, "assetId"),
    accommodationId: optionalField(formData, "accommodationId"),
    locationDescription: optionalField(formData, "locationDescription"),
    recurrenceKind: field(formData, "recurrenceKind"),
    intervalValue: optionalField(formData, "intervalValue"),
    weekday: optionalField(formData, "weekday"),
    monthDay: optionalField(formData, "monthDay"),
    seasonMonth: optionalField(formData, "seasonMonth"),
    seasonDay: optionalField(formData, "seasonDay"),
    firstOccurrenceLocal: field(formData, "firstOccurrenceLocal"),
    missedAfterMinutes: field(formData, "missedAfterMinutes"),
    catchUpMode: field(formData, "catchUpMode"),
  });

  finish(campgroundId, "Recurring maintenance schedule created.");
}

export async function setMaintenanceScheduleActiveAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.schedule",
    path,
  );

  const isActive = field(formData, "isActive") === "true";
  await setMaintenanceScheduleActive({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    scheduleId: field(formData, "scheduleId"),
    isActive,
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(
    campgroundId,
    isActive
      ? "Recurring maintenance schedule activated."
      : "Recurring maintenance schedule deactivated.",
  );
}
