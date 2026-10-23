"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  configurePreventiveMaintenanceProgram,
  createPreventiveMaintenanceTemplate,
  setPreventiveMaintenanceProgramActive,
  setPreventiveMaintenanceTemplateActive,
} from "@/lib/preventive-maintenance/postgres.mjs";

const path = "/workspaces/maintenance/preventive";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalField(formData: FormData, key: string) {
  return field(formData, key) || null;
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/maintenance");
  revalidatePath("/workspaces/maintenance/schedules");
  revalidatePath("/workspaces/maintenance/work-orders");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function createPreventiveMaintenanceTemplateAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.preventive",
    path,
  );

  await createPreventiveMaintenanceTemplate({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    targetAssetClass: field(formData, "targetAssetClass"),
    name: field(formData, "name"),
    description: optionalField(formData, "description"),
    serviceInstructions: field(formData, "serviceInstructions"),
  });

  finish(campgroundId, "Preventive-maintenance template created.");
}

export async function configurePreventiveMaintenanceProgramAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.preventive",
    path,
  );

  await configurePreventiveMaintenanceProgram({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    assetId: field(formData, "assetId"),
    templateId: field(formData, "templateId"),
    maintenanceScheduleId: field(formData, "maintenanceScheduleId"),
    notes: optionalField(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  });

  finish(campgroundId, "Preventive-maintenance program created.");
}

export async function setPreventiveMaintenanceProgramActiveAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.preventive",
    path,
  );

  await setPreventiveMaintenanceProgramActive({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
    isActive: field(formData, "nextState") === "active",
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Preventive-maintenance program state updated.");
}

export async function setPreventiveMaintenanceTemplateActiveAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.preventive",
    path,
  );

  await setPreventiveMaintenanceTemplateActive({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    isActive: field(formData, "nextState") === "active",
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Preventive-maintenance template state updated.");
}
