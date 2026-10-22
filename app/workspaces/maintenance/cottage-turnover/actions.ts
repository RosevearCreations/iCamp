"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  configureCottageTurnoverFinalInspection,
  releaseCottageTurnover,
  startCottageTurnoverFinalInspection,
} from "@/lib/cottage-turnover-operations/postgres.mjs";

const path = "/workspaces/maintenance/cottage-turnover";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/maintenance");
  revalidatePath("/workspaces/maintenance/inspections");
  revalidatePath("/workspaces/maintenance/work-orders");
  revalidatePath("/workspaces/management/campgrounds/accommodations");
  revalidatePath("/workspaces/management/campgrounds/reservations/check-out");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function configureCottageTurnoverFinalInspectionAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await configureCottageTurnoverFinalInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    housekeepingTemplateId: field(formData, "housekeepingTemplateId"),
    inspectionTemplateId: field(formData, "inspectionTemplateId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Final cottage turnover inspection configured.");
}

export async function startCottageTurnoverFinalInspectionAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inspection.perform",
    path,
  );

  await startCottageTurnoverFinalInspection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
  });

  finish(
    campgroundId,
    "Final cottage inspection started. Complete it in Inspections.",
  );
}

export async function releaseCottageTurnoverAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await releaseCottageTurnover({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    turnoverId: field(formData, "turnoverId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(
    campgroundId,
    "Cottage turnover released and canonical availability reconciled.",
  );
}
