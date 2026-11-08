"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { saveAmenityServiceReview } from "@/lib/wayfinding/postgres.mjs";

const path = "/workspaces/management/campgrounds/maps/wayfinding/services";

function field(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveAmenityServiceAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map.publish",
    path,
  );
  const publish = field(form, "intent") === "publish";
  let result = "saved";
  try {
    await saveAmenityServiceReview({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      mapObjectId: field(form, "mapObjectId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        operatingStatus: field(form, "operatingStatus"),
        hoursSummary: field(form, "hoursSummary"),
        accessibilityDetails: field(form, "accessibilityDetails"),
        publish,
        confirmed: form.get("confirmed") === "on",
      },
    });
    result = publish ? "published" : "saved";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    result = /changed|version/i.test(message)
      ? "conflict"
      : /confirm|add reviewed|valid|characters/i.test(message)
        ? "invalid"
        : "failed";
  }
  revalidatePath(path);
  revalidatePath("/guest/services");
  revalidatePath("/booking/map");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}
