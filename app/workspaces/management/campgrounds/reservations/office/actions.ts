"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  createOverflowArea,
  setOverflowAreaMembers,
} from "@/lib/office-booking/postgres.mjs";
import { createManagedReservation } from "@/lib/reservation-management/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Office booking action failed.";
  return message.slice(0, 300);
}

function officePath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/reservations/office?campground=" +
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

export async function createOfficeBookingAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = officePath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await createManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      intake: {
        bookingMode: text(formData, "bookingMode"),
        overflowAreaId: text(formData, "overflowAreaId"),
        officeNote: text(formData, "officeNote"),
      },
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
    destination =
      detailPath(campgroundId, result.reservationId) +
      "&saved=" +
      encodeURIComponent(
        result.idempotent
          ? "Office booking was already applied."
          : "Office booking created.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function createOverflowAreaAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = officePath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    await createOverflowArea({
      actorUserId: session.user.id,
      campgroundId,
      input: {
        code: text(formData, "code"),
        displayName: text(formData, "displayName"),
        notes: text(formData, "notes"),
      },
      reason: text(formData, "reason"),
    });
    revalidatePath(path);
    destination =
      path + "&saved=" + encodeURIComponent("Overflow area created.");
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function setOverflowAreaMembersAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = officePath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    await setOverflowAreaMembers({
      actorUserId: session.user.id,
      campgroundId,
      overflowAreaId: text(formData, "overflowAreaId"),
      accommodationIds: formData
        .getAll("memberAccommodationIds")
        .map((value) => String(value)),
      reason: text(formData, "reason"),
    });
    revalidatePath(path);
    destination =
      path + "&saved=" + encodeURIComponent("Overflow membership updated.");
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}
