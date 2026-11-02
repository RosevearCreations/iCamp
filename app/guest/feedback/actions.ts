"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  appealFeedbackModeration,
  saveGuestFeedback,
  withdrawFeedbackPublication,
} from "@/lib/guest-feedback/postgres.mjs";

const path = "/guest/feedback";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

async function guestSession() {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  return session;
}

function refresh() {
  revalidatePath(path);
  revalidatePath("/reviews");
  revalidatePath("/guest/hub");
}

export async function saveGuestFeedbackAction(form: FormData) {
  const session = await guestSession();
  try {
    await saveGuestFeedback({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      reservationId: field(form, "reservationId"),
      feedbackId: field(form, "feedbackId") || undefined,
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        rating: field(form, "rating"),
        category: field(form, "category"),
        title: field(form, "title"),
        publicSummary: field(form, "publicSummary"),
        privateDetails: field(form, "privateDetails"),
        publicRequested: form.get("publicRequested") === "on",
        assistanceCaseId: field(form, "assistanceCaseId"),
      },
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=save`);
  }
  redirect(`${path}?saved=feedback`);
}

export async function withdrawFeedbackPublicationAction(form: FormData) {
  const session = await guestSession();
  try {
    await withdrawFeedbackPublication({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      feedbackId: field(form, "feedbackId"),
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=withdraw`);
  }
  redirect(`${path}?saved=withdraw`);
}

export async function appealFeedbackAction(form: FormData) {
  const session = await guestSession();
  try {
    await appealFeedbackModeration({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      feedbackId: field(form, "feedbackId"),
      reason: field(form, "reason"),
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=appeal`);
  }
  redirect(`${path}?saved=appeal`);
}
