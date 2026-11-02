"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  publishReadinessTemplate,
  startReadinessAssessment,
  recordReadinessObservation,
  reviewReadinessAssessment,
} from "@/lib/cold-readiness/postgres.mjs";

const path = "/workspaces/management/campgrounds/winter-readiness";
const field = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Readiness action failed.";
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

export async function publishReadinessTemplateAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winter.readiness.policy.manage",
    path,
  );
  try {
    await publishReadinessTemplate({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      name: field(data, "name"),
      instructions: field(data, "instructions"),
      extraSteps: field(data, "extraSteps"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Published a versioned campground winter-readiness policy.",
  );
}

export async function startReadinessAssessmentAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winter.readiness.record",
    path,
  );
  try {
    await startReadinessAssessment({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      accommodationId: field(data, "accommodationId"),
      assignmentId: field(data, "assignmentId"),
      templateId: field(data, "templateId"),
      winterYear: field(data, "winterYear"),
      waterMode: field(data, "waterMode"),
      operatingLimits: field(data, "operatingLimits"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Assessment started. Winter operation is NOT approved until independently reviewed.",
  );
}

export async function recordReadinessObservationAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winter.readiness.record",
    path,
  );
  try {
    await recordReadinessObservation({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      assessmentId: field(data, "assessmentId"),
      stepKey: field(data, "stepKey"),
      result: field(data, "result"),
      evidenceReference: field(data, "evidenceReference"),
      workOrderId: field(data, "workOrderId"),
      note: field(data, "note"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    "Recorded immutable field observation; approval is separate.",
  );
}

export async function reviewReadinessAssessmentAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winter.readiness.approve",
    path,
  );
  const decision = field(data, "decision");
  try {
    await reviewReadinessAssessment({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      assessmentId: field(data, "assessmentId"),
      decision,
      note: field(data, "note"),
    });
  } catch (error) {
    finish(campgroundId, "error", message(error));
  }
  finish(
    campgroundId,
    "saved",
    decision === "approved"
      ? "Independent winter-readiness approval recorded. No booking or equipment status was changed."
      : "Assessment rejected for corrective action; record new field evidence before requesting approval.",
  );
}
