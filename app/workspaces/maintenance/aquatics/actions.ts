"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  configureAquaticProgram,
  startAquaticInspection,
  transitionAquaticFacility,
} from "@/lib/aquatics/postgres.mjs";

const path = "/workspaces/maintenance/aquatics";

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
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function configureAquaticProgramAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "aquatics.manage",
    path,
  );
  const expectedText = field(formData, "rowVersion");

  await configureAquaticProgram({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: expectedText ? Number(expectedText) : null,
    assetId: field(formData, "assetId"),
    inspectionTemplateId: field(formData, "inspectionTemplateId"),
    maintenanceScheduleId: field(formData, "maintenanceScheduleId"),
    reopenInspectionMaxAgeMinutes: field(
      formData,
      "reopenInspectionMaxAgeMinutes",
    ),
    notes: optionalField(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  });

  finish(campgroundId, "Aquatic operating program saved.");
}

export async function startAquaticInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startAquaticInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
  });

  finish(
    campgroundId,
    "Aquatic safety inspection started. Complete it in the inspection workspace.",
  );
}

export async function transitionAquaticFacilityAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const publicState = field(formData, "publicState");
  const permission =
    publicState === "open" ? "aquatics.reopen" : "aquatics.manage";
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    path,
  );

  await transitionAquaticFacility({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
    expectedAssetRowVersion: Number(field(formData, "assetRowVersion")),
    publicState,
    reason: field(formData, "reason"),
  });

  finish(
    campgroundId,
    publicState === "open"
      ? "Aquatic facility reopened from signed inspection evidence."
      : publicState === "limited"
        ? "Aquatic facility moved to limited operation."
        : "Aquatic facility closed.",
  );
}
