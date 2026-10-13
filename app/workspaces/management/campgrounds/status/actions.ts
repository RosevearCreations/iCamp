"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  cancelManagementRestriction,
  createManagementRestrictions,
} from "@/lib/management-controls/postgres.mjs";
import {
  transitionAccommodationStatus,
  transitionOperationalAssetStatus,
} from "@/lib/status-engine/postgres.mjs";

const path = "/workspaces/management/campgrounds/status";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fields(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/management/campgrounds/accommodations");
  revalidatePath("/workspaces/management/campgrounds/assets");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function transitionAccommodationStatusAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "accommodation.manage",
    path,
  );

  await transitionAccommodationStatus({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    toState: field(formData, "toState"),
    reason: field(formData, "reason"),
  });

  finish(campgroundId, "Accommodation status updated.");
}

export async function transitionOperationalAssetStatusAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const assetClass = field(formData, "assetClass");
  const permission =
    assetClass === "equipment" ? "equipment.manage" : "asset.manage";
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    path,
  );

  await transitionOperationalAssetStatus({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    assetId: field(formData, "assetId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    toState: field(formData, "toState"),
    reason: field(formData, "reason"),
  });

  finish(campgroundId, "Operational asset status updated.");
}

export async function createManagementRestrictionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );

  await createManagementRestrictions({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    targetKind: field(formData, "targetKind"),
    targetIds: fields(formData, "targetIds"),
    restrictionKind: field(formData, "restrictionKind"),
    startsOn: field(formData, "startsOn"),
    endsOn: field(formData, "endsOn"),
    reason: field(formData, "reason"),
    notes: field(formData, "notes"),
    overrideConflicts: field(formData, "overrideConflicts") === "on",
  });

  finish(campgroundId, "Management closure/hold scheduled.");
}

export async function cancelManagementRestrictionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );

  await cancelManagementRestriction({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    restrictionId: field(formData, "restrictionId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    reason: field(formData, "reason"),
  });

  finish(campgroundId, "Management restriction cancelled.");
}
