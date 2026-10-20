"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { hasCampgroundPermission } from "@/lib/authz/postgres.mjs";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  addMaintenanceWorkOrderLabor,
  addMaintenanceWorkOrderMaterial,
  addMaintenanceWorkOrderNote,
  assignMaintenanceWorkOrder,
  attachMaintenanceWorkOrderMedia,
  createMaintenanceWorkOrder,
  transitionMaintenanceWorkOrder,
} from "@/lib/maintenance-work-orders/postgres.mjs";

const path = "/workspaces/maintenance/work-orders";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalField(formData: FormData, key: string) {
  return field(formData, key) || null;
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

async function requireEvidencePermission(campgroundId: string) {
  const session = await requireStaff(path);
  const allowed = await Promise.all(
    ["maintenance.create", "maintenance.assign", "maintenance.complete"].map(
      (permission) =>
        hasCampgroundPermission(session.user.id, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    redirect("/auth/not-authorized");
  }
  return session;
}

export async function createMaintenanceWorkOrderAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.create",
    path,
  );

  await createMaintenanceWorkOrder({
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
  });

  finish(campgroundId, "Maintenance work order created.");
}

export async function assignMaintenanceWorkOrderAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.assign",
    path,
  );

  await assignMaintenanceWorkOrder({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    assignedToUserId: optionalField(formData, "assignedToUserId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Maintenance assignment updated.");
}

export async function transitionMaintenanceWorkOrderAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const toStatus = field(formData, "toStatus");
  const permission =
    toStatus === "completed" ? "maintenance.complete" : "maintenance.assign";
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    path,
  );

  await transitionMaintenanceWorkOrder({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    toStatus,
    expectedRowVersion: numberField(formData, "rowVersion"),
    completionSummary: optionalField(formData, "completionSummary"),
    note: optionalField(formData, "note"),
  });

  finish(campgroundId, "Maintenance work-order status updated.");
}

export async function addMaintenanceWorkOrderNoteAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireEvidencePermission(campgroundId);

  await addMaintenanceWorkOrderNote({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    note: field(formData, "note"),
  });

  finish(campgroundId, "Maintenance note added.");
}

export async function attachMaintenanceWorkOrderMediaAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireEvidencePermission(campgroundId);

  await attachMaintenanceWorkOrderMedia({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    mediaAssetId: field(formData, "mediaAssetId"),
    caption: optionalField(formData, "caption"),
  });

  finish(campgroundId, "Secure media evidence attached.");
}

export async function addMaintenanceWorkOrderMaterialAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireEvidencePermission(campgroundId);
  const unitCost = optionalField(formData, "unitCostCents");

  await addMaintenanceWorkOrderMaterial({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    itemName: field(formData, "itemName"),
    quantity: numberField(formData, "quantity"),
    unit: field(formData, "unit"),
    unitCostCents: unitCost == null ? null : Number(unitCost),
  });

  finish(campgroundId, "Material usage recorded.");
}

export async function addMaintenanceWorkOrderLaborAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireEvidencePermission(campgroundId);

  await addMaintenanceWorkOrderLabor({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    workerUserId: optionalField(formData, "workerUserId"),
    minutes: numberField(formData, "minutes"),
    note: optionalField(formData, "note"),
  });

  finish(campgroundId, "Labour time recorded.");
}
