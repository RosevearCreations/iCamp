"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  cancelManagedReservation,
  createManagedReservation,
  updateManagedReservation,
} from "@/lib/reservation-management/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Reservation action failed.";
  return message.slice(0, 300);
}

function consolePath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/reservations?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function detailPath(campgroundId: string, reservationId: string) {
  return (
    "/workspaces/management/campgrounds/reservations/" +
    encodeURIComponent(reservationId) +
    "?campground=" +
    encodeURIComponent(campgroundId)
  );
}

export async function createReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = consolePath(campgroundId);
  const session = await requireStaff(path);

  try {
    const result = await createManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        arrivalDate: text(formData, "arrivalDate"),
        departureDate: text(formData, "departureDate"),
        guestDisplayName: text(formData, "guestDisplayName"),
        contactEmail: text(formData, "contactEmail"),
        chargeSelections: text(formData, "chargeSelections"),
      },
    });
    revalidatePath(path);
    redirect(
      detailPath(campgroundId, result.reservationId) +
        "&saved=" +
        encodeURIComponent(
          result.idempotent
            ? "Reservation creation was already applied."
            : "Reservation created.",
        ),
    );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function updateReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    const result = await updateManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        arrivalDate: text(formData, "arrivalDate"),
        departureDate: text(formData, "departureDate"),
        guestDisplayName: text(formData, "guestDisplayName"),
        contactEmail: text(formData, "contactEmail"),
        chargeSelections: text(formData, "chargeSelections"),
      },
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    const message =
      "Reservation " +
      result.changeKind +
      " recorded." +
      (result.financialReviewRequired
        ? " Financial review is required before money is adjusted."
        : "");
    redirect(path + "&saved=" + encodeURIComponent(message));
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function cancelReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    const result = await cancelManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    const message =
      "Reservation cancelled." +
      (result.financialReviewRequired
        ? " Captured payment exists; Build 045 financial review is required. No refund was issued."
        : " No refund was issued.");
    redirect(path + "&saved=" + encodeURIComponent(message));
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}
