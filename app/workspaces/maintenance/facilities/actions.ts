"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import {
  configureFacilityUpkeepProgram,
  recordFacilityUpkeepSnapshot,
  reportFacilityUpkeepIssue,
  startFacilityUpkeepInspection,
} from "@/lib/facility-upkeep/postgres.mjs";

const path = "/workspaces/maintenance/facilities";

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

async function requireSnapshotPermission(campgroundId: string) {
  const session = await requireStaff(path);
  const allowed = await Promise.all(
    ["maintenance.create", "maintenance.complete"].map((permission) =>
      hasCampgroundPermission(session.user.id, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    redirect("/auth/not-authorized");
  }
  return session;
}

export async function configureFacilityUpkeepProgramAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.schedule",
    path,
  );
  const expectedText = field(formData, "rowVersion");

  await configureFacilityUpkeepProgram({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: expectedText ? Number(expectedText) : null,
    assetId: field(formData, "assetId"),
    facilityKind: field(formData, "facilityKind"),
    inspectionTemplateId: field(formData, "inspectionTemplateId"),
    maintenanceScheduleId: field(formData, "maintenanceScheduleId"),
    notes: optionalField(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  });

  finish(campgroundId, "Facility upkeep program saved.");
}

export async function startFacilityUpkeepInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startFacilityUpkeepInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
  });

  finish(
    campgroundId,
    "Facility inspection started. Complete it in the inspection workspace.",
  );
}

export async function recordFacilityUpkeepSnapshotAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireSnapshotPermission(campgroundId);

  await recordFacilityUpkeepSnapshot({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
    cleanlinessState: field(formData, "cleanlinessState"),
    fixtureState: field(formData, "fixtureState"),
    supplyState: field(formData, "supplyState"),
    notes: optionalField(formData, "notes"),
  });

  finish(campgroundId, "Facility status snapshot recorded.");
}

export async function reportFacilityUpkeepIssueAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.create",
    path,
  );

  await reportFacilityUpkeepIssue({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
    issueKind: field(formData, "issueKind"),
    title: field(formData, "title"),
    description: optionalField(formData, "description"),
    categoryId: field(formData, "categoryId"),
    priorityPolicyId: field(formData, "priorityPolicyId"),
  });

  finish(campgroundId, "Facility issue escalated to a maintenance work order.");
}
