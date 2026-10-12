"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createAccommodation,
  updateAccommodation,
  updateCampsiteDetails,
} from "@/lib/accommodations/postgres.mjs";

const path = "/workspaces/management/campgrounds/accommodations";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string) {
  return formData.has(key);
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


export async function updateCampsiteDetailsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await updateCampsiteDetails({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedDetailRowVersion: Number(field(formData, "detailRowVersion")),
    campsiteType: field(formData, "campsiteType"),
    serviceLevel: field(formData, "serviceLevel"),
    stayProfile: field(formData, "stayProfile"),
    isWaterfront: checked(formData, "isWaterfront"),
    electricalAmperage: Number(field(formData, "electricalAmperage")),
    waterService: field(formData, "waterService"),
    wastewaterService: field(formData, "wastewaterService"),
    wifiService: field(formData, "wifiService"),
    siteLengthMeters: field(formData, "siteLengthMeters") || null,
    siteWidthMeters: field(formData, "siteWidthMeters") || null,
    maxRvLengthMeters: field(formData, "maxRvLengthMeters") || null,
    maxRvWidthMeters: field(formData, "maxRvWidthMeters") || null,
    maxRvHeightMeters: field(formData, "maxRvHeightMeters") || null,
    surfaceType: field(formData, "surfaceType"),
    pullThrough: checked(formData, "pullThrough"),
    shadeLevel: field(formData, "shadeLevel"),
    hasFireRing: checked(formData, "hasFireRing"),
    hasPicnicTable: checked(formData, "hasPicnicTable"),
  });

  finish(campgroundId, "Campsite details saved.");
}
