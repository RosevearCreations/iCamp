"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  createRoadVehicleRegistration,
  revokeRoadVehicleRegistration,
} from "@/lib/road-vehicle-registration/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error
      ? error.message
      : "Road vehicle registration operation failed."
  ).slice(0, 360);
}

function vehicleDeskPath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/vehicles?campground=" +
    encodeURIComponent(campgroundId)
  );
}

export async function registerRoadVehicleAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = vehicleDeskPath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await createRoadVehicleRegistration({
      actorUserId: session.user.id,
      campgroundId,
      hostAccommodationId: text(formData, "hostAccommodationId"),
      reservationId: text(formData, "reservationId") || null,
      guestVehicleProfileId: text(formData, "guestVehicleProfileId") || null,
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        vehicleKind: text(formData, "vehicleKind"),
        plateNumber: text(formData, "plateNumber"),
        plateJurisdiction: text(formData, "plateJurisdiction"),
        vehicleDescription: text(formData, "vehicleDescription"),
        registeredOwnerName: text(formData, "registeredOwnerName"),
        primaryDriverName: text(formData, "primaryDriverName"),
        validFrom: text(formData, "validFrom"),
        validUntil: text(formData, "validUntil"),
        notes: text(formData, "notes"),
      },
    });

    revalidatePath(path);
    revalidatePath("/workspaces/management/campgrounds/reservations");
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        result.idempotent
          ? "This road vehicle registration was already recorded."
          : "Road vehicle registration recorded.",
      );
  } catch (error) {
    destination = path + "&error=" + encodeURIComponent(errorMessage(error));
  }

  redirect(destination);
}

export async function revokeRoadVehicleAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = vehicleDeskPath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await revokeRoadVehicleRegistration({
      actorUserId: session.user.id,
      campgroundId,
      registrationId: text(formData, "registrationId"),
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      sourceChannel: "web",
    });

    revalidatePath(path);
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        result.idempotent
          ? "This road vehicle registration was already revoked."
          : "Road vehicle registration revoked.",
      );
  } catch (error) {
    destination = path + "&error=" + encodeURIComponent(errorMessage(error));
  }

  redirect(destination);
}
