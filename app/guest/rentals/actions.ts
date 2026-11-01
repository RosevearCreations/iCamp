"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  submitRentalPlanningRequest,
  withdrawRentalPlanningRequest,
} from "@/lib/rental-planner/postgres.mjs";

const path = "/guest/rentals";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export async function submitRentalPlanningAction(form: FormData) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    await submitRentalPlanningRequest({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      offerId: field(form, "offerId"),
      reservationId: field(form, "reservationId"),
      input: {
        startDate: field(form, "startDate"),
        endDate: field(form, "endDate"),
        guestNote: field(form, "guestNote"),
        clientRequestId: field(form, "clientRequestId"),
      },
    });
    revalidatePath(path);
    revalidatePath("/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=submit`);
  }
  redirect(`${path}?saved=submit`);
}

export async function withdrawRentalPlanningAction(form: FormData) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    await withdrawRentalPlanningRequest({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      requestId: field(form, "requestId"),
    });
    revalidatePath(path);
    revalidatePath("/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=withdraw`);
  }
  redirect(`${path}?saved=withdraw`);
}
