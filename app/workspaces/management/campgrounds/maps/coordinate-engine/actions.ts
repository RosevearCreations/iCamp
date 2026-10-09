"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { saveMapPolygon } from "@/lib/map-polygons/postgres.mjs";

const path = "/workspaces/management/campgrounds/maps/coordinate-engine";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveMapPolygonAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(campgroundId, "campground.map", path);
  const rawGeometry = field(formData, "geometry");
  let geometry;
  try {
    geometry = JSON.parse(rawGeometry);
  } catch {
    throw new Error("Polygon geometry is invalid.");
  }

  await saveMapPolygon({
    actorUserId: session.user.id,
    campgroundId,
    mapImageVersionId: field(formData, "mapImageVersionId"),
    polygonId: field(formData, "polygonId") || null,
    expectedRowVersion: Number(field(formData, "rowVersion") || 0),
    label: field(formData, "label"),
    geometry,
  });

  revalidatePath(path);
  redirect(`${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent("Polygon saved.")}`);
}
