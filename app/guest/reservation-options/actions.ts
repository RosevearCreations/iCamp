"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { normalizeReviewRequest } from "@/lib/reservation-decisions/core.mjs";
import {
  getOwnReservationDecisionSource,
  submitOwnReservationReviewRequest,
  withdrawOwnReservationReviewRequest,
} from "@/lib/reservation-decisions/postgres.mjs";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function pathFor(reservationId: string) {
  return (
    "/guest/reservation-options?reservation=" +
    encodeURIComponent(reservationId)
  );
}

async function guestSession(path: string) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  return session;
}

export async function submitReservationReviewAction(form: FormData) {
  const reservationId = field(form, "reservationId");
  const path = pathFor(reservationId);
  const session = await guestSession(path);
  if (form.get("confirmReview") !== "on") {
    redirect(path + "&error=consent");
  }
  try {
    const source = await getOwnReservationDecisionSource({
      userId: session.user.id,
      reservationId,
    });
    if (!source) redirect(path + "&error=unavailable");
    const input = normalizeReviewRequest(
      {
        kind: field(form, "kind"),
        reason: field(form, "reason"),
        arrivalDate: field(form, "arrivalDate"),
        departureDate: field(form, "departureDate"),
      },
      source.stay.reservation.campgroundLocalDate,
    );
    if (
      input.kind === "change_dates" &&
      input.arrivalDate === source.stay.reservation.arrivalDate &&
      input.departureDate === source.stay.reservation.departureDate
    ) {
      redirect(path + "&error=dates");
    }
    const expectedReservationVersion = Number(
      field(form, "expectedReservationVersion"),
    );
    const policyText = field(form, "expectedPolicyVersion");
    const expectedPolicyVersion = policyText ? Number(policyText) : null;
    const idempotencyKey = field(form, "idempotencyKey");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        idempotencyKey,
      )
    ) {
      throw new Error("Invalid request key.");
    }
    if (
      !Number.isSafeInteger(expectedReservationVersion) ||
      expectedReservationVersion < 1 ||
      (expectedPolicyVersion !== null &&
        (!Number.isSafeInteger(expectedPolicyVersion) ||
          expectedPolicyVersion < 1))
    ) {
      throw new Error("Invalid source revision.");
    }
    await submitOwnReservationReviewRequest({
      userId: session.user.id,
      reservationId,
      idempotencyKey,
      expectedReservationVersion,
      expectedPolicyVersion,
      input,
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
        ? "existing"
        : "unavailable";
    redirect(path + "&error=" + code);
  }
  revalidatePath(path);
  redirect(path + "&saved=1");
}

export async function withdrawReservationReviewAction(form: FormData) {
  const reservationId = field(form, "reservationId");
  const path = pathFor(reservationId);
  const session = await guestSession(path);
  const requestId = field(form, "requestId");
  try {
    const changed = await withdrawOwnReservationReviewRequest({
      userId: session.user.id,
      reservationId,
      requestId,
    });
    if (!changed) redirect(path + "&error=withdraw");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(path + "&error=withdraw");
  }
  revalidatePath(path);
  redirect(path + "&withdrawn=1");
}
