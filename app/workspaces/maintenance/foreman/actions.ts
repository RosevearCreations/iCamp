"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  acknowledgeMaintenanceEscalation,
  raiseMaintenanceEscalation,
  resolveMaintenanceEscalation,
  updateMaintenanceEscalationPolicy,
} from "@/lib/maintenance-foreman/postgres.mjs";
import { assignMaintenanceWorkOrder } from "@/lib/maintenance-work-orders/postgres.mjs";

const path = "/workspaces/maintenance/foreman";

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
  revalidatePath("/workspaces/maintenance/work-orders");
  revalidatePath("/workspaces/maintenance");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function assignFromForemanQueueAction(formData: FormData) {
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

export async function raiseMaintenanceEscalationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.triage",
    path,
  );

  await raiseMaintenanceEscalation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    workOrderId: field(formData, "workOrderId"),
    triggerKey: field(formData, "triggerKey"),
  });

  finish(campgroundId, "Maintenance escalation raised.");
}

export async function acknowledgeMaintenanceEscalationAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.triage",
    path,
  );

  await acknowledgeMaintenanceEscalation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    escalationId: field(formData, "escalationId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
    note: optionalField(formData, "note"),
  });

  finish(campgroundId, "Maintenance escalation acknowledged.");
}

export async function resolveMaintenanceEscalationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.escalate",
    path,
  );

  await resolveMaintenanceEscalation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    escalationId: field(formData, "escalationId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
    note: field(formData, "note"),
  });

  finish(campgroundId, "Maintenance escalation resolved.");
}

export async function updateMaintenanceEscalationPolicyAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "maintenance.escalate",
    path,
  );

  await updateMaintenanceEscalationPolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    policyId: field(formData, "policyId"),
    targetLevel: field(formData, "targetLevel"),
    thresholdMinutes: numberField(formData, "thresholdMinutes"),
    isActive: formData.get("isActive") === "on",
    instructions: optionalField(formData, "instructions"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Maintenance escalation policy updated.");
}
