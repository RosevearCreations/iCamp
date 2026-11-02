"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  reviewRentalPlanningRequest,
  saveRentalOffer,
} from "@/lib/rental-planner/postgres.mjs";

const path = "/workspaces/management/campgrounds/rentals";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const back = (campgroundId: string, outcome: string) =>
  `${path}?campground=${encodeURIComponent(campgroundId)}&${outcome}`;

export async function saveRentalOfferAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  try {
    await saveRentalOffer({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      offerId: field(form, "offerId") || undefined,
      assetId: field(form, "assetId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        description: field(form, "description"),
        accessibilityNote: field(form, "accessibilityNote"),
        returnGuidance: field(form, "returnGuidance"),
        maxDays: field(form, "maxDays"),
        isPublished: form.get("isPublished") === "on",
        acceptingRequests: form.get("acceptingRequests") === "on",
      },
    });
    revalidatePath(path);
    revalidatePath("/rentals");
    revalidatePath("/guest/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=offer"));
  }
  redirect(back(campgroundId, "saved=offer"));
}

export async function reviewRentalPlanningAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  try {
    await reviewRentalPlanningRequest({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      requestId: field(form, "requestId"),
      decision: field(form, "decision"),
    });
    revalidatePath(path);
    revalidatePath("/rentals");
    revalidatePath("/guest/rentals");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=review"));
  }
  redirect(back(campgroundId, "saved=review"));
}
