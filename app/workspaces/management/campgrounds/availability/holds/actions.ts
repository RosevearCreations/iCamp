"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createTemporaryHold,
  releaseTemporaryHold,
  updateTemporaryHoldDuration,
} from "@/lib/reservation-holds/postgres.mjs";

const path = "/workspaces/management/campgrounds/availability/holds";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(
  campgroundId: string,
  arrivalDate: string,
  departureDate: string,
  message: string,
) {
  revalidatePath(path);
  revalidatePath("/workspaces/management/campgrounds/availability");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&arrivalDate=${encodeURIComponent(arrivalDate)}&departureDate=${encodeURIComponent(departureDate)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function createTemporaryHoldAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.create",
    path,
  );
  const arrivalDate = field(formData, "arrivalDate");
  const departureDate = field(formData, "departureDate");

  await createTemporaryHold({
    userId: session.user.id,
    campgroundId,
    accommodationId: field(formData, "accommodationId"),
    arrivalDate,
    departureDate,
    holdKey: field(formData, "holdKey"),
  });

  finish(campgroundId, arrivalDate, departureDate, "Temporary hold created.");
}

export async function releaseTemporaryHoldAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.create",
    path,
  );
  const arrivalDate = field(formData, "arrivalDate");
  const departureDate = field(formData, "departureDate");

  await releaseTemporaryHold({
    userId: session.user.id,
    campgroundId,
    holdId: field(formData, "holdId"),
    holdKey: field(formData, "holdKey"),
  });

  finish(campgroundId, arrivalDate, departureDate, "Temporary hold released.");
}

export async function updateTemporaryHoldDurationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );
  const arrivalDate = field(formData, "arrivalDate");
  const departureDate = field(formData, "departureDate");

  await updateTemporaryHoldDuration({
    userId: session.user.id,
    campgroundId,
    durationMinutes: Number(field(formData, "durationMinutes")),
  });

  finish(
    campgroundId,
    arrivalDate,
    departureDate,
    "Temporary hold duration updated.",
  );
}
