"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createInspectionTemplate,
  publishInspectionTemplateVersion,
  recordInspectionResult,
  setInspectionTemplateActive,
  signOffInspection,
  startInspection,
  submitInspection,
} from "@/lib/inspections/postgres.mjs";

const path = "/workspaces/maintenance/inspections";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalField(formData: FormData, key: string) {
  return field(formData, key) || null;
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/maintenance");
  revalidatePath("/workspaces/maintenance/work-orders");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function createInspectionTemplateAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.template.manage",
    path,
  );

  await createInspectionTemplate({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    targetKind: field(formData, "targetKind"),
    assetId: optionalField(formData, "assetId"),
    accommodationId: optionalField(formData, "accommodationId"),
    name: field(formData, "name"),
    description: optionalField(formData, "description"),
    versionInstructions: optionalField(formData, "versionInstructions"),
    signoffRequired: formData.get("signoffRequired") === "on",
    failureCategoryId: field(formData, "failureCategoryId"),
    failurePriorityPolicyId: field(formData, "failurePriorityPolicyId"),
    itemsText: field(formData, "itemsText"),
  });

  finish(campgroundId, "Inspection template created and version 1 published.");
}

export async function publishInspectionTemplateVersionAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.template.manage",
    path,
  );

  await publishInspectionTemplateVersion({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    versionInstructions: optionalField(formData, "versionInstructions"),
    signoffRequired: formData.get("signoffRequired") === "on",
    failureCategoryId: field(formData, "failureCategoryId"),
    failurePriorityPolicyId: field(formData, "failurePriorityPolicyId"),
    itemsText: field(formData, "itemsText"),
  });

  finish(campgroundId, "New immutable inspection template version published.");
}

export async function setInspectionTemplateActiveAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.template.manage",
    path,
  );
  const isActive = field(formData, "isActive") === "true";

  await setInspectionTemplateActive({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
    isActive,
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(
    campgroundId,
    isActive ? "Inspection template activated." : "Inspection template deactivated.",
  );
}

export async function startInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    templateId: field(formData, "templateId"),
  });

  finish(campgroundId, "Inspection started.");
}

export async function recordInspectionResultAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await recordInspectionResult({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    occurrenceId: field(formData, "occurrenceId"),
    templateItemId: field(formData, "templateItemId"),
    resultValue: field(formData, "resultValue"),
    note: optionalField(formData, "note"),
  });

  finish(campgroundId, "Inspection checklist result saved.");
}

export async function submitInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await submitInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    occurrenceId: field(formData, "occurrenceId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Inspection submitted.");
}

export async function signOffInspectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.signoff",
    path,
  );

  await signOffInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    occurrenceId: field(formData, "occurrenceId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    decision: field(formData, "decision"),
    note: optionalField(formData, "note"),
  });

  finish(campgroundId, "Inspection sign-off recorded.");
}
