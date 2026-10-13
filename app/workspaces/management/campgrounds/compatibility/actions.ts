"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { updateCompatibilityPolicy } from "@/lib/accommodation-compatibility/postgres.mjs";

const path = "/workspaces/management/campgrounds/compatibility";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function updateCompatibilityPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );
  const petsAllowed = checked(formData, "petsAllowed");
  await updateCompatibilityPolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    accessibleSite: checked(formData, "accessibleSite"),
    petsAllowed,
    maxPets: petsAllowed ? Number(field(formData, "maxPets")) : 0,
  });
  revalidatePath(path);
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent("Compatibility policy updated."),
  );
}
