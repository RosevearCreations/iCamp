"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createAccommodation,
  updateAccommodation,
} from "@/lib/accommodations/postgres.mjs";

const path = "/workspaces/management/campgrounds/accommodations";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function createAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await createAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    kind: field(formData, "kind"),
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
  });

  finish(campgroundId, "Accommodation created.");
}

export async function updateAccommodationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateAccommodation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    sectionId: field(formData, "sectionId"),
    subsectionId: field(formData, "subsectionId") || null,
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Accommodation saved.");
}
