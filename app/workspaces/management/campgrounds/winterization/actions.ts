"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createWinterizationTemplate,
  startWinterizationRun,
  recordWinterizationStep,
  reviewWinterizationRun,
} from "@/lib/winterization/postgres.mjs";

const path = "/workspaces/management/campgrounds/winterization";
const field = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();

function finish(
  campgroundId: string,
  key: "saved" | "error",
  message: string,
): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&${key}=${encodeURIComponent(message.slice(0, 240))}`,
  );
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Winterization action failed.";
}

export async function publishWinterizationTemplateAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winterization.template.manage",
    path,
  );
  try {
    await createWinterizationTemplate({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      name: field(data, "name"),
      instructions: field(data, "instructions"),
      extraSteps: field(data, "extraSteps"),
    });
  } catch (error) {
    finish(campgroundId, "error", safeError(error));
  }
  finish(
    campgroundId,
    "saved",
    "New immutable shutdown checklist version published.",
  );
}

export async function startWinterizationRunAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winterization.record",
    path,
  );
  try {
    await startWinterizationRun({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      assignmentId: field(data, "assignmentId"),
      templateId: field(data, "templateId"),
      winterYear: field(data, "winterYear"),
    });
  } catch (error) {
    finish(campgroundId, "error", safeError(error));
  }
  finish(
    campgroundId,
    "saved",
    "Winterization run started. Physical work and evidence remain pending.",
  );
}

export async function recordWinterizationStepAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winterization.record",
    path,
  );
  try {
    await recordWinterizationStep({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      runId: field(data, "runId"),
      stepKey: field(data, "stepKey"),
      result: field(data, "result"),
      evidenceReference: field(data, "evidenceReference"),
      note: field(data, "note"),
      workOrderId: field(data, "workOrderId"),
    });
  } catch (error) {
    finish(campgroundId, "error", safeError(error));
  }
  finish(
    campgroundId,
    "saved",
    "Immutable winterization step evidence recorded.",
  );
}

export async function reviewWinterizationRunAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "winterization.signoff",
    path,
  );
  const decision = field(data, "decision");
  try {
    await reviewWinterizationRun({
      actorUserId: session.user.id,
      campgroundId,
      id: field(data, "id"),
      runId: field(data, "runId"),
      decision,
      note: field(data, "note"),
    });
  } catch (error) {
    finish(campgroundId, "error", safeError(error));
  }
  finish(
    campgroundId,
    "saved",
    decision === "approved"
      ? "Maintenance/foreman sign-off recorded. Winter close remains a separate authorized long-term assignment action."
      : "Winterization rejected for corrective follow-up; further evidence may be recorded.",
  );
}
