"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  publishSpringTemplate,
  startSpringInspection,
  recordSpringObservation,
  reviewSpringInspection,
} from "@/lib/spring-reopening/postgres.mjs";

const path = "/workspaces/management/campgrounds/spring-reopening";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Spring inspection action failed.";
function finish(
  campgroundId: string,
  key: "saved" | "error",
  value: string,
): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&${key}=${encodeURIComponent(value.slice(0, 240))}`,
  );
}

export async function publishSpringTemplateAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "spring.reopen.policy.manage",
    path,
  );
  try {
    await publishSpringTemplate({
      actorUserId: session.user.id,
      campgroundId,
      id: field(form, "id"),
      name: field(form, "name"),
      instructions: field(form, "instructions"),
      extraSteps: field(form, "extraSteps"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Published an immutable spring inspection checklist version.",
  );
}

export async function startSpringInspectionAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "spring.reopen.record",
    path,
  );
  try {
    await startSpringInspection({
      actorUserId: session.user.id,
      campgroundId,
      id: field(form, "id"),
      accommodationId: field(form, "accommodationId"),
      assignmentId: field(form, "assignmentId"),
      templateId: field(form, "templateId"),
      winterYear: field(form, "winterYear"),
      waterService: field(form, "waterService"),
      operatingLimits: field(form, "operatingLimits"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Spring inspection started. The assignment remains winter closed until independently approved and separately reopened.",
  );
}

export async function recordSpringObservationAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "spring.reopen.record",
    path,
  );
  try {
    await recordSpringObservation({
      actorUserId: session.user.id,
      campgroundId,
      id: field(form, "id"),
      inspectionId: field(form, "inspectionId"),
      stepKey: field(form, "stepKey"),
      result: field(form, "result"),
      evidenceReference: field(form, "evidenceReference"),
      workOrderId: field(form, "workOrderId"),
      note: field(form, "note"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Recorded immutable spring inspection evidence.",
  );
}

export async function reviewSpringInspectionAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "spring.reopen.approve",
    path,
  );
  const decision = field(form, "decision");
  try {
    await reviewSpringInspection({
      actorUserId: session.user.id,
      campgroundId,
      id: field(form, "id"),
      inspectionId: field(form, "inspectionId"),
      decision,
      note: field(form, "note"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    decision === "approved"
      ? "Independent spring return-to-service approval recorded. Reopen eligible long-term assignments separately in Seasonal & Yearly; no booking or equipment control occurred."
      : "Spring inspection rejected for correction. Record new evidence and resolve linked work orders before review.",
  );
}
