"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { updateCampgroundFulfillment } from "@/lib/booking-charges/fulfillment-postgres.mjs";

const path = "/workspaces/management/campgrounds/service-fulfillment";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function updateFulfillmentAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.modify",
    path,
  );
  let state = "update-error";
  try {
    await updateCampgroundFulfillment({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      jobId: field(form, "jobId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      nextState: field(form, "nextState"),
      serviceDate: field(form, "serviceDate"),
      serviceWindow: field(form, "serviceWindow"),
      staffNote: field(form, "staffNote"),
    });
    state = "updated";
  } catch {
    // Never leak a private reservation, permission or database error into URL.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${state}`,
  );
}
