"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { startReservationPayment } from "@/lib/payments/postgres.mjs";
import {
  createPaymentProviderAdapter,
  getPaymentProviderConfig,
} from "@/lib/payments/provider.mjs";

export async function completeSandboxPaymentAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const path = `/booking/reservations/${encodeURIComponent(reservationId)}/payment`;
  const session = await requireSignedIn(path);

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

  revalidatePath(path);
  revalidatePath(
    `/booking/reservations/${encodeURIComponent(reservationId)}/pending`,
  );

  const message = result.alreadySatisfied
    ? "Current payment obligation is already satisfied."
    : "Sandbox payment captured and verified.";

  redirect(path + "?payment=" + encodeURIComponent(message));
}
