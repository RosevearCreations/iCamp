"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { checkOutReservation } from "@/lib/front-desk-check-out/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Front desk checkout failed."
  ).slice(0, 360);
}

function checkOutPath(campgroundId: string, reservationId?: string) {
  const campground =
    "/workspaces/management/campgrounds/reservations/check-out?campground=" +
    encodeURIComponent(campgroundId);
  return reservationId
    ? campground + "&reservation=" + encodeURIComponent(reservationId)
    : campground;
}

export async function checkOutReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = checkOutPath(campgroundId, reservationId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await checkOutReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      sourceChannel: "web",
      input: {
        departureConfirmed: formData.get("departureConfirmed") === "on",
        financialFollowUpAcknowledged:
          formData.get("financialFollowUpAcknowledged") === "on",
        rentalReturnState: text(formData, "rentalReturnState"),
        keyReturnState: text(formData, "keyReturnState"),
        credentialReturnState: text(formData, "credentialReturnState"),
        returnNotes: text(formData, "returnNotes"),
        departureNotes: text(formData, "departureNotes"),
      },
    });

    revalidatePath(checkOutPath(campgroundId));
    revalidatePath(path);
    revalidatePath("/workspaces/management/campgrounds/reservations");

    const message = result.idempotent
      ? "This reservation was already checked out."
      : result.turnoverState === "cottage_configuration_required"
        ? "Checkout completed. Cottage turnover configuration requires follow-up."
        : "Checkout completed and post-departure turnover/inspection was triggered.";

    destination = path + "&saved=" + encodeURIComponent(message);
  } catch (error) {
    destination = path + "&error=" + encodeURIComponent(errorMessage(error));
  }

  redirect(destination);
}
