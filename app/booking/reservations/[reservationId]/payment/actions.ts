"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { startReservationPayment } from "@/lib/payments/postgres.mjs";
import {
  createPaymentProviderAdapter,
  getPaymentProviderConfig,
} from "@/lib/payments/provider.mjs";
import { syncReservationDocuments } from "@/lib/reservation-documents/postgres.mjs";

function reservationPaths(reservationId: string) {
  const encoded = encodeURIComponent(reservationId);
  return {
    payment: `/booking/reservations/${encoded}/payment`,
    pending: `/booking/reservations/${encoded}/pending`,
    documents: `/booking/reservations/${encoded}/documents`,
  };
}

export async function completeSandboxPaymentAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const paths = reservationPaths(reservationId);
  const session = await requireSignedIn(paths.payment);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const config = getPaymentProviderConfig();
  if (config.mode !== "sandbox") {
    throw new Error(
      "Sandbox payment completion is disabled for the configured provider.",
    );
  }

  const provider = createPaymentProviderAdapter(config);
  const result = await startReservationPayment({
    userId: session.user.id,
    reservationId,
    provider,
  });

  if (!result) {
    redirect("/booking");
  }

  const documents = await syncReservationDocuments({
    userId: session.user.id,
    reservationId,
  });

  revalidatePath(paths.payment);
  revalidatePath(paths.pending);
  revalidatePath(paths.documents);

  const message = result.alreadySatisfied
    ? "Current payment obligation is already satisfied."
    : "Sandbox payment captured and verified.";

  if (documents && "confirmation" in documents && documents.confirmation) {
    redirect(paths.documents + "?payment=" + encodeURIComponent(message));
  }

  redirect(paths.payment + "?payment=" + encodeURIComponent(message));
}

export async function confirmReservationAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const paths = reservationPaths(reservationId);
  const session = await requireSignedIn(paths.payment);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const documents = await syncReservationDocuments({
    userId: session.user.id,
    reservationId,
  });

  revalidatePath(paths.payment);
  revalidatePath(paths.pending);
  revalidatePath(paths.documents);

  if (documents && "confirmation" in documents && documents.confirmation) {
    redirect(paths.documents);
  }

  const shortfall =
    documents && "shortfallCents" in documents
      ? documents.shortfallCents
      : null;
  const message =
    shortfall == null
      ? "Reservation is not ready for confirmation."
      : "Booking-time payment is not yet satisfied.";

  redirect(paths.payment + "?payment=" + encodeURIComponent(message));
}
