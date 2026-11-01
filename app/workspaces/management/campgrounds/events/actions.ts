"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  reviewRecreationRequest,
  saveRecreationEvent,
} from "@/lib/recreation-events/postgres.mjs";

const path = "/workspaces/management/campgrounds/events";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const back = (campgroundId: string, outcome: string) =>
  `${path}?campground=${encodeURIComponent(campgroundId)}&${outcome}`;

export async function saveRecreationEventAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "event.manage",
    path,
  );
  try {
    await saveRecreationEvent({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      eventId: field(form, "eventId") || undefined,
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        title: field(form, "title"),
        description: field(form, "description"),
        category: field(form, "category"),
        locationName: field(form, "locationName"),
        eventDate: field(form, "eventDate"),
        startTime: field(form, "startTime"),
        endTime: field(form, "endTime"),
        capacityPlaces: field(form, "capacityPlaces"),
        requiresRegistration: form.get("requiresRegistration") === "on",
        acceptingRequests: form.get("acceptingRequests") === "on",
        isPublished: form.get("isPublished") === "on",
        status: field(form, "status"),
        accessibilityNote: field(form, "accessibilityNote"),
        ageGuidance: field(form, "ageGuidance"),
      },
    });
    revalidatePath(path);
    revalidatePath("/events");
    revalidatePath("/guest/events");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=event"));
  }
  redirect(back(campgroundId, "saved=event"));
}

export async function reviewRecreationRequestAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "event.manage",
    path,
  );
  try {
    await reviewRecreationRequest({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      requestId: field(form, "requestId"),
      decision: field(form, "decision"),
    });
    revalidatePath(path);
    revalidatePath("/events");
    revalidatePath("/guest/events");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=review"));
  }
  redirect(back(campgroundId, "saved=review"));
}
