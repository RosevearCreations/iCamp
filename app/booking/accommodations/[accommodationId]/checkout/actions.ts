"use server";

import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { checkoutErrorCode } from "@/lib/reservation-checkout/core.mjs";
import {
  finalizeReservationCheckout,
  startReservationCheckout,
} from "@/lib/reservation-checkout/postgres.mjs";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function detailPath(
  campgroundSlug: string,
  accommodationId: string,
  arrivalDate: string,
  departureDate: string,
) {
  return (
    `/booking/accommodations/${encodeURIComponent(accommodationId)}` +
    `?campground=${encodeURIComponent(campgroundSlug)}` +
    `&arrivalDate=${encodeURIComponent(arrivalDate)}` +
    `&departureDate=${encodeURIComponent(departureDate)}`
  );
}

function checkoutPath(accommodationId: string, holdId: string) {
  return (
    `/booking/accommodations/${encodeURIComponent(accommodationId)}/checkout` +
    `?hold=${encodeURIComponent(holdId)}`
  );
}

function requireGuest(
  session: Awaited<ReturnType<typeof requireSignedIn>>,
): asserts session is Awaited<ReturnType<typeof requireSignedIn>> {
  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }
}

export async function startReservationCheckoutAction(formData: FormData) {
  const campgroundSlug = field(formData, "campgroundSlug");
  const accommodationId = field(formData, "accommodationId");
  const arrivalDate = field(formData, "arrivalDate");
  const departureDate = field(formData, "departureDate");
  const returnPath = detailPath(
    campgroundSlug,
    accommodationId,
    arrivalDate,
    departureDate,
  );
  const session = await requireSignedIn(returnPath);
  requireGuest(session);

  let holdId = "";
  try {
    const hold = await startReservationCheckout({
      userId: session.user.id,
      campgroundSlug,
      accommodationId,
      arrivalDate,
      departureDate,
    });
    holdId = hold.holdId;
  } catch (error) {
    const code =
      checkoutErrorCode(error) ?? "ICAMP_CHECKOUT_ACCOMMODATION_UNAVAILABLE";
    redirect(returnPath + `&checkoutError=${encodeURIComponent(code)}`);
  }

  redirect(checkoutPath(accommodationId, holdId));
}

export async function finalizeReservationCheckoutAction(formData: FormData) {
  const accommodationId = field(formData, "accommodationId");
  const holdId = field(formData, "holdId");
  const returnPath = checkoutPath(accommodationId, holdId);
  const session = await requireSignedIn(returnPath);
  requireGuest(session);

  const selections = formData.getAll("chargeCode").map((value) => {
    const code = String(value);
    return {
      code,
      quantity: Number(field(formData, `quantity__${code}`) || "1"),
    };
  });

  let reservationId = "";
  try {
    const result = await finalizeReservationCheckout({
      userId: session.user.id,
      holdId,
      input: {
        primaryFirstName: field(formData, "primaryFirstName"),
        primaryLastName: field(formData, "primaryLastName"),
        contactEmail: field(formData, "contactEmail"),
        contactPhone: field(formData, "contactPhone"),
        occupants: Number(field(formData, "occupants")),
        visitors: Number(field(formData, "visitors") || "0"),
        pets: Number(field(formData, "pets") || "0"),
        vehicles: Number(field(formData, "vehicles") || "0"),
        lodgingKind: field(formData, "lodgingKind"),
        rvLengthMeters: field(formData, "rvLengthMeters"),
        rvWidthMeters: field(formData, "rvWidthMeters"),
        rvHeightMeters: field(formData, "rvHeightMeters"),
        electricalAmperage: Number(
          field(formData, "electricalAmperage") || "0",
        ),
        needsWaterAtSite: formData.get("needsWaterAtSite") === "on",
        needsWastewaterAtSite: formData.get("needsWastewaterAtSite") === "on",
        needsWifi: formData.get("needsWifi") === "on",
        needsStepFreeAccess: formData.get("needsStepFreeAccess") === "on",
        needsAccessibleWashroom:
          formData.get("needsAccessibleWashroom") === "on",
        rulesAcknowledged: formData.get("rulesAcknowledged") === "on",
        selections,
      },
    });
    reservationId = result.reservationId;
  } catch (error) {
    const code = checkoutErrorCode(error) ?? "ICAMP_CHECKOUT_INVALID_INPUT";
    redirect(returnPath + `&error=${encodeURIComponent(code)}`);
  }

  redirect(
    `/booking/reservations/${encodeURIComponent(reservationId)}/pending`,
  );
}
