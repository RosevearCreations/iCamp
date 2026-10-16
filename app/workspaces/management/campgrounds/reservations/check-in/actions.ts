"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { checkInReservation } from "@/lib/front-desk-check-in/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function strings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Front desk check-in failed."
  ).slice(0, 360);
}

function checkInPath(campgroundId: string, reservationId?: string) {
  const campground =
    "/workspaces/management/campgrounds/reservations/check-in?campground=" +
    encodeURIComponent(campgroundId);
  return reservationId
    ? campground + "&reservation=" + encodeURIComponent(reservationId)
    : campground;
}

export async function checkInReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = checkInPath(campgroundId, reservationId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await checkInReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      sourceChannel: "web",
      input: {
        occupantCount: text(formData, "occupantCount"),
        visitorCount: text(formData, "visitorCount"),
        petCount: text(formData, "petCount"),
        vehicleCount: text(formData, "vehicleCount"),
        vehicleProfileIds: strings(formData, "vehicleProfileId"),
        petProfileIds: strings(formData, "petProfileId"),
        rulesAcknowledged: formData.get("rulesAcknowledged") === "on",
        credentialRequestCount: text(formData, "credentialRequestCount") || "0",
        rentalRequests: text(formData, "rentalRequests"),
        storeRequests: text(formData, "storeRequests"),
        balanceOverrideRequested:
          formData.get("balanceOverrideRequested") === "on",
        balanceOverrideReason: text(formData, "balanceOverrideReason"),
        notes: text(formData, "notes"),
      },
    });

    revalidatePath(checkInPath(campgroundId));
    revalidatePath(path);
    revalidatePath("/workspaces/management/campgrounds/reservations");

    const message = result.idempotent
      ? "This reservation was already checked in."
      : result.balanceOverrideUsed
        ? "Check-in completed with an audited manager balance/review override."
        : "Check-in completed.";

    destination = path + "&saved=" + encodeURIComponent(message);
  } catch (error) {
    destination = path + "&error=" + encodeURIComponent(errorMessage(error));
  }

  redirect(destination);
}
