"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  cancelRentalAsset264,
  recordSupervisedPilotReview264,
  reserveRentalAsset264,
} from "@/lib/rental-planner/allocations264-postgres.mjs";
import { inspectRentalMigration264 } from "@/lib/rental-planner/migration264-postgres.mjs";

const path = "/workspaces/management/campgrounds/rental-allocations264";
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const dest = (campgroundId: string, outcome: string) =>
  path + "?campground=" + encodeURIComponent(campgroundId) + "&" + outcome;
async function permit(campgroundId: string) {
  const session = await requireCampgroundPermission(campgroundId, "rental.manage", path);
  const migration = await inspectRentalMigration264();
  if (!migration.sourceReadbackMatched)
    throw new Error("HOLD: exact original production migration 0192/0239/0240 was not verified.");
  return session;
}

export async function reserveRental264Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await permit(campgroundId);
  try {
    await reserveRentalAsset264({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      input: {
        requestId: field(form, "requestId"),
        staffSafetyReview: field(form, "staffSafetyReview"),
      },
    });
    revalidatePath(path);
    revalidatePath("/guest/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(dest(campgroundId, "error=reserve"));
  }
  redirect(dest(campgroundId, "saved=reserved"));
}

export async function cancelRental264Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await permit(campgroundId);
  try {
    await cancelRentalAsset264({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      allocationId: field(form, "allocationId"),
    });
    revalidatePath(path);
    revalidatePath("/guest/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(dest(campgroundId, "error=cancel"));
  }
  redirect(dest(campgroundId, "saved=cancelled"));
}

export async function reviewSupervisedPilot264Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await permit(campgroundId);
  await requireCampgroundPermission(campgroundId, "staff.manage", path);
  try {
    await recordSupervisedPilotReview264({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      input: {
        sessionId: field(form, "sessionId"),
        outcome: field(form, "outcome"),
        originalEvidenceReference: field(form, "originalEvidenceReference"),
        supervisionWelfareCheck: field(form, "supervisionWelfareCheck"),
      },
    });
    revalidatePath(path);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(dest(campgroundId, "error=pilot"));
  }
  redirect(dest(campgroundId, "saved=pilot"));
}
