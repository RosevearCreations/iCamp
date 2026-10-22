"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { transitionOperationalAssetStatus } from "@/lib/status-engine/postgres.mjs";
import {
  configureRecreationMaintenanceProgram,
  recordRecreationMaintenanceSnapshot,
  reportRecreationMaintenanceIssue,
  startRecreationMaintenanceInspection,
} from "@/lib/recreation-maintenance/postgres.mjs";

const path = "/workspaces/maintenance/recreation";

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

export async function configureRecreationMaintenanceProgramAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.schedule",
    path,
  );
  const expectedText = field(formData, "rowVersion");

  await configureRecreationMaintenanceProgram({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: expectedText ? Number(expectedText) : null,
    assetId: field(formData, "assetId"),
    profileKind: field(formData, "profileKind"),
    inspectionTemplateId: field(formData, "inspectionTemplateId"),
    maintenanceScheduleId: field(formData, "maintenanceScheduleId"),
    notes: optionalField(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  });

  finish(campgroundId, "Recreation maintenance program saved.");
}

export async function startRecreationMaintenanceInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startRecreationMaintenanceInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
  });

  finish(
    campgroundId,
    "Recreation inspection started. Complete it in the inspection workspace.",
  );
}

export async function recordRecreationMaintenanceSnapshotAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireSnapshotPermission(campgroundId);

  await recordRecreationMaintenanceSnapshot({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    programId: field(formData, "programId"),
    surfaceState: field(formData, "surfaceState"),
    safetyState: field(formData, "safetyState"),
    amenityState: field(formData, "amenityState"),
    notes: optionalField(formData, "notes"),
  });

  finish(campgroundId, "Recreation condition snapshot recorded.");
}

export async function reportRecreationMaintenanceIssueAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.create",
    path,
  );

  await reportRecreationMaintenanceIssue({
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

  finish(campgroundId, "Recreation issue escalated to a maintenance work order.");
}


export async function transitionRecreationAssetStatusAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(campgroundId, "asset.manage", path);
  const expectedRowVersion = Number(field(formData, "assetRowVersion"));
  if (!Number.isInteger(expectedRowVersion) || expectedRowVersion < 1) throw new Error("Asset row version is required.");
  await transitionOperationalAssetStatus({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    assetId: field(formData, "assetId"),
    expectedRowVersion,
    toState: field(formData, "toState"),
    reason: field(formData, "reason"),
  });
  finish(campgroundId, "Canonical recreation operating state updated.");
}
