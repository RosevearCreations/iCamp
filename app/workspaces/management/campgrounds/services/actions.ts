"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  archiveCampgroundService,
  createCampgroundService,
  updateCampgroundService,
} from "@/lib/booking-charges/catalog-postgres.mjs";

const path = "/workspaces/management/campgrounds/services";

function field(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function destination(campgroundId: string, state: string) {
  revalidatePath(path);
  revalidatePath("/booking");
  revalidatePath("/workspaces/management/campgrounds");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${encodeURIComponent(state)}`,
  );
}

function input(data: FormData) {
  return {
    preset: field(data, "preset"),
    code: field(data, "code"),
    displayName: field(data, "displayName"),
    description: field(data, "description"),
    pricingBasis: field(data, "pricingBasis"),
    priceDollars: field(data, "priceDollars"),
    unitLabel: field(data, "unitLabel"),
    minimumQuantity: field(data, "minimumQuantity"),
    maximumQuantity: field(data, "maximumQuantity"),
    startsOn: field(data, "startsOn"),
    endsOn: field(data, "endsOn"),
    isPublic: data.get("isPublic") === "on",
  };
}

export async function createServiceAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "pricing.manage",
    path,
  );
  let result = "create-error";
  try {
    await createCampgroundService({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      ...input(formData),
    });
    result = "created";
  } catch {
    // Database or validation details must not leak through the redirect.
  }
  destination(campgroundId, result);
}

export async function updateServiceAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "pricing.manage",
    path,
  );
  let result = "update-error";
  try {
    await updateCampgroundService({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      chargeId: field(formData, "chargeId"),
      expectedRowVersion: Number(field(formData, "rowVersion")),
      ...input(formData),
    });
    result = "updated";
  } catch {
    // Concurrent changes must be reviewed after a page refresh.
  }
  destination(campgroundId, result);
}

export async function archiveServiceAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "pricing.manage",
    path,
  );
  if (field(formData, "confirmation") !== "ARCHIVE") {
    destination(campgroundId, "archive-confirmation-required");
  }
  let result = "archive-error";
  try {
    await archiveCampgroundService({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      chargeId: field(formData, "chargeId"),
      expectedRowVersion: Number(field(formData, "rowVersion")),
    });
    result = "archived";
  } catch {
    // Fail closed on stale versions, protected charges or database issues.
  }
  destination(campgroundId, result);
}
