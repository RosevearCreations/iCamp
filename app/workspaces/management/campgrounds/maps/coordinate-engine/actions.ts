"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { moveMapLayer, updateMapLayer } from "@/lib/map-layers/postgres.mjs";
import {
  duplicateMapPolygon,
  saveMapPolygon,
  setMapPolygonState,
} from "@/lib/map-polygons/postgres.mjs";

const path = "/workspaces/management/campgrounds/maps/coordinate-engine";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function saveMapPolygonAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map",
    path,
  );
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
    layerId: field(formData, "layerId"),
    mapLabel: field(formData, "mapLabel"),
    mapIconKey: field(formData, "mapIconKey") || null,
    mapLabelVisible: field(formData, "mapLabelVisible") === "true",
  });

  finish(campgroundId, "Polygon saved.");
}

export async function duplicateMapPolygonAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map",
    path,
  );

  await duplicateMapPolygon({
    actorUserId: session.user.id,
    campgroundId,
    mapImageVersionId: field(formData, "mapImageVersionId"),
    polygonId: field(formData, "polygonId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
  });

  finish(campgroundId, "Polygon duplicated.");
}

async function setState(
  formData: FormData,
  state: "locked" | "hidden" | "archived",
  enabled: boolean,
  message: string,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.map",
    path,
  );

  await setMapPolygonState({
    actorUserId: session.user.id,
    campgroundId,
    mapImageVersionId: field(formData, "mapImageVersionId"),
    polygonId: field(formData, "polygonId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    state,
    enabled,
  });

  finish(campgroundId, message);
}

export async function toggleMapPolygonLockAction(formData: FormData) {
  const enabled = field(formData, "enabled") === "true";
  await setState(
    formData,
    "locked",
    enabled,
    enabled ? "Polygon locked." : "Polygon unlocked.",
  );
}

export async function toggleMapPolygonHiddenAction(formData: FormData) {
  const enabled = field(formData, "enabled") === "true";
  await setState(
    formData,
    "hidden",
    enabled,
    enabled ? "Polygon hidden." : "Polygon shown.",
  );
}

export async function toggleMapPolygonArchivedAction(formData: FormData) {
  const enabled = field(formData, "enabled") === "true";
  await setState(
    formData,
    "archived",
    enabled,
    enabled ? "Polygon archived." : "Polygon restored.",
  );
}

export async function updateMapLayerAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await updateMapLayer({
    actorUserId: session.user.id,
    campgroundId,
    layerId: field(formData, "layerId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    displayName: field(formData, "displayName"),
    iconKey: field(formData, "iconKey"),
    visibilityPermissionKey: field(formData, "visibilityPermissionKey"),
    isEnabled: field(formData, "isEnabled") === "true",
  });

  finish(campgroundId, "Map layer updated.");
}

export async function moveMapLayerAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await moveMapLayer({
    actorUserId: session.user.id,
    campgroundId,
    layerId: field(formData, "layerId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    direction: field(formData, "direction") === "up" ? "up" : "down",
  });

  finish(campgroundId, "Map layer order updated.");
}
