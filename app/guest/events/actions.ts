"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  requestRecreationRegistration,
  withdrawRecreationRequest,
} from "@/lib/recreation-events/postgres.mjs";

const path = "/guest/events";
function field(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

export async function requestActivityAction(form: FormData) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    await requestRecreationRegistration({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      eventId: field(form, "eventId"),
      reservationId: field(form, "reservationId"),
      input: {
        partySize: field(form, "partySize"),
        guestNote: field(form, "guestNote"),
        clientRequestId: field(form, "clientRequestId"),
      },
    });
    revalidatePath(path);
    revalidatePath("/events");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=request`);
  }
  redirect(`${path}?saved=request`);
}

export async function withdrawActivityAction(form: FormData) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    await withdrawRecreationRequest({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      requestId: field(form, "requestId"),
    });
    revalidatePath(path);
    revalidatePath("/events");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=withdraw`);
  }
  redirect(`${path}?saved=withdraw`);
}
