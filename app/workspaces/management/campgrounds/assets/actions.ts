"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createOperationalAsset,
  updateOperationalAsset,
} from "@/lib/operational-assets/postgres.mjs";

const path = "/workspaces/management/campgrounds/assets";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function createFacilityAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "asset.manage",
    path,
  );
  await createOperationalAsset({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId") || null,
    mapObjectId: field(formData, "mapObjectId") || null,
    assetClass: "facility",
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    operatingState: field(formData, "operatingState"),
    notes: field(formData, "notes"),
    detailType: field(formData, "facilityType"),
    guestVisibility: field(formData, "guestVisibility"),
  });
  finish(campgroundId, "Facility asset created.");
}

export async function createEquipmentAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "equipment.manage",
    path,
  );
  await createOperationalAsset({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId") || null,
    mapObjectId: field(formData, "mapObjectId") || null,
    assetClass: "equipment",
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    operatingState: field(formData, "operatingState"),
    notes: field(formData, "notes"),
    detailType: field(formData, "equipmentType"),
    make: field(formData, "make"),
    model: field(formData, "model"),
    serialNumber: field(formData, "serialNumber"),
    ownershipType: field(formData, "ownershipType"),
    meterKind: field(formData, "meterKind"),
    meterReading: field(formData, "meterReading"),
    storageLocation: field(formData, "storageLocation"),
  });
  finish(campgroundId, "Equipment or fleet asset created.");
}

export async function updateOperationalAssetAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const assetClass = field(formData, "assetClass");
  const permission =
    assetClass === "equipment" ? "equipment.manage" : "asset.manage";
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    path,
  );
  await updateOperationalAsset({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    assetId: field(formData, "assetId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    lifecycleState: field(formData, "lifecycleState"),
    operatingState: field(formData, "operatingState"),
    notes: field(formData, "notes"),
    guestVisibility: field(formData, "guestVisibility"),
    make: field(formData, "make"),
    model: field(formData, "model"),
    serialNumber: field(formData, "serialNumber"),
    ownershipType: field(formData, "ownershipType"),
    meterKind: field(formData, "meterKind"),
    meterReading: field(formData, "meterReading"),
    storageLocation: field(formData, "storageLocation"),
  });
  finish(campgroundId, "Operational asset saved.");
}
