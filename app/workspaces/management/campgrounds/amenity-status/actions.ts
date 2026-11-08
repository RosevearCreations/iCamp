"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { listOperationalAssets } from "@/lib/operational-assets/postgres.mjs";
import { transitionOperationalAssetStatus } from "@/lib/status-engine/postgres.mjs";
import { staffOperatingStates } from "@/lib/amenity-status/board.mjs";

const path = "/workspaces/management/campgrounds/amenity-status";

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export async function changeAmenityOperatingStateAction(formData: FormData) {
  const campgroundId = value(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "asset.manage",
    path,
  );
  const assetId = value(formData, "assetId");
  const toState = value(formData, "toState");
  const expectedRowVersion = Number(value(formData, "rowVersion"));
  const reason = value(formData, "reason");

  if (!staffOperatingStates.includes(toState)) {
    throw new Error("Choose a supported operating condition.");
  }
  if (!reason || reason.length > 500) {
    throw new Error("A status explanation of 1–500 characters is required.");
  }
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) {
    throw new Error("The asset version is invalid. Refresh and try again.");
  }
  const assets = await listOperationalAssets(session.user.id, campgroundId);
  const target = assets.find((asset) => asset.id === assetId);
  if (!target || target.assetClass !== "facility") {
    throw new Error("The requested campground facility is unavailable.");
  }
  await transitionOperationalAssetStatus({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    assetId,
    expectedRowVersion,
    toState,
    reason,
  });
  revalidatePath(path);
  revalidatePath("/workspaces/management/campgrounds/status");
  revalidatePath("/workspaces/management/campgrounds/assets");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=status`,
  );
}
