"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { saveWayfindingReview } from "@/lib/wayfinding/postgres.mjs";

const path = "/workspaces/management/campgrounds/maps/wayfinding";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveWayfindingReviewAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map.publish",
    path,
  );
  await saveWayfindingReview({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    mapObjectId: field(formData, "mapObjectId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    input: {
      isPublished: formData.get("isPublished") === "on",
      description: field(formData, "description"),
      accessibilityNote: field(formData, "accessibilityNote"),
      landmarkHint: field(formData, "landmarkHint"),
    },
  });

  revalidatePath(path);
  revalidatePath("/booking/map");
  revalidatePath("/guest/hub");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=Review%20saved`,
  );
}
